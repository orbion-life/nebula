"""Run orchestrator.

Advances an immutable run along the state machine, doing REAL work at each stage:
compile → retrieve (UniProt query plans) → enrich (InterPro/RCSB/AlphaFold) →
assess physics eligibility. Cancellation is honored between stages. Simulation +
ranking + planning (→ completed) are added in the next increments; the run
honestly stops at `assessing_physics` today with real candidates + dossiers.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..contracts.candidate import CandidateDossier, StructuralEvidence
from ..contracts.enums import RunStatus
from ..contracts.run import RunEvent, RunState
from ..physics.eligibility import assess_eligibility
from ..retrieval.assemble import assemble_candidates
from ..retrieval.plan import plan_queries
from ..state.machine import assert_transition, progress_fraction
from .store import RunStore


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
        candidates = assemble_candidates(plans, offline=offline, per_route=per_route)
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
        dossiers: list[CandidateDossier] = []
        for cand in candidates:
            elig = assess_eligibility(cand)
            dossiers.append(CandidateDossier(
                dossier_id=f"dossier_{cand.candidate_id}",
                candidate=cand,
                physics_eligibility=elig,
                structural_evidence=StructuralEvidence(pdb_entries=cand.pdb_entries, alphafold_model=cand.alphafold_model),
                claim_ceiling=cand.claim_ceiling,
            ))
        computed = sum(1 for d in dossiers if d.physics_eligibility.enters_computed_ranking)
        run = run.model_copy(update={
            "dossiers": dossiers,
            "updated_at": datetime.now(timezone.utc),
            "events": [*run.events, RunEvent(at=datetime.now(timezone.utc), from_status=RunStatus.assessing_physics, to_status=RunStatus.assessing_physics, stage="assessing_physics", note=f"{computed}/{len(dossiers)} candidate(s) eligible for computed physics; simulation + ranking land in the next increment", progress=progress_fraction(RunStatus.assessing_physics))],
        })
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
