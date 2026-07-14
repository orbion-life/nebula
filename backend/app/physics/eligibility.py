"""Physics-eligibility gate.

Decides, per candidate, whether its route can be parameterized for a synthetic,
assumption-derived calculation — and by which method. This is a GATE, never a
prediction: sequence/structure never *determine* spin response. Only
`real_spin_dynamics` and `qm_cluster_assumption` may enter the computed ranking;
proxy/ineligible go to the exploration lane or are excluded with reasons.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..contracts.candidate import CandidateRecord
from ..contracts.enums import PhysicsEligibilityKind, RouteClass
from ..contracts.physics import (
    MagneticFieldEffectScenario,
    MagneticFieldEffectSensitivity,
    PhysicsEligibility,
    QmClusterPlan,
    RadicalPairModel,
    SpinDynamicsPlan,
)

_ARTIFACT = Path(__file__).resolve().parents[3] / "src" / "data" / "generated" / "radical_pair_mary.v1.json"

_RP_ROUTES = {RouteClass.lov_flavin_radical_pair, RouteClass.cryptochrome_fad_radical_pair}
_PROXY_ROUTES = {RouteClass.triplet_fp, RouteClass.rfp_flavin_photochemical, RouteClass.redox_electrochemical}

# flavin cofactors that make a radical-pair route physically parameterizable
_FLAVIN_CHEBI = {"57692", "57618", "58210"}  # FAD, FMN, FADH•/reduced forms
_FLAVIN_NAMES = ("fad", "fmn", "flavin", "riboflavin")


def _has_flavin(candidate: CandidateRecord) -> bool:
    for c in candidate.cofactors:
        if c.chebi_id and any(x in c.chebi_id for x in _FLAVIN_CHEBI):
            return True
        if c.name and any(n in c.name.lower() for n in _FLAVIN_NAMES):
            return True
    return False


def _artifact_ref() -> str:
    try:
        d = json.loads(_ARTIFACT.read_text())
        return f"radical_pair_mary.{d['schemaVersion']}@{d['contentHash'][:12]}"
    except Exception:
        return "radical_pair_mary.v1@unavailable"


def _cofactor_id(candidate: CandidateRecord) -> str | None:
    for c in candidate.cofactors:
        if c.chebi_id:
            return c.chebi_id
    return candidate.cofactors[0].name if candidate.cofactors else None


def upgrade_with_candidate_qm(elig: PhysicsEligibility, qm) -> PhysicsEligibility:
    """Flip an eligibility to genuinely candidate-specific once a subprocess QM has
    run on THIS protein's extracted isoalloxazine coordinates (qm: CandidateQm)."""
    if elig.qm_cluster_plan is None:
        return elig
    plan = elig.qm_cluster_plan.model_copy(update={
        "candidate_specific": True,
        "heavy_atom_estimate": qm.n_heavy,
        "est_wall_seconds": qm.wall_seconds,
        "geometry_source": f"isoalloxazine extracted from {qm.pdb_id} {qm.ligand} chain {qm.chain} (this protein's real coordinates)",
    })
    return elig.model_copy(update={
        "qm_cluster_plan": plan,
        "assumptions": [*elig.assumptions, qm.provenance()],
        "reason": elig.reason
        + f" | CANDIDATE-SPECIFIC: UHF/{qm.basis} on this protein's {qm.ligand} isoalloxazine from {qm.pdb_id} "
        + f"(converged={qm.converged}, max Mulliken spin {qm.max_abs_spin} over {qm.n_spin_sites} sites, {qm.wall_seconds}s).",
    })


