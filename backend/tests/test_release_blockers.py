"""Regression coverage for scientific-trust and lifecycle release blockers."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api import main
from app.contracts.enums import ReadoutMode, RouteClass, RunStatus
from app.contracts.objective import ObjectiveSpec, RawObjective
from app.contracts.run import RunState
from app.jobs.orchestrator import orchestrate
from app.jobs.fingerprint import input_fingerprint
from app.jobs.store import RunStore
from app.objective.compile import compile_objective
from app.retrieval.plan import plan_queries
from app.discovery.scoring import weighted_utility
from app.contracts.discovery import DiscoveryScore


def _objective(**updates) -> ObjectiveSpec:
    base = ObjectiveSpec(
        objective_id="release-audit",
        objective_text="Sense a weak magnetic field using an optical protein readout.",
        sensed_quantity_or_state="magnetic field",
        desired_modalities=[ReadoutMode.fluorescence],
        objective_support="supported",
        seed_accessions=["Q43125", "Q8LPD9"],
    )
    return base.model_copy(update=updates)


def _queued(run_id: str, objective: ObjectiveSpec) -> RunState:
    now = datetime.now(timezone.utc)
    return RunState(
        run_id=run_id,
        input_fingerprint=f"fp-{run_id}",
        status=RunStatus.queued,
        objective=objective,
        created_at=now,
        updated_at=now,
    )


def _completed_store(objective: ObjectiveSpec) -> tuple[RunStore, RunState]:
    store = RunStore(":memory:")
    run = _queued("release-run", objective)
    assert store.put_new(run)
    result = orchestrate(run.run_id, store, offline=True)
    assert result is not None and result.status == RunStatus.completed
    return store, result


def test_parser_does_not_confuse_rfp_with_rf() -> None:
    compiled = compile_objective(RawObjective(objective_text="Build an RFP reporter for light history."))
    assert compiled.sensed_quantity_or_state == "light history"
    assert compiled.objective_support == "supported"


def test_parser_accepts_hyphenated_radio_frequency() -> None:
    compiled = compile_objective(RawObjective(objective_text="Sense a radio-frequency field with fluorescence."))
    assert compiled.sensed_quantity_or_state == "radio-frequency field"


def test_parser_does_not_treat_commercial_potential_as_redox() -> None:
    compiled = compile_objective(RawObjective(objective_text="Assess commercial potential of a protein film."))
    assert compiled.sensed_quantity_or_state is None
    assert compiled.objective_support == "needs_clarification"


def test_parser_requires_one_primary_sensing_target() -> None:
    compiled = compile_objective(RawObjective(objective_text="Sense magnetic field and redox potential optically."))
    assert compiled.sensed_quantity_or_state is None
    assert compiled.objective_support == "needs_clarification"
    assert "magnetic field" in compiled.objective_support_note
    assert "redox potential" in compiled.objective_support_note


def test_excluded_cofactor_removes_its_routes() -> None:
    routes = [p.route_class for p in plan_queries(_objective(excluded_cofactors=["FAD"]))]
    assert RouteClass.cryptochrome_fad_radical_pair not in routes
    assert RouteClass.lov_flavin_radical_pair in routes


def test_completed_run_can_only_receive_bounded_design_enrichment() -> None:
    store = RunStore(":memory:")
    completed = _queued("completed", _objective()).model_copy(update={"status": RunStatus.completed})
    assert store.put_new(completed)
    assert store.enrich_completed("completed", generative_frontier=[], updated_at=datetime.now(timezone.utc))
    assert store.get("completed").status == RunStatus.completed  # type: ignore[union-attr]
    try:
        store.enrich_completed("completed", selected_candidate_id="forbidden")
    except ValueError:
        pass
    else:
        raise AssertionError("completed-run enrichment accepted an unapproved field")


def test_semantically_equivalent_objective_order_has_one_fingerprint() -> None:
    a = _objective(optimization_objectives=[("developability", 0.5), ("information_gain", 0.5)])
    b = _objective(optimization_objectives=[("information_gain", 0.5), ("developability", 0.5)])
    assert input_fingerprint(a, a.seed, a.instrument_id) == input_fingerprint(b, b.seed, b.instrument_id)


def test_optimization_weights_change_ordering_utility() -> None:
    score = DiscoveryScore.model_construct(
        D_developability=0.9,
        IG_information_gain=0.2,
        P_plausibility=0.5,
        M_measurability=0.5,
        N_novelty=0.5,
        U_uncertainty=0.5,
        C_cost=0.5,
    )
    assert weighted_utility(score, [("developability", 1.0)], 0.0) == 0.9
    assert weighted_utility(score, [("information_gain", 1.0)], 0.0) == 0.2


def test_no_candidates_is_a_failed_run(monkeypatch) -> None:
    store = RunStore(":memory:")
    run = _queued("empty", _objective())
    assert store.put_new(run)
    monkeypatch.setattr("app.jobs.orchestrator.assemble_candidates", lambda *args, **kwargs: [])
    result = orchestrate(run.run_id, store, offline=True)
    assert result is not None
    assert result.status == RunStatus.failed
    assert result.current_stage == "no_candidates"
    assert result.errors and "No public candidates" in result.errors[-1]


def test_q43125_does_not_label_unrelated_6qtw_ligands_as_fad() -> None:
    store, run = _completed_store(_objective(seed_accessions=["Q43125"]))
    main.STORE = store
    main.OFFLINE = True
    client = TestClient(main.app)
    candidate = next(c for c in run.candidates if c.route_class == RouteClass.cryptochrome_fad_radical_pair)
    response = client.get(f"/api/candidates/{candidate.candidate_id}/structure")
    # Abstaining is correct when no full candidate/cofactor structure is available offline.
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        body = response.json()
        assert body["pdb_id"] != "6QTW"
        assert body["verified_ligand_comp_id"] is None


def test_q8lpd9_structure_verifies_fmn_before_highlighting() -> None:
    store, run = _completed_store(_objective(seed_accessions=["Q8LPD9"]))
    main.STORE = store
    main.OFFLINE = True
    client = TestClient(main.app)
    candidate = next(c for c in run.candidates if c.route_class == RouteClass.lov_flavin_radical_pair)
    response = client.get(f"/api/candidates/{candidate.candidate_id}/structure")
    assert response.status_code == 200
    body = response.json()
    assert body["pdb_id"] == "1N9O"
    assert body["verified_ligand_comp_id"] == "FMN"
    assert body["verified_ligand_name"] == "FMN"


def test_optical_spin_route_has_a_real_offline_fluorescent_protein() -> None:
    objective = _objective(
        objective_text="Prioritize a fluorescent protein for optical spin contrast measurement.",
        sensed_quantity_or_state="optical spin contrast",
        desired_modalities=[ReadoutMode.odmr_like, ReadoutMode.fluorescence, ReadoutMode.lifetime],
        acceptable_readouts=[ReadoutMode.odmr_like, ReadoutMode.fluorescence, ReadoutMode.lifetime],
        seed_accessions=["P42212"],
    )
    store, run = _completed_store(objective)
    assert run.status == RunStatus.completed
    assert [c.uniprot.primary_accession for c in run.candidates] == ["P42212"]
    assert run.candidates[0].route_class == RouteClass.triplet_fp
    assert run.candidates[0].pdb_entries[0].rcsb_id == "1B9C"
    assert run.discovery_scores[0].suggested_instrument_id == "odmr_confocal"
    assert run.measurement_proposals[0].discriminating_experiment.instrument_id == "odmr_confocal"
    assert "RF" in run.measurement_proposals[0].discriminating_experiment.what_to_measure
