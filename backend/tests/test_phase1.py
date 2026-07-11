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
    assert len(client.get("/api/instruments").json()["instruments"]) == 4
    assert len(client.get("/api/routes").json()["routes"]) == 7


def test_compile_demo_objective(client: TestClient) -> None:
    spec = client.post("/api/objectives/compile", json={"objective_text": DEMO}).json()
    assert "fluorescence" in spec["desired_modalities"]
    assert "RF_magnetic" in spec["desired_modalities"]
    assert "material_state" in spec["desired_modalities"]
    assert spec["material_context"] == "hydrogel"
    assert spec["expression_host"] == "bacteria"
    assert spec["sensed_quantity_or_state"]  # the SENSED quantity is captured
    assert spec["objective_support"] == "supported"
    assert "sensed_quantity_or_state" in spec["decision_active_fields"]
    assert "temperature_range_C" in spec["handoff_only_fields"]
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

    # Retrying an identical cancelled run creates a fresh attempt id. The cancelled
    # worker can no longer overwrite the retry because the two attempts do not share a key.
    retry = client.post("/api/runs", json={"objective_text": DEMO})
    assert retry.status_code == 201
    assert retry.json()["run_id"] != run_id
    assert retry.json()["run_id"].endswith("_a1")
    assert client.get(f"/api/runs/{run_id}").json()["status"] == "cancelled"


def test_invalid_objective_surfaces_422(client: TestClient) -> None:
    r = client.post("/api/runs", json={"objective_text": ""})
    assert r.status_code == 422


def test_unsupported_sensing_target_is_explicit(client: TestClient) -> None:
    r = client.post("/api/runs", json={"objective_text": "Build a protein reporter for ambient temperature"})
    assert r.status_code == 422
    assert "Supported sensing targets" in r.json()["detail"]


def test_optical_spin_contrast_routes_to_triplet_fp(client: TestClient) -> None:
    # the ODMR / optical-spin sense maps to the triplet-FP optical-spin route only (a frontier
    # proxy route with no candidate-specific quantum chemistry), and the API gate accepts it.
    from app.contracts.enums import RouteClass
    from app.contracts.objective import ObjectiveSpec
    from app.retrieval.plan import _routes_for_objective

    obj = ObjectiveSpec(
        objective_id="odmr",
        objective_text="optical spin contrast sensing objective",
        sensed_quantity_or_state="optical spin contrast",
    )
    assert _routes_for_objective(obj) == [RouteClass.triplet_fp]
    r = client.post("/api/runs", json={"objective_text": "A GFP chip read out by optically detected magnetic resonance"})
    assert r.status_code != 422, r.json()


def test_seed_count_is_bounded(client: TestClient) -> None:
    spec = client.post("/api/objectives/compile", json={"objective_text": DEMO}).json()
    spec["seed_accessions"] = [f"P{i:05d}" for i in range(26)]
    r = client.post("/api/runs", json=spec)
    assert r.status_code == 422


def test_request_body_and_response_headers_are_hardened(client: TestClient) -> None:
    too_large = client.post("/api/runs", content="x" * 70_000, headers={"content-type": "application/json"})
    assert too_large.status_code == 413
    health = client.get("/api/health")
    assert health.headers["cache-control"] == "no-store"
    assert health.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in health.headers["content-security-policy"]


def test_terminal_run_cannot_be_revived_by_stale_worker() -> None:
    from datetime import datetime, timezone
    from app.contracts.objective import ObjectiveSpec
    from app.contracts.run import RunEvent, RunState

    now = datetime.now(timezone.utc)
    objective = ObjectiveSpec(
        objective_id="race",
        objective_text="Explore a magnetic field reporter",
        sensed_quantity_or_state="magnetic field",
    )
    queued = RunState(
        run_id="race", input_fingerprint="fp", objective=objective,
        created_at=now, updated_at=now,
        events=[RunEvent(at=now, to_status=RunStatus.queued, stage="queued")],
    )
    store = RunStore(":memory:")
    assert store.put_new(queued)
    cancelled = queued.model_copy(update={"status": RunStatus.cancelled, "current_stage": "cancelled"})
    assert store.put(cancelled)
    stale = queued.model_copy(update={"status": RunStatus.compiling_objective, "current_stage": "compiling_objective"})
    assert store.put(stale) is False
    assert store.get("race").status == RunStatus.cancelled


def test_missing_run_404(client: TestClient) -> None:
    assert client.get("/api/runs/run_doesnotexist").status_code == 404


def test_generative_frontier_preview_is_honest() -> None:
    """The de novo 'unmade' lane is a labelled preview: invented, deterministic, and carrying
    NO sequence and NO coordinates. It must never fabricate a real or orderable candidate."""
    from app.contracts.objective import ObjectiveSpec
    from app.design import generate_previews

    spec = ObjectiveSpec(
        objective_id="o",
        objective_text="Explore a weak magnetic field reporter",
        sensed_quantity_or_state="magnetic field",
    )
    previews = generate_previews(spec)
    assert len(previews) == 3
    for p in previews:
        assert p.found_in_nature is False
        assert p.sequence_provided is False
        assert "magnetic field" in p.invented_for
        assert "not validated" in p.note.lower() and "not an orderable sequence" in p.note.lower()
        # a preview carries no sequence/coordinate fields at all
        assert not hasattr(p, "sequence") and not hasattr(p, "coordinates")
    # deterministic: same objective → same previews (no randomness)
    assert [p.label for p in generate_previews(spec)] == [p.label for p in previews]
