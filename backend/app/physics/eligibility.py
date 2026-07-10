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
from ..contracts.physics import PhysicsEligibility, QmClusterPlan, SpinDynamicsPlan

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
                spin=1, charge=0, est_wall_seconds=8.0, tractable_under_60s=True,
            ),
            spin_dynamics_plan=SpinDynamicsPlan(artifact_ref=_artifact_ref()),
            offline_budget_seconds=30,
            reason="flavin cofactor present; isoalloxazine core is truncatable to a ~16-heavy-atom QM cluster (UHF/6-31G, ~8 s). Assumption-derived; the model-flavin spin-dynamics artifact is a calibration reference only.",
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
