"""Phase 3.5 tests: two-lane discovery + the hard invariants."""
from __future__ import annotations

from app.api.fixtures_static import INSTRUMENTS
from app.contracts.candidate import CandidateDossier, CandidateRecord, StructuralEvidence
from app.contracts.enums import (
    ArchitectureKind,
    KnowledgeStateKind,
    PrimitiveKind,
    ReadoutMode,
    RouteClass,
    ScaffoldFamily,
)
from app.contracts.mechanism import KnowledgeState, MechanismGraph, MechanismPrimitive
from app.contracts.objective import ObjectiveSpec
from app.contracts.providers import CofactorRef, UniProtRecord
from app.discovery.capability import extract_capability
from app.discovery.ladder import assign_exploration
from app.discovery.lanes import build_discovery
from app.discovery.mechanism import compose_graph
from app.discovery.scoring import ScoreInputs, score_one
from app.jobs.fingerprint import component_versions, input_fingerprint
from app.physics.eligibility import assess_eligibility

BENCH = next(i for i in INSTRUMENTS if i["id"] == "benchtop_field_fluorimeter")
CONFOCAL = next(i for i in INSTRUMENTS if i["id"] == "odmr_confocal")
DESIRED = {ReadoutMode.rf_magnetic, ReadoutMode.fluorescence}


def _cand(acc: str, route: RouteClass, scaffold: ScaffoldFamily, cofactors: list[CofactorRef],
          readouts: list[ReadoutMode], controls: list[str]) -> CandidateRecord:
    return CandidateRecord(
        candidate_id=f"cand_{acc}_{route.value}", title=f"{acc} — {scaffold.value}",
        scaffold_family=scaffold, architecture_kind=ArchitectureKind.single_scaffold,
        uniprot=UniProtRecord(primary_accession=acc, reviewed=True, protein_name=acc, sequence_length=400, cofactors=cofactors),
        cofactors=cofactors, readout_modes=readouts, mechanism_route_id=f"route_{route.value}",
        route_class=route, required_controls=controls, generated_by=f"test {acc}",
    )


def _dossier(cand: CandidateRecord) -> CandidateDossier:
    return CandidateDossier(
        dossier_id=f"d_{cand.candidate_id}", candidate=cand,
        physics_eligibility=assess_eligibility(cand),
        structural_evidence=StructuralEvidence(pdb_entries=cand.pdb_entries, alphafold_model=cand.alphafold_model),
    )


FAD = [CofactorRef(name="FAD", chebi_id="CHEBI:57692")]
FMN = [CofactorRef(name="FMN", chebi_id="CHEBI:57618")]

CRY = _cand("Q43125", RouteClass.cryptochrome_fad_radical_pair, ScaffoldFamily.cryptochrome_fad, FAD,
            [ReadoutMode.fluorescence, ReadoutMode.rf_magnetic], ["Illuminated no-field control", "Oxygen level control"])
REDOX = _cand("P00000", RouteClass.redox_electrochemical, ScaffoldFamily.redox_flavoprotein, FAD,
              [ReadoutMode.redox_electrochemical, ReadoutMode.fluorescence], ["Redox titration control", "pH control"])
TRIPLET = _cand("P11111", RouteClass.triplet_fp, ScaffoldFamily.fluorescent_protein,
                [CofactorRef(name="intrinsic chromophore")], [ReadoutMode.fluorescence, ReadoutMode.odmr_like],
                ["RF off/on paired control", "Oxygen control"])
METAL = _cand("P22222", RouteClass.metal_cofactor_confounder, ScaffoldFamily.metal_cofactor,
              [CofactorRef(name="heme")], [ReadoutMode.fluorescence], ["Apo (metal-free) control"])


def _obj() -> ObjectiveSpec:
    return ObjectiveSpec(objective_id="o", objective_text="magnetic optical sensor",
                         desired_modalities=[ReadoutMode.rf_magnetic, ReadoutMode.fluorescence])


def test_known_cryptochrome_recovers_on_evidence_lane() -> None:
    cands = [CRY]
    _, evidence, frontier, _ = build_discovery(cands, [_dossier(CRY)], instrument=BENCH, objective=_obj())
    assert CRY.candidate_id in evidence


def test_family_distant_candidate_enters_only_frontier() -> None:
    cands = [CRY, REDOX]
    _, evidence, frontier, _ = build_discovery(cands, [_dossier(c) for c in cands], instrument=BENCH, objective=_obj())
    fids = {f.candidate_id for f in frontier}
    assert REDOX.candidate_id in fids            # out-of-family redox → frontier
    assert REDOX.candidate_id not in evidence     # never on the evidence lane
    assert CRY.candidate_id in evidence           # known family stays evidence


def test_unparameterizable_excluded_from_both_lanes() -> None:
    # heme/metal with no flavin + no spin route → ineligible → excluded from computed lanes
    assert assess_eligibility(METAL).enters_computed_ranking is False
    _, evidence, frontier, _ = build_discovery([METAL], [_dossier(METAL)], instrument=CONFOCAL, objective=_obj())
    fids = {f.candidate_id for f in frontier}
    assert METAL.candidate_id not in evidence and METAL.candidate_id not in fids


