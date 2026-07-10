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


def test_orchestrate_respects_cancellation() -> None:
    store = RunStore(":memory:")
    run = _queued_run(ObjectiveSpec(objective_id="o3", objective_text="x", seed_accessions=["Q43125"]))
    cancelled = run.model_copy(update={"status": RunStatus.cancelled})
    store.put(cancelled)
    result = orchestrate("run_test1", store, offline=True)  # queued check fails -> no-op
    assert result is not None and result.status == RunStatus.cancelled
