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

    The shipped candidate path uses a truncated bound-flavin core and a bounded
    subprocess timeout. Runtime depends on geometry and hardware; the committed
    Q8LPD9/1N9O result took about 165 seconds at UHF/6-31G.
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
    # The initial eligibility plan is generic. The orchestrator upgrades at most
    # one candidate after real bound-flavin coordinates enter a converged run.
    candidate_specific: bool = False
    geometry_source: str = "canonical isoalloxazine core (generic template; not extracted from this protein's structure yet)"
    truncation_note: str = (
        "ribityl/phosphate tail truncated and N10 H-capped toward the removed C1' direction. "
        "Assumption-derived; not a whole-protein claim."
    )


class SpinDynamicsPlan(BaseModel):
    """References the offline RadicalPy artifact; no per-protein spin claim."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    artifact_ref: str  # e.g. "radical_pair_mary.v1@<contentHash[:12]>"
    hamiltonian_terms: list[str] = Field(
        default_factory=lambda: ["Zeeman(B0)", "isotropic hyperfine", "Haberkorn recombination", "relaxation"],
    )
    note: str = "spin dynamics of a model flavin-based radical pair; a calibration reference, not a candidate-specific prediction"


class MagneticFieldEffectScenario(BaseModel):
    """One explicit kinetic assumption set in the RadicalPy sensitivity sweep."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    name: str
    singlet_recombination_s: float
    triplet_recombination_s: float
    relaxation_s: float
    exchange_j_mT: float
    amplitude_percent: float


class MagneticFieldEffectSensitivity(BaseModel):
    """Assumption sensitivity, not a predicted protein response.

    A structure-derived geometry sets D and a heuristic starting J. J and kinetic
    rates are then varied explicitly; hyperfine remains class-level. The result is
    therefore an assumption range, not a single candidate-response percentage.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)
    field_range_mT: float
    lower_percent: float
    baseline_percent: float
    upper_percent: float
    scenarios: list[MagneticFieldEffectScenario] = Field(default_factory=list)
    fields_mT: list[float] = Field(default_factory=list)
    lower_curve_percent: list[float] = Field(default_factory=list)
    baseline_curve_percent: list[float] = Field(default_factory=list)
    upper_curve_percent: list[float] = Field(default_factory=list)
    note: str = (
        "Sensitivity envelope across explicit exchange-coupling and generic kinetic scenarios; "
        "candidate geometry supplies D and the starting J estimate, while hyperfine remains "
        "class-level and protein environment plus optical transduction are not modeled."
    )


class RadicalPairModel(BaseModel):
    """Per-protein radical-pair geometry + geometry-derived couplings (Tier 0).

    An aromatic-network heuristic assigns a terminal Trp/Tyr partner from this protein's structure;
    centroid separation and the standard distance formulas then parameterize D and an uncertain J.
    These are candidate-associated model inputs, not measured radical localization. Hyperfine remains
    class-level and no protein environment or optical transduction is modeled.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)
    partner_residue: str
    partner_kind: Literal["tryptophan", "tyrosine"]
    chain_residues: list[str] = Field(default_factory=list)
    separation_angstrom: float
    exchange_j_mT: float
    dipolar_d_mT: float
    # Compatibility field: the baseline scenario from magnetic_field_effect. New consumers should
    # present the sensitivity envelope below, never this scalar as a protein-response prediction.
    magnetic_field_effect_percent: float | None = None
    magnetic_field_effect: MagneticFieldEffectSensitivity | None = None
    method_note: str = (
        "electron-transfer partner assigned from this protein's aromatic contact graph (light "
        "Beratan-Onuchic heuristic; eMap/pyemap is the fuller tool). D is a point-dipole estimate from "
        "centroid separation; J from Moser et al. 1992 tunnelling decay is order-of-magnitude only. The "
        "magnetic field effect is a RadicalPy sensitivity envelope from candidate D/J under named "
        "generic kinetic assumptions (class-level flavin+tryptophan hyperfine, no protein environment "
        "or optical transduction). It is NOT a validated response prediction or a sensor claim. "
        "Geometry-derived; hyperfine and kinetics remain class-level."
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
