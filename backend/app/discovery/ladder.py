"""Constraint-relaxation ladder (L0–L4) + novelty / out-of-distribution.

Each level relaxes a constraint, LOWERS the claim ceiling, and exposes more
assumptions. Novelty rises with level but is NEVER treated as evidence and never
raises plausibility or performance downstream.
"""
from __future__ import annotations

from ..contracts.discovery import ExplorationReason
from ..contracts.enums import ClaimLevel, ExplorationLevel, RouteClass
from ..contracts.mechanism import CapabilityVector, MechanismGraph

_KNOWN_FAMILY_ROUTES = {
    RouteClass.lov_flavin_radical_pair,
    RouteClass.cryptochrome_fad_radical_pair,
    RouteClass.triplet_fp,
    RouteClass.rfp_flavin_photochemical,
    RouteClass.redox_electrochemical,
}

# each level's claim ceiling (strictly non-increasing down the ladder)
_LEVEL_CEILING = {
    ExplorationLevel.l0_known_family: ClaimLevel.measurement_triage,
    ExplorationLevel.l1_cofactor_geometry: ClaimLevel.diagnostic_only,
    ExplorationLevel.l2_alternative_spin: ClaimLevel.diagnostic_only,
    ExplorationLevel.l3_scaffold_composition: ClaimLevel.diagnostic_only,
    ExplorationLevel.l4_design: ClaimLevel.diagnostic_only,
}
_LEVEL_NOVELTY = {
    ExplorationLevel.l0_known_family: 0.10,
    ExplorationLevel.l1_cofactor_geometry: 0.40,
    ExplorationLevel.l2_alternative_spin: 0.70,
    ExplorationLevel.l3_scaffold_composition: 0.85,
    ExplorationLevel.l4_design: 0.95,
}


def assign_exploration(
    route_class: RouteClass,
    cap: CapabilityVector,
    graph: MechanismGraph,
) -> tuple[ExplorationReason, float]:
    is_template = graph.template_route_class is not None and route_class in _KNOWN_FAMILY_ROUTES
    has_canonical_cofactor = cap.has_flavin or (route_class == RouteClass.triplet_fp and cap.chromophore) or (
        route_class == RouteClass.redox_electrochemical and cap.redox_active
    )

    outside: str | None = None
    if is_template and has_canonical_cofactor:
        level = ExplorationLevel.l0_known_family
    elif has_canonical_cofactor or cap.has_flavin:
        level = ExplorationLevel.l1_cofactor_geometry
        outside = "cofactor/geometry present but not the canonical family arrangement for this route"
    elif cap.has_metal_open_shell:
        level = ExplorationLevel.l2_alternative_spin
        outside = f"alternative spin-forming chemistry (open-shell metal: {', '.join(cap.metals) or 'metal'}) rather than a flavin radical pair"
    elif cap.chromophore or cap.redox_active:
        level = ExplorationLevel.l3_scaffold_composition
        outside = "compatible scaffold/readout but no canonical spin-forming cofactor; composition-level hypothesis"
    else:
        level = ExplorationLevel.l3_scaffold_composition
        outside = "no obvious spin-bearing centre; retained only as a far-field composition hypothesis"

    constraints_ok: list[str] = []
    if cap.has_flavin:
        constraints_ok.append("flavin present → a radical pair is chemically possible")
    if cap.has_metal_open_shell:
        constraints_ok.append("open-shell metal present → a paramagnetic spin state is possible")
    if cap.triplet_capable:
        constraints_ok.append("chromophore populates triplet/dark states")
    if cap.optical:
        constraints_ok.append("an optical readout is available")
    if cap.has_experimental_structure:
        constraints_ok.append("experimental structure available for geometry")

    assumptions = [u.name for p in graph.primitives for u in p.unknowns]

    reason = ExplorationReason(
        level=level,
        outside_family_because=outside,
        physical_constraints_satisfied=constraints_ok,
        assumptions_remaining=sorted(set(assumptions)),
        claim_ceiling=_LEVEL_CEILING[level],
    )
    return reason, _LEVEL_NOVELTY[level]
