"""Phase 8 tests: candidate / dossier / structure endpoints over a completed run."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api import main
from app.contracts.enums import ReadoutMode, RunStatus
from app.contracts.objective import ObjectiveSpec
from app.contracts.run import RunEvent, RunState
from app.jobs.orchestrator import orchestrate
from app.jobs.store import RunStore


def _completed_store() -> tuple[RunStore, RunState]:
    store = RunStore(":memory:")
    obj = ObjectiveSpec(
        objective_id="o_p8", objective_text="magnetic optical hydrogel sensor",
        desired_modalities=[ReadoutMode.rf_magnetic], seed_accessions=["Q43125"],
    )
    now = datetime.now(timezone.utc)
    run = RunState(run_id="run_p8", input_fingerprint="fp_p8", status=RunStatus.queued,
                   seed=obj.seed, objective=obj, current_stage="queued",
                   created_at=now, updated_at=now, offline=True,
                   events=[RunEvent(at=now, to_status=RunStatus.queued, stage="queued")])
    store.put(run)
    result = orchestrate("run_p8", store, offline=True)
    assert result is not None and result.status == RunStatus.completed
    return store, result


def _client(store: RunStore) -> TestClient:
    main.STORE = store  # module global consulted by the endpoints
    main.OFFLINE = True
    return TestClient(main.app)


def test_candidate_and_dossier_endpoints() -> None:
    store, run = _completed_store()
    client = _client(store)
    cid = run.dossiers[0].candidate.candidate_id

    r = client.get(f"/api/candidates/{cid}")
    assert r.status_code == 200
    assert r.json()["candidate_id"] == cid
    assert r.json()["private_candidate"] is False

    d = client.get(f"/api/candidates/{cid}/dossier")
    assert d.status_code == 200
    body = d.json()
    assert body["candidate"]["candidate_id"] == cid
    assert body["status"] == "public_hypothesis_not_validated"
    assert body["disclaimers"]  # honesty disclaimers travel with the dossier


def test_unknown_candidate_is_404() -> None:
    store, _ = _completed_store()
    client = _client(store)
    assert client.get("/api/candidates/does_not_exist").status_code == 404
    assert client.get("/api/candidates/does_not_exist/dossier").status_code == 404


def test_structure_endpoint_shape() -> None:
    store, run = _completed_store()
    client = _client(store)
    cid = run.dossiers[0].candidate.candidate_id
    r = client.get(f"/api/candidates/{cid}/structure")
    # a structure may or may not exist offline; if it does, it must name a source + url
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        body = r.json()
        assert body["source"] in ("experimental_pdb", "alphafold_prediction")
        assert body["provider_url"].startswith("http")
        assert body["format"] == "mmcif"
