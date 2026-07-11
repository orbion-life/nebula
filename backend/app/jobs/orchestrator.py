"""Run orchestrator.

Advances an immutable run along the state machine, doing REAL work at each stage:
compile → retrieve (UniProt query plans) → enrich (InterPro/RCSB/AlphaFold) →
assess physics eligibility (incl. bounded candidate-specific QM on real
isoalloxazine coordinates) → simulate → rank (two-lane Discovery Frontier) →
plan → completed. Cancellation is honored between stages.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..api.fixtures_static import INSTRUMENTS
from ..contracts.candidate import CandidateDossier, CandidateRecord, StructuralEvidence
from ..contracts.enums import PhysicsEligibilityKind, RunStatus
from ..contracts.run import RunEvent, RunState
from ..discovery import build_discovery
from ..physics.candidate_specific import run_candidate_qm
from ..physics.eligibility import assess_eligibility, upgrade_with_candidate_qm
from ..providers.rcsb import RcsbProvider
from ..retrieval.assemble import assemble_candidates
from ..retrieval.plan import plan_queries
from ..state.machine import assert_transition, progress_fraction
from .store import RunStore

# flavin comp-ids whose presence in a PDB entry makes it worth pulling coordinates
_FLAVIN_COMPS = {"FMN", "FAD", "FDA", "6FA", "FADH", "RBF", "FNR"}
# Bound on candidate-specific QM subprocess calls per run. UHF/6-31G on the ~18-atom
# isoalloxazine takes ~2 min, so we run it on ONE candidate (the best flavin-bound
# structure) — real candidate-specific physics without an unbounded run time.
_MAX_CANDIDATE_QM = 1
_QM_BASIS = "6-31g"       # physical spin density (sto-3g overshoots via Mulliken)
_QM_TIMEOUT_S = 200.0     # 6-31G on 18 atoms ≈ 116 s; generous margin before kill


def _instrument(instrument_id: str | None) -> dict:
    for i in INSTRUMENTS:
        if i["id"] == instrument_id:
            return i
    return INSTRUMENTS[0]  # default: benchtop field fluorimeter


def _best_flavin_pdb(cand: CandidateRecord) -> str | None:
    """The experimental, flavin-bound PDB with the best (lowest) resolution — the
    only kind of structure that can donate real isoalloxazine coordinates."""
    best: tuple[float, str] | None = None
    for e in cand.pdb_entries:
        comps = {c.upper() for c in (e.nonpolymer_bound_components or [])}
        if not comps & _FLAVIN_COMPS:
            continue
        res = min(e.resolution_combined) if e.resolution_combined else 99.0
        if best is None or res < best[0]:
            best = (res, e.rcsb_id)
    return best[1] if best else None


def _advance(run: RunState, to: RunStatus, stage: str, note: str) -> RunState:
    assert_transition(run.status, to)
    now = datetime.now(timezone.utc)
    return run.model_copy(update={
        "status": to,
        "current_stage": stage,
        "updated_at": now,
        "events": [*run.events, RunEvent(at=now, from_status=run.status, to_status=to, stage=stage, note=note, progress=progress_fraction(to))],
    })


def _cancelled(store: RunStore, run_id: str) -> bool:
    cur = store.get(run_id)
    return cur is not None and cur.status == RunStatus.cancelled


def orchestrate(run_id: str, store: RunStore, *, offline: bool = True, per_route: int = 6) -> RunState | None:
    run = store.get(run_id)
    if run is None or run.status != RunStatus.queued:
        return run

    try:
        run = _advance(run, RunStatus.compiling_objective, "compiling_objective", "objective compiled to ObjectiveSpec")
        store.put(run)
        if _cancelled(store, run_id):
            return store.get(run_id)

        # retrieve + enrich
        run = _advance(run, RunStatus.retrieving_evidence, "retrieving_evidence", "planning mechanism-route queries and retrieving public proteins")
        store.put(run)
        plans = plan_queries(run.objective, per_route=per_route)

        # stream each real accession into the run as it is assembled, so the UI (and the
        # candidate universe) fills in live during retrieval rather than in one batch.
        streamed: list = []

        def _on_candidate(cand) -> None:
            streamed.append(cand)
            acc = cand.uniprot.primary_accession if cand.uniprot else cand.candidate_id
            now = datetime.now(timezone.utc)
            cur = store.get(run_id)
            if cur is None or cur.status != RunStatus.retrieving_evidence:
                return
            store.put(cur.model_copy(update={
                "candidates": list(streamed),
                "updated_at": now,
                "events": [*cur.events, RunEvent(at=now, from_status=RunStatus.retrieving_evidence, to_status=RunStatus.retrieving_evidence, stage="retrieving_evidence", note=f"retrieved {acc} ({cand.route_class.value})", progress=progress_fraction(RunStatus.retrieving_evidence))],
            }))

        candidates = assemble_candidates(plans, offline=offline, per_route=per_route, on_candidate=_on_candidate)
        run = store.get(run_id) or run  # pick up the streamed candidates/events
        provider_calls = [p for c in candidates for p in c.provenance]
        run = run.model_copy(update={
            "candidates": candidates,
            "provider_calls": provider_calls,
            "updated_at": datetime.now(timezone.utc),
            "events": [*run.events, RunEvent(at=datetime.now(timezone.utc), from_status=RunStatus.retrieving_evidence, to_status=RunStatus.retrieving_evidence, stage="retrieving_evidence", note=f"assembled {len(candidates)} real-accession candidate(s) across {len(plans)} route plan(s)", progress=progress_fraction(RunStatus.retrieving_evidence))],
        })
        store.put(run)
        if _cancelled(store, run_id):
            return store.get(run_id)

        # physics eligibility gate + partial dossiers
        run = _advance(run, RunStatus.assessing_physics, "assessing_physics", "computing per-candidate physics eligibility (gate, not prediction)")
        eligs = {c.candidate_id: assess_eligibility(c) for c in candidates}

        # candidate-specific QM: extract THIS protein's isoalloxazine from its best
        # flavin-bound experimental structure and run a real subprocess QM. Bounded to
        # the single best-resolution flavin candidate. Best-effort: any failure (no
        # structure, offline with no coords fixture, non-convergence, timeout) leaves
        # the honest generic template in place.
        targets: list[tuple[float, str, str]] = []  # (resolution, candidate_id, pdb_id)
        for cand in candidates:
            if eligs[cand.candidate_id].kind is not PhysicsEligibilityKind.qm_cluster_assumption:
                continue
            pdb_id = _best_flavin_pdb(cand)
            if pdb_id is None:
                continue
            res = min((min(e.resolution_combined) for e in cand.pdb_entries
                       if e.rcsb_id == pdb_id and e.resolution_combined), default=99.0)
            targets.append((res, cand.candidate_id, pdb_id))
        targets.sort(key=lambda t: t[0])  # best (lowest) resolution first
        rcsb = RcsbProvider(offline=offline)
        for _res, cand_id, pdb_id in targets[:_MAX_CANDIDATE_QM]:
            now = datetime.now(timezone.utc)
            run = run.model_copy(update={
                "updated_at": now,
                "events": [*run.events, RunEvent(at=now, from_status=RunStatus.assessing_physics, to_status=RunStatus.assessing_physics, stage="assessing_physics", note=f"running candidate-specific {_QM_BASIS.upper()} quantum chemistry on the isoalloxazine core extracted from {pdb_id} (~2 min)", progress=progress_fraction(RunStatus.assessing_physics))],
            })
            store.put(run)
            try:
                cif_text, _prov = rcsb.coordinates(pdb_id)
                qm = run_candidate_qm(pdb_id, cif_text, basis=_QM_BASIS, timeout=_QM_TIMEOUT_S)
            except Exception:
                qm = None
            if qm is not None:
                eligs[cand_id] = upgrade_with_candidate_qm(eligs[cand_id], qm)

        dossiers: list[CandidateDossier] = []
        for cand in candidates:
            dossiers.append(CandidateDossier(
                dossier_id=f"dossier_{cand.candidate_id}",
                candidate=cand,
                physics_eligibility=eligs[cand.candidate_id],
                structural_evidence=StructuralEvidence(pdb_entries=cand.pdb_entries, alphafold_model=cand.alphafold_model),
                claim_ceiling=cand.claim_ceiling,
            ))
        computed = sum(1 for d in dossiers if d.physics_eligibility.enters_computed_ranking)
        candidate_specific = sum(1 for d in dossiers if d.physics_eligibility.qm_cluster_plan and d.physics_eligibility.qm_cluster_plan.candidate_specific)
        run = run.model_copy(update={
            "dossiers": dossiers,
            "updated_at": datetime.now(timezone.utc),
            "events": [*run.events, RunEvent(at=datetime.now(timezone.utc), from_status=RunStatus.assessing_physics, to_status=RunStatus.assessing_physics, stage="assessing_physics", note=f"{computed}/{len(dossiers)} candidate(s) eligible for computed physics; {candidate_specific} with candidate-specific QM on real coordinates", progress=progress_fraction(RunStatus.assessing_physics))],
        })
        store.put(run)
        if _cancelled(store, run_id):
            return store.get(run_id)

        # simulate (measurability under the instrument) — the artifact-backed signature
        run = _advance(run, RunStatus.simulating, "simulating", "computing measurability of each candidate under the chosen instrument")
        store.put(run)

        # rank: two-lane discovery (evidence vs frontier), Pareto + quality-diversity
        run = _advance(run, RunStatus.ranking, "ranking", "Discovery Frontier: separating evidence and frontier lanes")
        instrument = _instrument(run.instrument_id)
        scores, evidence_shortlist, frontier = build_discovery(candidates, dossiers, instrument=instrument, objective=run.objective)
        run = run.model_copy(update={
            "discovery_scores": scores,
            "evidence_shortlist": evidence_shortlist,
            "frontier_experiments": frontier,
            "updated_at": datetime.now(timezone.utc),
        })
        store.put(run)
        if _cancelled(store, run_id):
            return store.get(run_id)

        # plan + complete: pick the decisive next experiment (top evidence, else top frontier)
        run = _advance(run, RunStatus.planning, "planning", "selecting the decisive next measurement")
        selected = evidence_shortlist[0] if evidence_shortlist else (frontier[0].candidate_id if frontier else None)
        run = run.model_copy(update={"selected_candidate_id": selected})
        run = _advance(
            run, RunStatus.completed, "completed",
            f"evidence lane: {len(evidence_shortlist)} candidate(s); frontier lane: {len(frontier)} experiment(s); selected {selected}",
        )
        store.put(run)
        return run

    except Exception as exc:  # honest failure with the reason surfaced
        cur = store.get(run_id) or run
        if cur.status == RunStatus.cancelled:
            return cur
        now = datetime.now(timezone.utc)
        failed = cur.model_copy(update={
            "status": RunStatus.failed,
            "current_stage": "failed",
            "updated_at": now,
            "errors": [*cur.errors, f"{type(exc).__name__}: {exc}"],
            "events": [*cur.events, RunEvent(at=now, from_status=cur.status, to_status=RunStatus.failed, stage="failed", note=str(exc)[:200], progress=1.0)],
        })
        store.put(failed)
        return failed
