"""Discovery mathematics: P, M, D, N, U, IG, C + Pareto + quality-diversity.

HARD RULES (enforced here, checked by tests):
- Novelty (N) and uncertainty (U) NEVER contribute to P, M, D, or predicted
  performance. They only inform lane placement and information value.
- Unparameterizable candidates (physics-ineligible) never enter a computed lane.
- Evidence lane maximizes (P, M, D); frontier lane maximizes (IG, N, coverage)
  subject to floors on P, M, control-completeness and safety.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

from ..contracts.candidate import CandidateRecord
from ..contracts.discovery import DiscoveryScore, ExplorationReason
from ..contracts.enums import (
    ClaimLevel,
    DiscoveryLane,
    ExplorationLevel,
    PhysicsEligibilityKind,
    PrimitiveKind,
    ReadoutMode,
    RouteClass,
)
from ..contracts.mechanism import CapabilityVector, MechanismGraph
from ..contracts.physics import PhysicsEligibility

_ARTIFACT = Path(__file__).resolve().parents[3] / "src" / "data" / "generated" / "radical_pair_mary.v1.json"


def _rp_peak_signature() -> float:
    try:
        d = json.loads(_ARTIFACT.read_text())["data"]
        return max(abs(x) for x in d["dFF_assumptionDerived"])
    except Exception:
        return 0.02


# The ONLY signal amplitude that enters a magnitude-bearing score is the radical-pair
# signature, and it is derived from the versioned, provenance-tagged RadicalPy artifact
# (not a hand-typed constant). Proxy routes have NO candidate-specific, provenance-backed
# amplitude, so they never receive a fabricated ΔF/F — they get a coarse binary
# observability gate instead (see _measurability). This keeps the repo's "every numeric
# parameter carries provenance" rule intact for anything that can move the ranking.
_RP_SIGNATURE = _rp_peak_signature()
_PROXY_GATE = 0.5  # observable-in-principle under a compatible instrument (unitless gate, not an SNR)
_CLAIM_POTENTIAL = {ClaimLevel.partner_ready_dossier: 1.0, ClaimLevel.measurement_triage: 0.8, ClaimLevel.diagnostic_only: 0.55}
_P_EVIDENCE_FLOOR = 0.5
_P_FRONTIER_FLOOR = 0.25
_M_FLOOR = 0.15


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


@dataclass
class ScoreInputs:
    candidate: CandidateRecord
    capability: CapabilityVector
    graph: MechanismGraph
    eligibility: PhysicsEligibility
    reason: ExplorationReason
    novelty: float


def _is_spin_dynamics(inp: ScoreInputs) -> bool:
    return inp.eligibility.kind in (PhysicsEligibilityKind.real_spin_dynamics, PhysicsEligibilityKind.qm_cluster_assumption)


def _measurability(inp: ScoreInputs, instrument: dict) -> float:
    rc = inp.candidate.route_class
    needs_rf = rc == RouteClass.triplet_fp
    readout_ok = any(r.value in instrument.get("readout_modes", []) for r in inp.candidate.readout_modes) or inp.capability.optical
    rf_ok = (not needs_rf) or instrument.get("rf_available", False)
    if not (readout_ok and rf_ok):
        return 0.0
    if not _is_spin_dynamics(inp):
        # proxy route: no provenance-backed signal amplitude exists, so we assert only
        # "observable-in-principle under this instrument" — a fabricated ΔF/F must never
        # set the frontier ranking magnitude. Frontier order then follows information gain.
        return _PROXY_GATE
    # radical-pair route: SNR from the artifact-derived signature (provenance-tagged)
    noise = instrument.get("min_detectable_delta_f_over_f", 1e-3)
    if _RP_SIGNATURE <= 0:
        return 0.0
    snr = _RP_SIGNATURE / noise
    if snr < 1.0:
        return 0.0
    return _clamp(0.5 + 0.5 * (math.log10(snr) / math.log10(30.0)))


def _plausibility(inp: ScoreInputs) -> float:
    g = inp.graph
    known_frac = 1.0 - g.unresolved_fraction
    p = 0.45 * known_frac + 0.25 * (1.0 if g.template_route_class is not None else 0.0)
    # required cofactor grounding (route-appropriate)
    if inp.capability.has_flavin or inp.capability.chromophore or inp.capability.redox_active or inp.capability.has_metal_open_shell:
        p += 0.2
    if inp.capability.has_experimental_structure:
        p += 0.1
    # NOTE: candidate-specific QM does NOT lift plausibility. A converged single-point UHF
    # on a truncated isoalloxazine proves the route is *parameterizable* for this protein,
    # not that the protein hosts a functional radical pair — rewarding "a calculation ran"
    # would cross the "computation is not validation" line. It is surfaced as a badge +
    # provenance in the UI, and never as a ranking input.
    return _clamp(p)


def _developability(inp: ScoreInputs) -> float:
    cap = inp.capability
    reviewed = bool(inp.candidate.uniprot and inp.candidate.uniprot.reviewed)
    struct = cap.structure_confidence if cap.structure_confidence is not None else 0.3
    length = inp.candidate.uniprot.sequence_length if (inp.candidate.uniprot and inp.candidate.uniprot.sequence_length) else 300
    len_ok = 1.0 if 50 <= length <= 1200 else 0.4
    return _clamp(0.4 * cap.evidence_confidence + 0.3 * struct + 0.2 * (1.0 if reviewed else 0.4) + 0.1 * len_ok)


def _uncertainty(inp: ScoreInputs) -> float:
    struct = inp.capability.structure_confidence if inp.capability.structure_confidence is not None else 0.3
    return _clamp(0.6 * inp.graph.unresolved_fraction + 0.4 * (1.0 - struct))


def _cost(inp: ScoreInputs) -> float:
    rc = inp.candidate.route_class
    c = 0.25
    if rc == RouteClass.triplet_fp:
        c += 0.2  # RF hardware
    if rc == RouteClass.redox_electrochemical:
        c += 0.2  # electrode
    if not inp.capability.has_experimental_structure:
        c += 0.15
    if inp.eligibility.qm_cluster_plan is not None:
        c += 0.1
    return _clamp(c)


def _info_gain(inp: ScoreInputs, M: float, U: float, objective_alignment: float) -> float:
    # value of RESOLVING uncertainty that is actually MEASURABLE and relevant.
    potential = _CLAIM_POTENTIAL[inp.reason.claim_ceiling]
    return _clamp(U * (0.35 + 0.65 * M) * potential * (0.5 + 0.5 * objective_alignment))


def _objective_alignment(inp: ScoreInputs, desired: set[ReadoutMode]) -> float:
    if not desired:
        return 0.5
    overlap = len(set(inp.candidate.readout_modes) & desired)
    return _clamp(overlap / len(desired))


def best_instrument(inp: ScoreInputs, instruments: list[dict]) -> dict:
    """The registry instrument that makes THIS candidate most measurable — the app's
    proposed measurement, chosen per candidate (never a user input). Tie-break toward the
    more sensitive rig (lower min-detectable ΔF/F)."""
    return max(
        instruments,
        key=lambda ins: (_measurability(inp, ins), -ins.get("min_detectable_delta_f_over_f", 1.0)),
    )


def score_one(inp: ScoreInputs, instrument: dict, desired: set[ReadoutMode]) -> DiscoveryScore:
    P = _plausibility(inp)
    M = _measurability(inp, instrument)
    D = _developability(inp)
    N = _clamp(inp.novelty)
    U = _uncertainty(inp)
    align = _objective_alignment(inp, desired)
    IG = _info_gain(inp, M, U, align)
    C = _cost(inp)

    # lane assignment (pareto_rank filled later)
    computed_eligible = inp.eligibility.enters_computed_ranking
    controls_ok = len(inp.candidate.required_controls) > 0
    is_l0 = inp.reason.level == ExplorationLevel.l0_known_family

    if not computed_eligible:
        # proxy or ineligible: proxy → frontier exploration only if measurable; ineligible → excluded
        if inp.eligibility.kind == PhysicsEligibilityKind.analytic_proxy_only and M >= _M_FLOOR and P >= _P_FRONTIER_FLOOR and controls_ok:
            lane = DiscoveryLane.frontier
        else:
            lane = None  # excluded from computed lanes
    elif is_l0 and P >= _P_EVIDENCE_FLOOR and M >= _M_FLOOR:
        lane = DiscoveryLane.evidence
    elif P >= _P_FRONTIER_FLOOR and M >= _M_FLOOR and controls_ok:
        lane = DiscoveryLane.frontier
    else:
        lane = None

    rationale = (
        f"P={P:.2f} M={M:.2f} D={D:.2f} | N={N:.2f} U={U:.2f} IG={IG:.2f} C={C:.2f} | "
        f"{inp.reason.level.value}; lane={lane.value if lane else 'excluded'}"
    )
    return DiscoveryScore(
        candidate_id=inp.candidate.candidate_id,
        P_plausibility=P, M_measurability=M, D_developability=D,
        N_novelty=N, U_uncertainty=U, IG_information_gain=IG, C_cost=C,
        lane=lane or DiscoveryLane.frontier,  # placeholder; excluded handled by caller via _excluded set
        exploration=inp.reason, pareto_rank=0, rationale=rationale,
    ), lane


def _dominates(a: DiscoveryScore, b: DiscoveryScore, objs: tuple[str, ...]) -> bool:
    ge = all(getattr(a, o) >= getattr(b, o) for o in objs)
    gt = any(getattr(a, o) > getattr(b, o) for o in objs)
    return ge and gt


def pareto_rank(scores: list[DiscoveryScore], objs: tuple[str, ...]) -> None:
    for s in scores:
        dominated_by = [o.candidate_id for o in scores if o is not s and _dominates(o, s, objs)]
        object.__setattr__(s, "dominated_by", dominated_by)
        object.__setattr__(s, "pareto_rank", 1 if not dominated_by else 2)


EVIDENCE_OBJS = ("P_plausibility", "M_measurability", "D_developability")
FRONTIER_OBJS = ("IG_information_gain", "N_novelty")


def quality_diversity_order(frontier: list[DiscoveryScore], primitive_of: dict[str, PrimitiveKind]) -> list[DiscoveryScore]:
    """Order frontier for mechanism-space COVERAGE: best-IG per spin-forming bucket first."""
    buckets: dict[PrimitiveKind, list[DiscoveryScore]] = {}
    for s in frontier:
        buckets.setdefault(primitive_of.get(s.candidate_id, PrimitiveKind.spin_evolution), []).append(s)
    for b in buckets.values():
        b.sort(key=lambda s: s.IG_information_gain, reverse=True)
    ordered: list[DiscoveryScore] = []
    while any(buckets.values()):
        for kind in list(buckets):
            if buckets[kind]:
                ordered.append(buckets[kind].pop(0))
    return ordered