def _inputs(cand: CandidateRecord, novelty: float) -> ScoreInputs:
    cap = extract_capability(cand)
    graph = compose_graph(cand.candidate_id, cand.route_class, cap)
    reason, _n = assign_exploration(cand.route_class, cap, graph)
    return ScoreInputs(candidate=cand, capability=cap, graph=graph, eligibility=assess_eligibility(cand),
                       reason=reason, novelty=novelty)


def test_novelty_never_increases_plausibility_or_performance() -> None:
    low = score_one(_inputs(CRY, 0.1), BENCH, DESIRED)[0]
    high = score_one(_inputs(CRY, 0.95), BENCH, DESIRED)[0]
    assert high.N_novelty > low.N_novelty
    # P (plausibility), M (measurability), D (developability) are novelty-independent
    assert high.P_plausibility == low.P_plausibility
    assert high.M_measurability == low.M_measurability
    assert high.D_developability == low.D_developability


def test_model_disagreement_raises_information_value_not_quality() -> None:
    base = _inputs(CRY, 0.4)
    known = MechanismGraph(graph_id="g_known", primitives=[
        MechanismPrimitive(kind=PrimitiveKind.excitation, detail="x", knowledge=KnowledgeState(state=KnowledgeStateKind.known)),
        MechanismPrimitive(kind=PrimitiveKind.fluorescence_readout, detail="r", knowledge=KnowledgeState(state=KnowledgeStateKind.known)),
    ], observable=ReadoutMode.fluorescence, complete=True)
    unknown = MechanismGraph(graph_id="g_unknown", primitives=[
        MechanismPrimitive(kind=PrimitiveKind.excitation, detail="x", knowledge=KnowledgeState(state=KnowledgeStateKind.unknown)),
        MechanismPrimitive(kind=PrimitiveKind.fluorescence_readout, detail="r", knowledge=KnowledgeState(state=KnowledgeStateKind.unknown)),
    ], observable=ReadoutMode.fluorescence, complete=True)
    s_known = score_one(ScoreInputs(base.candidate, base.capability, known, base.eligibility, base.reason, 0.4), BENCH, DESIRED)[0]
    s_unknown = score_one(ScoreInputs(base.candidate, base.capability, unknown, base.eligibility, base.reason, 0.4), BENCH, DESIRED)[0]
    assert s_unknown.U_uncertainty > s_known.U_uncertainty
    assert s_unknown.IG_information_gain > s_known.IG_information_gain   # disagreement → more to learn
    assert s_unknown.P_plausibility <= s_known.P_plausibility            # but NOT more plausible


def test_instrument_changes_measurability_and_selection() -> None:
    # triplet-FP needs RF: unobservable on the benchtop, frontier-eligible on the confocal
    obj = ObjectiveSpec(objective_id="o", objective_text="odmr sensor", desired_modalities=[ReadoutMode.odmr_like, ReadoutMode.fluorescence])
    _, _, f_bench, _ = build_discovery([TRIPLET], [_dossier(TRIPLET)], instrument=BENCH, objective=obj)
    _, _, f_conf, _ = build_discovery([TRIPLET], [_dossier(TRIPLET)], instrument=CONFOCAL, objective=obj)
    assert TRIPLET.candidate_id not in {f.candidate_id for f in f_bench}   # no RF → not measurable
    assert TRIPLET.candidate_id in {f.candidate_id for f in f_conf}        # RF → measurable → frontier


def test_reproducible_fingerprint_includes_versions() -> None:
    obj = _obj()
    fp1 = input_fingerprint(obj, 1337, None)
    fp2 = input_fingerprint(obj, 1337, None)
    assert fp1 == fp2                                  # same inputs+versions+seed → same identity
    assert input_fingerprint(obj, 4242, None) != fp1   # seed is part of identity
    assert component_versions()["pipeline_source"] not in ("", "source-unavailable")


def test_measurement_scenario_varies_by_route() -> None:
    scores, _, _, _ = build_discovery(
        [CRY, REDOX, TRIPLET],
        [_dossier(CRY), _dossier(REDOX), _dossier(TRIPLET)],
        instrument=CONFOCAL,
        objective=_obj(),
    )
    by_id = {score.candidate_id: score.suggested_instrument_id for score in scores}
    assert by_id[CRY.candidate_id] == "benchtop_field_fluorimeter"
    assert by_id[REDOX.candidate_id] == "potentiostat_optical_bench"
    assert by_id[TRIPLET.candidate_id] == "odmr_confocal"


def test_redox_handoff_uses_potential_not_field_rf_language() -> None:
    from app.discovery.lanes import _experiment

    experiment = _experiment(REDOX, ReadoutMode.redox_electrochemical, "potentiostat_optical_bench")
    joined = " ".join([
        experiment.what_to_measure,
        experiment.expected_signature,
        experiment.null_expectation,
        experiment.kill_criterion,
    ]).lower()
    assert "applied potential" in joined
    assert "field/rf" not in joined
    assert "rf-off" not in joined


def test_every_frontier_hypothesis_has_falsifier_and_plan() -> None:
    cands = [CRY, REDOX]
    _, _, frontier, _ = build_discovery(cands, [_dossier(c) for c in cands], instrument=CONFOCAL, objective=_obj())
    assert frontier  # at least one frontier experiment
    for f in frontier:
        assert f.falsifier.strip()
        assert f.discriminating_experiment.kill_criterion.strip()
        assert f.discriminating_experiment.what_to_measure.strip()