def upgrade_with_radical_pair(elig: PhysicsEligibility, rp) -> PhysicsEligibility:
    """Attach the per-protein radical-pair model (partner + geometry-derived J, D) computed from THIS
    protein's structure. rp is a RadicalPair dataclass from physics.radical_pair; partner identity,
    separation, J and D become per-protein, while the hyperfine stays class-level (Tier 1 territory)."""
    from .radical_pair_response import estimate_mfe

    mfe = estimate_mfe(
        rp.dipolar_d_mT,
        rp.exchange_j_mT,
    )  # coarse RadicalPy estimate, cached; None if unavailable
    mfe_pct = mfe.get("mfe_amplitude_percent") if mfe else None
    mfe_sensitivity = None
    if mfe:
        mfe_sensitivity = MagneticFieldEffectSensitivity(
            field_range_mT=mfe["field_range_mT"],
            lower_percent=mfe["lower_percent"],
            baseline_percent=mfe["mfe_amplitude_percent"],
            upper_percent=mfe["upper_percent"],
            scenarios=[MagneticFieldEffectScenario(**row) for row in mfe["scenarios"]],
            fields_mT=mfe["fields_mT"],
            lower_curve_percent=mfe["lower_curve_percent"],
            baseline_curve_percent=mfe["baseline_curve_percent"],
            upper_curve_percent=mfe["upper_curve_percent"],
        )
    model = RadicalPairModel(
        partner_residue=rp.partner_residue,
        partner_kind=rp.partner_kind,
        chain_residues=list(rp.chain_residues),
        separation_angstrom=rp.separation_angstrom,
        exchange_j_mT=rp.exchange_j_mT,
        dipolar_d_mT=rp.dipolar_d_mT,
        magnetic_field_effect_percent=mfe_pct,
        magnetic_field_effect=mfe_sensitivity,
    )
    reason = (
        elig.reason
        + f" | RADICAL PAIR: electron-transfer partner {rp.partner_residue} at {rp.separation_angstrom} A; "
        + f"D={rp.dipolar_d_mT:.3f} mT (point dipole, well constrained by the separation), J~{rp.exchange_j_mT:.1e} mT "
        + "(tunnelling estimate, order-of-magnitude only, usually taken small)."
    )
    if mfe_pct is not None:
        reason += (
            f" RadicalPy kinetic-sensitivity envelope {mfe['lower_percent']}–{mfe['upper_percent']}% "
            f"over 0–{mfe['field_range_mT']} mT ({len(mfe['scenarios'])} named J/rate scenarios; candidate D "
            "and geometry-derived starting J, class-level hyperfine, no environment or optical transduction). This is not a validated "
            "response prediction or a working-sensor claim."
        )
    reason += " Partner, separation and D are per-protein; hyperfine is still class-level."
    return elig.model_copy(update={"radical_pair": model, "reason": reason})


def assess_eligibility(candidate: CandidateRecord) -> PhysicsEligibility:
    rc = candidate.route_class
    has_cofactor = bool(candidate.cofactors)
    cofactor_id = _cofactor_id(candidate)

    if rc in _RP_ROUTES:
        if not _has_flavin(candidate):
            return PhysicsEligibility(
                candidate_id=candidate.candidate_id, route_class=rc,
                kind=PhysicsEligibilityKind.ineligible, has_required_cofactor=False,
                reason="radical-pair route requires a flavin cofactor (FAD/FMN) that is not annotated for this accession; excluded from computed ranking.",
            )
        # eligible for a candidate-specific QM-cluster parameterization; the model-flavin
        # artifact is attached as a calibration REFERENCE (not a per-protein prediction).
        return PhysicsEligibility(
            candidate_id=candidate.candidate_id, route_class=rc,
            kind=PhysicsEligibilityKind.qm_cluster_assumption,
            has_required_cofactor=True, cofactor_id=cofactor_id,
            qm_cluster_plan=QmClusterPlan(
                core="isoalloxazine", heavy_atom_estimate=16, basis="6-31G", method="UHF",
                spin=1, charge=0, est_wall_seconds=165.0, tractable_under_60s=False,
                candidate_specific=False,  # upgraded only after a converged structure-extracted run
            ),
            spin_dynamics_plan=SpinDynamicsPlan(artifact_ref=_artifact_ref()),
            offline_budget_seconds=200,
            reason="flavin cofactor present; a generic isoalloxazine UHF/6-31G plan is eligible. It becomes candidate-specific only if the orchestrator extracts bound-flavin coordinates and the bounded subprocess converges. The model-flavin spin-dynamics artifact remains a calibration reference only.",
        )

    if rc in _PROXY_ROUTES:
        return PhysicsEligibility(
            candidate_id=candidate.candidate_id, route_class=rc,
            kind=PhysicsEligibilityKind.analytic_proxy_only,
            has_required_cofactor=has_cofactor, cofactor_id=cofactor_id,
            reason="no candidate-specific spin-dynamics artifact for this route; scored in the EXPLORATION lane on measurement value, barred from the computed physics shortlist.",
        )

    return PhysicsEligibility(
        candidate_id=candidate.candidate_id, route_class=rc,
        kind=PhysicsEligibilityKind.ineligible, has_required_cofactor=has_cofactor,
        reason="no spin-linked mechanism route applies; excluded from computed ranking.",
    )
