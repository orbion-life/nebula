"""Phase-3 tests: query planning, eligibility gate, and a real orchestrated run."""
from __future__ import annotations

from datetime import datetime, timezone

from app.contracts.candidate import CandidateRecord
from app.contracts.enums import (
    ArchitectureKind,
    PhysicsEligibilityKind,
    ReadoutMode,
    RouteClass,
    RunStatus,
    ScaffoldFamily,
)
from app.contracts.objective import ObjectiveSpec
from app.contracts.providers import CofactorRef, UniProtRecord
from app.contracts.run import RunEvent, RunState
from app.jobs.orchestrator import orchestrate
from app.jobs.store import RunStore
from app.physics.eligibility import assess_eligibility
from app.retrieval.plan import plan_queries
from app.retrieval.assemble import assemble_candidates


def _cand(route: RouteClass, cofactors: list[CofactorRef]) -> CandidateRecord:
    return CandidateRecord(
        candidate_id=f"c_{route.value}",
        title="test",
        scaffold_family=ScaffoldFamily.cryptochrome_fad,
        architecture_kind=ArchitectureKind.single_scaffold,
        cofactors=cofactors,
        mechanism_route_id="route_x",
        route_class=route,
        generated_by="test",
    )


def test_eligibility_gate() -> None:
    fad = [CofactorRef(name="FAD", chebi_id="CHEBI:57692")]
    # RP + flavin -> computed-eligible
    e1 = assess_eligibility(_cand(RouteClass.cryptochrome_fad_radical_pair, fad))
    assert e1.kind == PhysicsEligibilityKind.qm_cluster_assumption
    assert e1.enters_computed_ranking and e1.qm_cluster_plan is not None
    # RP without flavin -> ineligible, excluded from computed ranking
    e2 = assess_eligibility(_cand(RouteClass.cryptochrome_fad_radical_pair, []))
    assert e2.kind == PhysicsEligibilityKind.ineligible and not e2.enters_computed_ranking
    # triplet FP -> exploration lane only (proxy), never computed shortlist
    e3 = assess_eligibility(_cand(RouteClass.triplet_fp, []))
    assert e3.kind == PhysicsEligibilityKind.analytic_proxy_only and not e3.enters_computed_ranking


def test_query_planning_selects_rp_routes_for_magnetic() -> None:
    obj = ObjectiveSpec(objective_id="o1", objective_text="magnetic optical sensor",
                        desired_modalities=[ReadoutMode.rf_magnetic, ReadoutMode.fluorescence])
    plans = plan_queries(obj)
    classes = {p.route_class for p in plans}
    assert RouteClass.cryptochrome_fad_radical_pair in classes
    assert RouteClass.lov_flavin_radical_pair in classes
    for p in plans:
        assert p.lucene_query and "reviewed:true" in p.lucene_query  # reviewed-first


def test_seed_accessions_are_not_relabelled_across_routes() -> None:
    obj = ObjectiveSpec(
        objective_id="routes",
        objective_text="Explore a magnetic field reporter",
        sensed_quantity_or_state="magnetic field",
        desired_modalities=[ReadoutMode.rf_magnetic, ReadoutMode.fluorescence],
        seed_accessions=["Q8LPD9", "Q43125"],
    )
    candidates = assemble_candidates(plan_queries(obj), offline=True)
    pairs = {(c.uniprot.primary_accession, c.route_class) for c in candidates if c.uniprot}
    assert pairs == {
        ("Q8LPD9", RouteClass.lov_flavin_radical_pair),
        ("Q43125", RouteClass.cryptochrome_fad_radical_pair),
    }


