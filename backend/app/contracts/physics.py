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
    # HONEST: today the plan is a GENERIC flavin-core template shared by every
    # flavin protein. It becomes candidate_specific only once the protein's real
    # coordinates, charge, multiplicity, protonation, donor/acceptor geometry and
    # environment actually enter the calculation (Phase 4).
    candidate_specific: bool = False
    geometry_source: str = "canonical isoalloxazine core (generic template; not extracted from this protein's structure yet)"
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


class RadicalPairModel(BaseModel):
    """Per-protein radical-pair geometry + geometry-derived couplings (Tier 0).

    The electron-transfer partner (terminal Trp/Tyr) and inter-radical separation are read from THIS
    protein's real structure; the exchange (J) and dipolar (D) couplings are the standard closed forms
    of that separation. So the radical-pair model is per-protein in four inputs the generic template
    fixed: partner identity, separation, J and D. Two honest limits stay explicit: the hyperfine
    couplings are still class-level (not computed on this geometry) and NO spin-dynamics yield or
    magnetic response is predicted. Parameter derivation only, assumption-derived, never a sensor claim.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)
    partner_residue: str
    partner_kind: Literal["tryptophan", "tyrosine"]
    chain_residues: list[str] = Field(default_factory=list)
    separation_angstrom: float
    exchange_j_mT: float
    dipolar_d_mT: float
    method_note: str = (
        "electron-transfer partner from this protein's aromatic hopping chain (light Beratan-Onuchic "
        "heuristic; eMap/pyemap is the fuller tool). D from the point dipole is well constrained by the "
        "separation; J from the Moser et al. 1992 tunnelling decay is order-of-magnitude only (the real "
        "exchange is poorly constrained and usually taken small). Geometry-derived and assumption-derived; "
        "hyperfine is still class-level and no spin-dynamics yield is predicted."
    )


class PhysicsEligibility(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    candidate_id: str
    route_class: RouteClass
    kind: PhysicsEligibilityKind
    has_required_cofactor: bool
    cofactor_id: str | None = None
    spin_dynamics_plan: SpinDynamicsPlan | None = None
    qm_cluster_plan: QmClusterPlan | None = None
    radical_pair: RadicalPairModel | None = None
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
