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
    # honest ambiguity is surfaced
    assert any("sensitivity" in m for m in spec["missing_information"])


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
    assert client.get(f"/api/runs/{run_id}/events").json()[0]["to_status"] == "queued"
    # cancel
    cancelled = client.post(f"/api/runs/{run_id}/cancel")
    assert cancelled.json()["status"] == "cancelled"


def test_invalid_objective_surfaces_422(client: TestClient) -> None:
    r = client.post("/api/runs", json={"objective_text": ""})
    assert r.status_code == 422


def test_missing_run_404(client: TestClient) -> None:
    assert client.get("/api/runs/run_doesnotexist").status_code == 404