def test_every_supported_offline_target_has_route_consistent_public_candidates() -> None:
    expected = {
        "magnetic field": {
            ("Q8LPD9", RouteClass.lov_flavin_radical_pair),
            ("Q43125", RouteClass.cryptochrome_fad_radical_pair),
        },
        "radio-frequency field": {
            ("Q8LPD9", RouteClass.lov_flavin_radical_pair),
            ("Q43125", RouteClass.cryptochrome_fad_radical_pair),
        },
        "redox potential": {("P28861", RouteClass.redox_electrochemical)},
        "light history": {("Q8LPD9", RouteClass.rfp_flavin_photochemical)},
    }
    seeds = ["Q8LPD9", "Q43125", "P28861"]
    for sensed, wanted in expected.items():
        obj = ObjectiveSpec(
            objective_id=f"matrix_{sensed}",
            objective_text=f"Explore a protein reporter for {sensed}",
            sensed_quantity_or_state=sensed,
            seed_accessions=seeds,
        )
        candidates = assemble_candidates(plan_queries(obj), offline=True)
        observed = {(c.uniprot.primary_accession, c.route_class) for c in candidates if c.uniprot}
        assert observed == wanted


def _queued_run(objective: ObjectiveSpec) -> RunState:
    now = datetime.now(timezone.utc)
    return RunState(
        run_id="run_test1", input_fingerprint="fp1", status=RunStatus.queued,
        seed=objective.seed, objective=objective, current_stage="queued",
        created_at=now, updated_at=now, offline=True,
        events=[RunEvent(at=now, to_status=RunStatus.queued, stage="queued")],
    )


def test_offline_run_yields_real_accession_candidate() -> None:
    store = RunStore(":memory:")
    obj = ObjectiveSpec(
        objective_id="o2", objective_text="magnetic optical hydrogel sensor",
        desired_modalities=[ReadoutMode.rf_magnetic],
        seed_accessions=["Q43125"],  # real cryptochrome (offline fixture)
    )
    run = _queued_run(obj)
    store.put(run)
    result = orchestrate("run_test1", store, offline=True)
    assert result is not None
    # the run now completes end-to-end through the two-lane discovery
    assert result.status == RunStatus.completed
    # a REAL public accession, not a template family
    accs = {c.uniprot.primary_accession for c in result.candidates if c.uniprot}
    assert "Q43125" in accs
    # the cryptochrome/FAD candidate is computed-eligible (flavin present)
    cry = next(d for d in result.dossiers if d.candidate.route_class == RouteClass.cryptochrome_fad_radical_pair)
    assert cry.physics_eligibility.enters_computed_ranking
    # a known cryptochrome recovers on the EVIDENCE lane (Phase 3.5)
    assert cry.candidate.candidate_id in result.evidence_shortlist
    assert cry.candidate.status == "public_hypothesis_not_validated"
    assert cry.candidate.private_candidate is False
    # provenance recorded (fixture mode offline)
    assert result.provider_calls and result.provider_calls[0].mode.value in ("fixture", "cached", "live")


def test_odmr_sense_scores_against_rf_capable_instrument() -> None:
    # measurement is an OUTPUT: with no pinned instrument, an optical-spin-contrast (ODMR)
    # objective must score measurability against an RF-capable bench, or every triplet-FP
    # candidate reads as unmeasurable and drops out of both lanes. Other senses keep the
    # benchtop default so their ranking is unchanged.
    from app.jobs.orchestrator import _scoring_instrument

    odmr = _scoring_instrument(_queued_run(ObjectiveSpec(
        objective_id="o", objective_text="optical spin contrast demo objective",
        sensed_quantity_or_state="optical spin contrast")))
    assert odmr["rf_available"] is True
    mag = _scoring_instrument(_queued_run(ObjectiveSpec(
        objective_id="o2", objective_text="magnetic field demo objective",
        sensed_quantity_or_state="magnetic field")))
    assert mag["id"] == "benchtop_field_fluorimeter"


def test_orchestrate_respects_cancellation() -> None:
    store = RunStore(":memory:")
    run = _queued_run(ObjectiveSpec(
        objective_id="o3",
        objective_text="Explore a magnetic field reporter",
        sensed_quantity_or_state="magnetic field",
        seed_accessions=["Q43125"],
    ))
    cancelled = run.model_copy(update={"status": RunStatus.cancelled})
    store.put(cancelled)
    result = orchestrate("run_test1", store, offline=True)  # queued check fails -> no-op
    assert result is not None and result.status == RunStatus.cancelled
