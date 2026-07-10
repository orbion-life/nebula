"""Physics eligibility + plan contracts.

`PhysicsEligibility` is a GATE, not a prediction. It encodes the hard boundary
that sequence/structure never *determine* spin response — they only decide
whether a candidate's route can be parameterized for a synthetic, assumption-
derived calculation, and by which method.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .enums import PhysicsEligibilityKind, RouteClass
from .provenance import ParameterProvenance


class QmClusterPlan(BaseModel):
    """A PySCF open-shell single-point plan on a truncated public cofactor cluster.

    Budget envelope is MEASURED, not guessed (recon): ~14 heavy atoms = 30 s at
    6-31G*, 8 s at 6-31G, 1.6 s at sto-3g. Full flavin is intractable → truncate.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)
    core: str = "isoalloxazine"
    heavy_atom_estimate: int
    basis: Literal["sto-3g", "6-31G", "6-31G*"] = "6-31G"
    method: Literal["UHF", "ROHF"] = "UHF"
    spin: int = 1
    charge: int = 0
    est_wall_seconds: float
    tractable_under_60s: bool
    truncation_note: str = (
        "ribityl/phosphate tail truncated to an N10-methyl cap; dangling bonds H-capped "
        "(standard QM-cluster truncation). Assumption-derived; not a whole-protein claim."
    )


class SpinDynamicsPlan(BaseModel):
    """References the offline RadicalPy artifact; no per-protein spin claim."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    artifact_ref: str  # e.g. "radical_pair_mary.v1@<contentHash[:12]>"
    hamiltonian_terms: list[str] = Field(
        default_factory=lambda: ["Zeeman(B0)", "isotropic hyperfine", "Haberkorn recombination", "relaxation"],
    )
    note: str = "spin dynamics of a model flavin-based radical pair; a calibration reference, not a candidate-specific prediction"


class PhysicsEligibility(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    candidate_id: str
    route_class: RouteClass
    kind: PhysicsEligibilityKind
    has_required_cofactor: bool
    cofactor_id: str | None = None
    spin_dynamics_plan: SpinDynamicsPlan | None = None
    qm_cluster_plan: QmClusterPlan | None = None
    offline_budget_seconds: int = 0
    reason: str
    label: Literal["assumption_derived_not_whole_protein_spin_response"] = (
        "assumption_derived_not_whole_protein_spin_response"
    )
    assumptions: list[ParameterProvenance] = Field(default_factory=list)

    @property
    def enters_computed_ranking(self) -> bool:
        return self.kind in (
            PhysicsEligibilityKind.real_spin_dynamics,
            PhysicsEligibilityKind.qm_cluster_assumption,
        )
