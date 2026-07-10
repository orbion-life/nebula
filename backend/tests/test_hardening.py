"""Panel-driven hardening tests — enforce the honesty boundaries, not just document them.

1. A converged candidate-specific QM must NOT change plausibility (computation ≠ validation).
2. Proxy routes carry NO fabricated signal amplitude — measurability is a binary
   observability gate, identical across proxy routes (no magic magnitude sets ranking).
3. get_structure serves inline coordinates offline for a candidate-specific candidate.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api import main
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
from app.discovery.capability import extract_capability
from app.discovery.ladder import assign_exploration
from app.discovery.mechanism import compose_graph
from app.discovery.scoring import ScoreInputs, score_one
from app.jobs.orchestrator import orchestrate
from app.jobs.store import RunStore
from app.physics.candidate_specific import CandidateQm
from app.physics.eligibility import assess_eligibility, upgrade_with_candidate_qm

BENCH = next(i for i in main.INSTRUMENTS if i["id"] == "benchtop_field_fluorimeter")
CONFOCAL = next(i for i in main.INSTRUMENTS if i["id"] == "odmr_confocal")


def _cand(acc: str, route: RouteClass, scaffold: ScaffoldFamily, cofactors, readouts, controls) -> CandidateRecord:
    return CandidateRecord(
        candidate_id=f"c_{acc}_{route.value}", title=acc, scaffold_family=scaffold,
        architecture_kind=ArchitectureKind.single_scaffold,
        uniprot=UniProtRecord(primary_accession=acc, reviewed=True, protein_name=acc, sequence_length=400, cofactors=cofactors),
        cofactors=cofactors, readout_modes=readouts, mechanism_route_id=f"r_{route.value}",
        route_class=route, required_controls=controls, generated_by="test",
    )


def _inputs(cand: CandidateRecord, elig=None) -> ScoreInputs:
    cap = extract_capability(cand)
    graph = compose_graph(cand.candidate_id, cand.route_class, cap)
    reason, novelty = assign_exploration(cand.route_class, cap, graph)
    return ScoreInputs(candidate=cand, capability=cap, graph=graph,
                       eligibility=elig or assess_eligibility(cand), reason=reason, novelty=novelty)


FAD = [CofactorRef(name="FAD", chebi_id="CHEBI:57692")]


def _fake_qm() -> CandidateQm:
    return CandidateQm(pdb_id="1N9O", ligand="FMN", chain="A", n_atoms=18, n_heavy=17,
                       converged=True, energy_hartree=-773.9, max_abs_spin=1.07, n_spin_sites=3,
                       basis="6-31g", wall_seconds=9.0, note="x")


def test_candidate_specific_qm_does_not_change_plausibility() -> None:
    cand = _cand("Q00000", RouteClass.cryptochrome_fad_radical_pair, ScaffoldFamily.cryptochrome_fad,
                 FAD, [ReadoutMode.fluorescence, ReadoutMode.rf_magnetic], ["dark control"])
    generic = assess_eligibility(cand)
    upgraded = upgrade_with_candidate_qm(generic, _fake_qm())
    assert generic.qm_cluster_plan.candidate_specific is False
    assert upgraded.qm_cluster_plan.candidate_specific is True
    p_generic = score_one(_inputs(cand, generic), BENCH, set())[0].P_plausibility
    p_upgraded = score_one(_inputs(cand, upgraded), BENCH, set())[0].P_plausibility
    # a converged single-point UHF proves parameterizability, NOT that the protein hosts a
    # functional radical pair — it must not lift plausibility.
    assert p_upgraded == p_generic


def test_proxy_routes_have_no_fabricated_amplitude() -> None:
    triplet = _cand("P1", RouteClass.triplet_fp, ScaffoldFamily.fluorescent_protein,
                    [CofactorRef(name="intrinsic chromophore")], [ReadoutMode.fluorescence, ReadoutMode.odmr_like],
                    ["RF off/on control"])
    redox = _cand("P2", RouteClass.redox_electrochemical, ScaffoldFamily.redox_flavoprotein, FAD,
                  [ReadoutMode.redox_electrochemical, ReadoutMode.fluorescence], ["redox titration"])
    assert assess_eligibility(triplet).kind is PhysicsEligibilityKind.analytic_proxy_only
    m_triplet = score_one(_inputs(triplet), CONFOCAL, set())[0].M_measurability
    m_redox = score_one(_inputs(redox), CONFOCAL, set())[0].M_measurability
    # both proxy routes get the SAME coarse observability gate — no per-route magic number
    assert m_triplet == m_redox == 0.5
    # and the scoring module holds no hardcoded proxy amplitude table anymore
    import app.discovery.scoring as scoring
    assert not hasattr(scoring, "_PROXY_SIGNATURE")


def _completed_offline_store() -> tuple[RunStore, RunState]:
    store = RunStore(":memory:")
    obj = ObjectiveSpec(objective_id="o", objective_text="magnetic optical flavin sensor",
                        desired_modalities=[ReadoutMode.rf_magnetic, ReadoutMode.fluorescence],
                        seed_accessions=["Q8LPD9", "Q43125"])
    now = datetime.now(timezone.utc)
    run = RunState(run_id="r_hard", input_fingerprint="fp", status=RunStatus.queued, seed=obj.seed,
                   objective=obj, current_stage="queued", created_at=now, updated_at=now, offline=True,
                   events=[RunEvent(at=now, to_status=RunStatus.queued, stage="queued")])
    store.put(run)
    r = orchestrate("r_hard", store, offline=True)
    assert r is not None and r.status == RunStatus.completed
    return store, r


def test_qm_cache_key_pinned_to_committed_coords() -> None:
    # The offline demo depends on a committed QM cache entry keyed by the 1N9O geometry +
    # worker hash. If coords_1N9O.cif or the worker changes, this FAILS in CI (rather than
    # silently reintroducing the ~3-min recompute / timeout-to-None that drops the QM badge).
    from pathlib import Path

    import app
    from app.physics.candidate_specific import _QM_CACHE, _cache_key
    from app.physics.cluster import extract_isoalloxazine

    cif = (Path(app.__file__).resolve().parent / "providers" / "fixtures" / "rcsb" / "coords_1N9O.cif").read_text()
    atoms, charge, spin, _note, _lig, _chain = extract_isoalloxazine(cif)
    req = {"atoms": atoms, "charge": charge, "spin": spin, "basis": "6-31g", "max_cycle": 200, "pdb_id": "1N9O"}
    key = _cache_key(req)
    assert (_QM_CACHE / f"{key}.json").exists(), (
        f"committed QM cache miss for 1N9O key {key} — coords_1N9O.cif or qm_worker.py changed; "
        "re-run scripts/index/build_offline_index.py and commit the refreshed cache"
    )


def test_offline_run_is_deterministic() -> None:
    _, r1 = _completed_offline_store()
    _, r2 = _completed_offline_store()
    assert r1.selected_candidate_id == r2.selected_candidate_id
    assert r1.evidence_shortlist == r2.evidence_shortlist
    s1 = {s.candidate_id: (s.P_plausibility, s.M_measurability, s.D_developability) for s in r1.discovery_scores}
    s2 = {s.candidate_id: (s.P_plausibility, s.M_measurability, s.D_developability) for s in r2.discovery_scores}
    assert s1 == s2  # same seed + fixtures + cache → identical ranking


def test_structure_endpoint_serves_inline_coords_offline() -> None:
    store, run = _completed_offline_store()
    main.STORE = store
    main.OFFLINE = True
    client = TestClient(main.app)
    # the candidate-specific Q8LPD9 LOV candidate must render offline (inline 1N9O mmCIF)
    cid = "cand_Q8LPD9_LOV_flavin_radical_pair"
    r = client.get(f"/api/candidates/{cid}/structure")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "experimental_pdb"
    assert body["pdb_id"] == "1N9O"
    assert body["inline_cif"] and len(body["inline_cif"]) > 1000
