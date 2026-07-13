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
    CandidateMeasurementProposal,
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
    weighted_utility,
)

_SPIN_PRIMITIVE = {
    RouteClass.lov_flavin_radical_pair: PrimitiveKind.radical_pair_formation,
    RouteClass.cryptochrome_fad_radical_pair: PrimitiveKind.radical_pair_formation,
    RouteClass.triplet_fp: PrimitiveKind.triplet_formation,
}


def _split_controls(candidate: CandidateRecord) -> tuple[list[str], list[str]]:
    controls = candidate.required_controls
    neg = [c for c in controls if any(k in c.lower() for k in (
        "no-field", "apo", "dark", "photobleach", "oxygen", "rf off", "rf on/off",
        "temperature", "electrode-only", "no-applied", "pH", "sham", "detuned",
    ))]
    pos = [c for c in controls if c not in neg]
    if candidate.route_class == RouteClass.redox_electrochemical:
        neg.append("Electrode-only and no-applied-potential controls")
    elif candidate.route_class == RouteClass.rfp_flavin_photochemical:
        neg.append("Matched illumination-dose photobleaching control")
    elif candidate.route_class in (RouteClass.lov_flavin_radical_pair, RouteClass.cryptochrome_fad_radical_pair):
        pos.append("Known photomagnetic reference measured through the same optical train")
        neg.extend([
            "Sham-coil control matched for current, heating, vibration, and timing",
            "Randomized field order with blinded analysis",
            "Cofactor-depleted or radical-partner perturbation control",
        ])
    elif candidate.route_class == RouteClass.triplet_fp:
        neg.extend([
            "RF-detuned control at matched power and heating",
            "Chromophore-dark or triplet-suppressed control",
            "Randomized RF order with blinded analysis",
        ])
    else:
        neg.append("Illuminated no-stimulus photobleaching control")
    return list(dict.fromkeys(pos)), list(dict.fromkeys(neg))


