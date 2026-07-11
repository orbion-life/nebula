"""Phase-1 tests: contracts, objective compile, run lifecycle, state machine."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import main
from app.contracts.enums import RunStatus
from app.jobs.store import RunStore
from app.state.machine import (
    IllegalTransition,
    assert_transition,
    can_transition,
    is_terminal,
    progress_fraction,
)

DEMO = (
    "We want a genetically encoded multimodal protein sensor for an optically active "
    "hydrogel film. Optical fluorescence readout. Possible magnetic or RF-linked response. "
    "Bacterial expression first. Blue-light excitation acceptable. No confidential sequences."
)


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(main, "STORE", RunStore(":memory:"))
    monkeypatch.setattr(main, "OFFLINE", True)
    # Phase-1 tests exercise the run LIFECYCLE, not orchestration; disable the
    # background orchestrator so cancel-from-queued is deterministic (no race).
    monkeypatch.setattr(main, "orchestrate", lambda *a, **k: None)
    return TestClient(main.app)


def test_state_machine_edges() -> None:
    assert can_transition(RunStatus.queued, RunStatus.compiling_objective)
    assert not can_transition(RunStatus.queued, RunStatus.ranking)
    assert is_terminal(RunStatus.completed)
    with pytest.raises(IllegalTransition):
        assert_transition(RunStatus.completed, RunStatus.ranking)
    assert progress_fraction(RunStatus.queued) == 0.0
    assert progress_fraction(RunStatus.completed) == 1.0
    assert progress_fraction(RunStatus.failed) == 1.0


def test_health_offline(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["offline"] is True
    assert set(body["providers"]) == {"uniprot", "interpro", "rcsb", "alphafold", "fpbase"}
    assert all(v is False for v in body["providers"].values())


def test_registries(client: TestClient) -> None:
    assert len(client.get("/api/instruments").json()["instruments"]) == 3
    assert len(client.get("/api/routes").json()["routes"]) == 7


def test_compile_demo_objective(client: TestClient) -> None:
    spec = client.post("/api/objectives/compile", json={"objective_text": DEMO}).json()
    assert "fluorescence" in spec["desired_modalities"]
    assert "RF_magnetic" in spec["desired_modalities"]
    assert "material_state" in spec["desired_modalities"]
    assert spec["material_context"] == "hydrogel"
    assert spec["expression_host"] == "bacteria"
    assert spec["sensed_quantity_or_state"]  # the SENSED quantity is captured
    assert spec["confidential_sequence_provided"] is False
    # measurement is an OUTPUT the app proposes — sensitivity/LoD and excitation are NO LONGER
    # demanded as missing user input (the customer states only what to sense + the environment)
    assert not any("sensitivity" in m or "limit-of-detection" in m for m in spec["missing_information"])
    assert not any("excitation" in m for m in spec["missing_information"])


def test_run_lifecycle_and_idempotency(client: TestClient) -> None:
    r1 = client.post("/api/runs", json={"objective_text": DEMO})
    assert r1.status_code == 201
    run_id = r1.json()["run_id"]
    assert r1.json()["status"] == "queued"
    # identical inputs → same content-addressed run
    r2 = client.post("/api/runs", json={"objective_text": DEMO})
    assert r2.json()["run_id"] == run_id
    # fetch + events
    got = client.get(f"/api/runs/{run_id}")
    assert got.status_code == 200
    assert got.json()["status_note"] == "diagnostic_only_not_validated"
    assert client.get(f"/api/runs/{run_id}/events.json").json()[0]["to_status"] == "queued"
    # cancel
    cancelled = client.post(f"/api/runs/{run_id}/cancel")
    assert cancelled.json()["status"] == "cancelled"
    # real SSE stream (run is now terminal → returns promptly with an event stream)
    sse = client.get(f"/api/runs/{run_id}/events")
    assert "text/event-stream" in sse.headers["content-type"]
    assert "data:" in sse.text


def test_invalid_objective_surfaces_422(client: TestClient) -> None:
    r = client.post("/api/runs", json={"objective_text": ""})
    assert r.status_code == 422


def test_missing_run_404(client: TestClient) -> None:
    assert client.get("/api/runs/run_doesnotexist").status_code == 404


def test_generative_frontier_preview_is_honest() -> None:
    """The de novo 'unmade' lane is a labelled preview: invented, deterministic, and carrying
    NO sequence and NO coordinates. It must never fabricate a real or orderable candidate."""
    from app.contracts.objective import ObjectiveSpec
    from app.design import generate_previews

    spec = ObjectiveSpec(objective_id="o", objective_text="x", sensed_quantity_or_state="a weak magnetic field")
    previews = generate_previews(spec)
    assert len(previews) == 3
    for p in previews:
        assert p.found_in_nature is False
        assert p.sequence_provided is False
        assert "a weak magnetic field" in p.invented_for
        assert "not validated" in p.note.lower() and "not an orderable sequence" in p.note.lower()
        # a preview carries no sequence/coordinate fields at all
        assert not hasattr(p, "sequence") and not hasattr(p, "coordinates")
    # deterministic: same objective → same previews (no randomness)
    assert [p.label for p in generate_previews(spec)] == [p.label for p in previews]
