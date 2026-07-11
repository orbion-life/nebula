"""Two-lane discovery assembly.

Turns real candidates + their physics eligibility into two strictly-separate
lanes: an evidence shortlist (known families, maximize P·M·D) and frontier
experiments (out-of-family but plausible + measurable, maximize IG·N·coverage).
Every frontier result carries its out-of-family reason, remaining assumptions,
the cheapest discriminating experiment, and a falsifier.
"""
from __future__ import annotations

from ..contracts.candidate import CandidateDossier, CandidateRecord
from ..contracts.discovery import (
    DiscoveryScore,
    DiscriminatingExperiment,
    FrontierExperiment,
)
from ..contracts.enums import DiscoveryLane, PrimitiveKind, ReadoutMode, RouteClass
from ..contracts.objective import ObjectiveSpec
from .capability import extract_capability
from .ladder import assign_exploration
from .mechanism import compose_graph
from ..api.fixtures_static import INSTRUMENTS
from .scoring import (
    EVIDENCE_OBJS,
    FRONTIER_OBJS,
    ScoreInputs,
    best_instrument,
    pareto_rank,
    quality_diversity_order,
    score_one,
)

_SPIN_PRIMITIVE = {
    RouteClass.lov_flavin_radical_pair: PrimitiveKind.radical_pair_formation,
    RouteClass.cryptochrome_fad_radical_pair: PrimitiveKind.radical_pair_formation,
    RouteClass.triplet_fp: PrimitiveKind.triplet_formation,
}


def _split_controls(controls: list[str]) -> tuple[list[str], list[str]]:
    neg = [c for c in controls if any(k in c.lower() for k in ("no-field", "apo", "reference", "dark", "photobleach"))]
    pos = [c for c in controls if c not in neg]
    neg = neg + ["Illuminated no-stimulus photobleach control (must stay flat)"]
    return pos, neg


def _experiment(candidate: CandidateRecord, observable: ReadoutMode, instrument_id: str | None) -> DiscriminatingExperiment:
    rc = candidate.route_class
    pos, neg = _split_controls(candidate.required_controls)
    is_rp = rc in (RouteClass.lov_flavin_radical_pair, RouteClass.cryptochrome_fad_radical_pair)
    what = ("ΔF/F vs static magnetic field (and vs RF frequency where available)" if is_rp
            else "fluorescence contrast vs RF frequency (ODMR)" if rc == RouteClass.triplet_fp
            else f"{observable.value.replace('_', ' ')} vs its controllable variable")
    return DiscriminatingExperiment(
        what_to_measure=what,
        instrument_id=instrument_id,
        expected_signature=("a small, non-monotonic ΔF/F (low-field dip → high-field rise) if the radical-pair coupling is real"
                            if is_rp else "a control-surviving change in the readout under the driven variable"),
        null_expectation="flat readout under the mandatory controls (no field/stimulus-dependent change beyond nuisance)",
        positive_controls=pos,
        negative_controls=neg,
        kill_criterion="if the readout is flat under photobleach + O2 (and no-field/RF-off) controls, the spin-linked mechanism is falsified for this scaffold.",
        information_gained="resolves whether this scaffold's proposed spin→optical coupling produces a measurable, control-surviving signal.",
        approx_cost=("RF-capable bench + interleaved acquisition" if (is_rp or rc == RouteClass.triplet_fp) else "standard optical/electrochemical bench"),
    )


def build_discovery(
    candidates: list[CandidateRecord],
    dossiers: list[CandidateDossier],
    *,
    instrument: dict,
    objective: ObjectiveSpec,
) -> tuple[list[DiscoveryScore], list[str], list[FrontierExperiment]]:
    elig_by_id = {d.candidate.candidate_id: d.physics_eligibility for d in dossiers}
    desired = set(objective.desired_modalities)
    instrument_id = objective.instrument_id

    scored: list[tuple[ScoreInputs, DiscoveryScore, DiscoveryLane | None]] = []
    primitive_of: dict[str, PrimitiveKind] = {}
    for cand in candidates:
        elig = elig_by_id.get(cand.candidate_id)
        if elig is None:
            continue
        cap = extract_capability(cand)
        graph = compose_graph(cand.candidate_id, cand.route_class, cap)
        reason, novelty = assign_exploration(cand.route_class, cap, graph)
        inp = ScoreInputs(candidate=cand, capability=cap, graph=graph, eligibility=elig, reason=reason, novelty=novelty)
        score, lane = score_one(inp, instrument, desired)
        # measurement as OUTPUT: attach the best-matching instrument for THIS candidate (both lanes)
        score = score.model_copy(update={"suggested_instrument_id": best_instrument(inp, INSTRUMENTS)["id"]})
        primitive_of[cand.candidate_id] = _SPIN_PRIMITIVE.get(cand.route_class, PrimitiveKind.metal_open_shell if cap.has_metal_open_shell else PrimitiveKind.spin_evolution)
        scored.append((inp, score, lane))

    evidence = [s for _, s, lane in scored if lane == DiscoveryLane.evidence]
    frontier = [s for _, s, lane in scored if lane == DiscoveryLane.frontier]
    pareto_rank(evidence, EVIDENCE_OBJS)
    pareto_rank(frontier, FRONTIER_OBJS)

    evidence.sort(key=lambda s: (s.pareto_rank, -(s.P_plausibility * s.M_measurability * s.D_developability)))
    frontier = quality_diversity_order(frontier, primitive_of)

    evidence_shortlist = [s.candidate_id for s in evidence]

    cand_by_id = {c.candidate_id: c for c in candidates}
    graph_obs = {inp.candidate.candidate_id: inp.graph.observable for inp, _, _ in scored}
    inp_by_id = {inp.candidate.candidate_id: inp for inp, _, _ in scored}
    frontier_experiments: list[FrontierExperiment] = []
    for s in frontier:
        cand = cand_by_id[s.candidate_id]
        # measurement is an OUTPUT the app proposes: pick the best-matching instrument from the
        # registry for THIS candidate (an explicit expert override still wins if one was set).
        suggested_instrument = instrument_id or best_instrument(inp_by_id[s.candidate_id], INSTRUMENTS)["id"]
        frontier_experiments.append(FrontierExperiment(
            candidate_id=s.candidate_id,
            accession=cand.uniprot.primary_accession if cand.uniprot else s.candidate_id,
            title=cand.title,
            outside_family_because=s.exploration.outside_family_because or "outside the canonical family arrangement",
            physical_constraints_satisfied=s.exploration.physical_constraints_satisfied,
            assumptions_remaining=s.exploration.assumptions_remaining,
            discriminating_experiment=_experiment(cand, graph_obs.get(s.candidate_id, ReadoutMode.fluorescence), suggested_instrument),
            falsifier="flat, control surviving readout across the field/RF/stimulus sweep falsifies the proposed mechanism for this scaffold.",
            score=s,
            claim_ceiling=s.exploration.claim_ceiling,
        ))

    discovery_scores = evidence + frontier
    return discovery_scores, evidence_shortlist, frontier_experiments