def _experiment(candidate: CandidateRecord, observable: ReadoutMode, instrument_id: str | None, sensed: str = "") -> DiscriminatingExperiment:
    rc = candidate.route_class
    pos, neg = _split_controls(candidate)
    is_rp = rc in (RouteClass.lov_flavin_radical_pair, RouteClass.cryptochrome_fad_radical_pair)
    if is_rp and sensed == "radio-frequency field":
        what = "ΔF/F versus RF frequency at a fixed weak static field (RYDMR)"
        expected = "a reproducible RF frequency dependent optical change distinct from photobleaching and oxygen effects"
        null = "no RF frequency dependent change beyond the matched nuisance controls"
        kill = "if the RF frequency response stays within the matched photobleaching and oxygen controls, reject this spin linked route for the scaffold"
        information = "tests whether the proposed radical pair route yields a control surviving RF frequency dependent optical signal"
        cost = "RF capable optical bench with interleaved controls"
        neg.append("RF-detuned control at matched power and heating")
    elif is_rp:
        what = "ΔF/F versus static magnetic field strength (MFE)"
        expected = "a reproducible static field dependent optical change distinct from photobleaching and oxygen effects"
        null = "no static field dependent change beyond the matched nuisance controls"
        kill = "if the static field response stays within the matched photobleaching and oxygen controls, reject this spin linked route for the scaffold"
        information = "tests whether the proposed radical pair route yields a control surviving static field dependent optical signal"
        cost = "field capable optical bench with interleaved controls"
    elif rc == RouteClass.triplet_fp:
        what = "fluorescence or lifetime contrast versus RF frequency and static field"
        expected = "a reproducible resonance-like feature that disappears in the RF-off or chromophore-dark control"
        null = "no RF-dependent feature beyond optical and temperature drift"
        kill = "if the feature persists in the RF off or chromophore dark controls, reject the triplet spin interpretation"
        information = "tests whether a triplet-state route produces a control-surviving, RF-dependent optical feature"
        cost = "RF-capable optical bench with field and temperature control"
    elif rc == RouteClass.redox_electrochemical:
        what = "electrochemical current and optional optical signal versus applied potential"
        expected = "a reproducible potential-dependent response separated from pH, oxygen, and electrode-background effects"
        null = "no potential-dependent response beyond electrode background and environmental controls"
        kill = "if electrode only, pH, or oxygen controls explain the response, reject this redox readout route for the scaffold"
        information = "tests whether the annotated flavin redox chemistry connects to a measurable potential-dependent readout"
        cost = "potentiostat with optical control channel"
    elif rc == RouteClass.rfp_flavin_photochemical:
        what = "fluorescence or lifetime after a defined illumination and dark-recovery sequence"
        expected = "a reproducible light-history-dependent state change distinct from cumulative photobleaching"
        null = "no history dependence after matching illumination dose and dark recovery"
        kill = "if matched dose photobleaching reproduces the signal, reject the proposed flavin light history route"
        information = "tests whether flavin photochemistry retains a reversible, measurable record of illumination history"
        cost = "programmable optical bench with dark-recovery timing"
    else:
        what = f"{observable.value.replace('_', ' ')} versus its controlled stimulus"
        expected = "a reproducible change that survives the route-specific controls"
        null = "no stimulus-dependent change beyond nuisance controls"
        kill = "if the matched controls reproduce the response, reject the proposed route for the scaffold"
        information = "tests whether the proposed route produces a control-surviving measurable response"
        cost = "route-compatible measurement bench"
    replicate_plan = "At least 3 independent preparations; interleave randomized stimulus and matched-control blocks; analyze blinded to block identity"
    acceptance_rule = (
        "Advance only if the preregistered response shape exceeds the 95% matched-control envelope "
        "in all 3 independent preparations; first measure the instrument blank to set the detectable-effect floor"
    )
    return DiscriminatingExperiment(
        what_to_measure=what,
        instrument_id=instrument_id,
        expected_signature=expected,
        null_expectation=null,
        positive_controls=pos,
        negative_controls=list(dict.fromkeys(neg)),
        replicate_plan=replicate_plan,
        acceptance_rule=acceptance_rule,
        kill_criterion=kill,
        information_gained=information,
        approx_cost=cost,
    )


def _instrument_for(sensed: str, inp: ScoreInputs) -> str:
    """Sensed-target-aware suggested instrument: a static-field MFE reads on a field fluorimeter,
    an RF sweep (RYDMR) needs an RF-capable confocal; otherwise pick the best-measurability rig."""
    if sensed in {"radio-frequency field", "optical spin contrast"}:
        return "odmr_confocal"
    if sensed == "magnetic field":
        return "benchtop_field_fluorimeter"
    return best_instrument(inp, INSTRUMENTS)["id"]


def build_discovery(
    candidates: list[CandidateRecord],
    dossiers: list[CandidateDossier],
    *,
    instrument: dict,
    objective: ObjectiveSpec,
) -> tuple[
    list[DiscoveryScore],
    list[str],
    list[FrontierExperiment],
    list[CandidateMeasurementProposal],
]:
    elig_by_id = {d.candidate.candidate_id: d.physics_eligibility for d in dossiers}
    desired = set(objective.desired_modalities)
    instrument_id = objective.instrument_id
    sensed = (objective.sensed_quantity_or_state or "").strip().lower()

    scored: list[tuple[ScoreInputs, DiscoveryScore, DiscoveryLane | None]] = []
    primitive_of: dict[str, PrimitiveKind] = {}
    for cand in candidates:
        elig = elig_by_id.get(cand.candidate_id)
        if elig is None:
            continue
        cap = extract_capability(cand)
        normalized_constraints = {c.strip().lower() for c in objective.hard_constraints}
        if "reviewed only" in normalized_constraints and not (cand.uniprot and cand.uniprot.reviewed):
            continue
        if "experimental structure required" in normalized_constraints and not cap.has_experimental_structure:
            continue
        if "fluorescence required" in normalized_constraints and ReadoutMode.fluorescence not in cand.readout_modes:
            continue
        if "lifetime required" in normalized_constraints and ReadoutMode.lifetime not in cand.readout_modes:
            continue
        graph = compose_graph(cand.candidate_id, cand.route_class, cap)
        reason, novelty = assign_exploration(cand.route_class, cap, graph)
        inp = ScoreInputs(candidate=cand, capability=cap, graph=graph, eligibility=elig, reason=reason, novelty=novelty)
        if "computed spin dynamics required" in normalized_constraints and not elig.enters_computed_ranking:
            continue
        score, lane = score_one(inp, instrument, desired)
        # measurement as OUTPUT: attach a sensed-target-aware instrument for THIS candidate (both lanes)
        score = score.model_copy(update={"suggested_instrument_id": _instrument_for(sensed, inp), "mechanism_graph": inp.graph})
        primitive_of[cand.candidate_id] = _SPIN_PRIMITIVE.get(cand.route_class, PrimitiveKind.metal_open_shell if cap.has_metal_open_shell else PrimitiveKind.spin_evolution)
        scored.append((inp, score, lane))

    evidence = [s for _, s, lane in scored if lane == DiscoveryLane.evidence]
    frontier = [s for _, s, lane in scored if lane == DiscoveryLane.frontier]
    pareto_rank(evidence, EVIDENCE_OBJS)
    pareto_rank(frontier, FRONTIER_OBJS)

    weights = objective.optimization_objectives
    evidence.sort(key=lambda s: (
        s.pareto_rank,
        -weighted_utility(s, weights, s.P_plausibility * s.M_measurability * s.D_developability),
    ))
    frontier = quality_diversity_order(
        frontier,
        primitive_of,
        utility=lambda s: weighted_utility(s, weights, s.IG_information_gain * max(s.N_novelty, 0.01)),
    )

    evidence_shortlist = [s.candidate_id for s in evidence]

    cand_by_id = {c.candidate_id: c for c in candidates}
    graph_obs = {inp.candidate.candidate_id: inp.graph.observable for inp, _, _ in scored}
    inp_by_id = {inp.candidate.candidate_id: inp for inp, _, _ in scored}
    discovery_scores = evidence + frontier
    measurement_proposals: list[CandidateMeasurementProposal] = []
    for s in discovery_scores:
        cand = cand_by_id[s.candidate_id]
        suggested_instrument = instrument_id or _instrument_for(sensed, inp_by_id[s.candidate_id])
        experiment = _experiment(
            cand,
            graph_obs.get(s.candidate_id, ReadoutMode.fluorescence),
            suggested_instrument,
            sensed,
        )
        measurement_proposals.append(CandidateMeasurementProposal(
            candidate_id=s.candidate_id,
            accession=cand.uniprot.primary_accession if cand.uniprot else s.candidate_id,
            title=cand.title,
            discriminating_experiment=experiment,
            falsifier=experiment.kill_criterion,
            claim_ceiling=s.exploration.claim_ceiling,
        ))

    proposal_by_id = {proposal.candidate_id: proposal for proposal in measurement_proposals}
    frontier_experiments: list[FrontierExperiment] = []
    for s in frontier:
        cand = cand_by_id[s.candidate_id]
        experiment = proposal_by_id[s.candidate_id].discriminating_experiment
        frontier_experiments.append(FrontierExperiment(
            candidate_id=s.candidate_id,
            accession=cand.uniprot.primary_accession if cand.uniprot else s.candidate_id,
            title=cand.title,
            outside_family_because=s.exploration.outside_family_because or "outside the canonical family arrangement",
            physical_constraints_satisfied=s.exploration.physical_constraints_satisfied,
            assumptions_remaining=s.exploration.assumptions_remaining,
            discriminating_experiment=experiment,
            falsifier=experiment.kill_criterion,
            score=s,
            claim_ceiling=s.exploration.claim_ceiling,
        ))

    return discovery_scores, evidence_shortlist, frontier_experiments, measurement_proposals
