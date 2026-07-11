"""Mechanism composition.

Compose a typed MechanismGraph for a candidate from its CapabilityVector. The
known LOV/cryptochrome/FP-triplet/redox routes are public mechanism templates; the
composer marks each step known/assumed/unknown from public evidence, so the
honest gap (e.g. the spin→optical transduction step) is explicit rather than
hidden. A graph is `complete` only if every step from energy-in to readout is
present.
"""
from __future__ import annotations

from ..contracts.enums import KnowledgeStateKind, PrimitiveKind, ReadoutMode, RouteClass
from ..contracts.mechanism import (
    CapabilityVector,
    KnowledgeState,
    MechanismGraph,
    MechanismPrimitive,
    UnknownParameter,
)

_RP_ROUTES = {RouteClass.lov_flavin_radical_pair, RouteClass.cryptochrome_fad_radical_pair}


def _k(state: KnowledgeStateKind, evidence: str | None = None) -> KnowledgeState:
    return KnowledgeState(state=state, evidence=evidence)


def _known_if(cond: bool, evidence: str, assume_note: str = "") -> KnowledgeState:
    return _k(KnowledgeStateKind.known, evidence) if cond else _k(KnowledgeStateKind.assumed, assume_note or None)


def compose_graph(candidate_id: str, route_class: RouteClass, cap: CapabilityVector) -> MechanismGraph:
    prims: list[MechanismPrimitive] = []
    observable = ReadoutMode.fluorescence
    template: RouteClass | None = None

    if route_class in _RP_ROUTES:
        template = route_class if cap.has_flavin else None
        observable = ReadoutMode.rf_magnetic if ReadoutMode.rf_magnetic in cap.readouts_supported else ReadoutMode.fluorescence
        prims = [
            MechanismPrimitive(kind=PrimitiveKind.energy_input, detail="photoexcitation (blue light)",
                               knowledge=_known_if("blue-light" in "".join(cap.notes) or cap.chromophore or cap.has_flavin, "flavin absorbs blue light (public photochemistry)")),
            MechanismPrimitive(kind=PrimitiveKind.excitation, detail="flavin excited state",
                               knowledge=_known_if(cap.has_flavin, f"flavin cofactor annotated ({cap.accession})"), requires=["flavin"]),
            MechanismPrimitive(kind=PrimitiveKind.radical_pair_formation, detail="spin-correlated radical pair (flavin + donor)",
                               knowledge=_k(KnowledgeStateKind.assumed, "donor/acceptor identity and distance not fixed from public evidence for this construct"),
                               requires=["flavin", "electron donor"],
                               unknowns=[UnknownParameter(name="donor_acceptor_geometry", why_unknown="tryptophan-chain / donor geometry not resolved from public evidence", how_to_resolve="cofactor-bound structure + transient-absorption / EPR")]),
            MechanismPrimitive(kind=PrimitiveKind.spin_evolution, detail="Zeeman + hyperfine singlet-triplet interconversion",
                               knowledge=_k(KnowledgeStateKind.assumed, "hyperfine set is model-flavin, not this protein"),
                               unknowns=[UnknownParameter(name="hyperfine_couplings", why_unknown="not measured for this construct", how_to_resolve="EPR / candidate-specific electronic structure (Phase 4)")]),
            MechanismPrimitive(kind=PrimitiveKind.recombination, detail="Haberkorn singlet/triplet recombination", knowledge=_k(KnowledgeStateKind.assumed)),
            MechanismPrimitive(kind=PrimitiveKind.relaxation, detail="spin relaxation", knowledge=_k(KnowledgeStateKind.assumed)),
            MechanismPrimitive(kind=PrimitiveKind.biological_transduction, detail="yield change → optical/recovery signal",
                               knowledge=_k(KnowledgeStateKind.unknown, None),
                               unknowns=[UnknownParameter(name="optical_transduction", why_unknown="coupling of spin yield to a fluorescence change is unproven for this construct", how_to_resolve="field-dependent fluorescence with photobleach + O2 controls")]),
            MechanismPrimitive(kind=PrimitiveKind.fluorescence_readout, detail="fluorescence / lifetime readout",
                               knowledge=_known_if(cap.optical, "optical readout supported")),
        ]
    elif route_class == RouteClass.triplet_fp:
        template = RouteClass.triplet_fp if cap.chromophore else None
        observable = ReadoutMode.odmr_like
        prims = [
            MechanismPrimitive(kind=PrimitiveKind.excitation, detail="chromophore excited state", knowledge=_known_if(cap.chromophore, "fluorescent-protein chromophore")),
            MechanismPrimitive(kind=PrimitiveKind.triplet_formation, detail="intersystem crossing to a triplet/dark state", knowledge=_known_if(cap.triplet_capable, "FPs populate triplet/dark states (public)")),
            MechanismPrimitive(kind=PrimitiveKind.spin_evolution, detail="RF perturbs triplet sublevels (ODMR-like)", knowledge=_k(KnowledgeStateKind.assumed),
                               unknowns=[UnknownParameter(name="odmr_contrast", why_unknown="clean protein ODMR contrast not established", how_to_resolve="RF-swept fluorescence at controlled temperature")]),
            MechanismPrimitive(kind=PrimitiveKind.fluorescence_readout, detail="fluorescence contrast", knowledge=_known_if(cap.optical, "optical readout")),
        ]
    elif route_class == RouteClass.metal_cofactor_confounder or cap.has_metal_open_shell:
        observable = ReadoutMode.fluorescence
        prims = [
            MechanismPrimitive(kind=PrimitiveKind.metal_open_shell, detail=f"open-shell metal centre ({', '.join(cap.metals) or 'metal'})", knowledge=_known_if(cap.has_metal_open_shell, "metal cofactor annotated")),
            MechanismPrimitive(kind=PrimitiveKind.spin_evolution, detail="paramagnetic spin state", knowledge=_k(KnowledgeStateKind.assumed)),
            MechanismPrimitive(kind=PrimitiveKind.biological_transduction, detail="NO established optical spin-transduction path", knowledge=_k(KnowledgeStateKind.unknown),
                               unknowns=[UnknownParameter(name="transduction_path", why_unknown="presence of a paramagnetic centre is not a readout mechanism", how_to_resolve="supply an explicit optical/electrical spin-transduction path before any claim")]),
        ]
    elif route_class == RouteClass.rfp_flavin_photochemical:  # light history: a flavin photocycle, not an electrochemical redox drive
        observable = ReadoutMode.fluorescence
        prims = [
            MechanismPrimitive(kind=PrimitiveKind.energy_input, detail="blue light photoexcitation of the flavin", knowledge=_known_if(cap.has_flavin, "flavin blue light photochemistry (public)")),
            MechanismPrimitive(kind=PrimitiveKind.biological_transduction, detail="a reversible flavin photoproduct records illumination history", knowledge=_k(KnowledgeStateKind.assumed)),
            MechanismPrimitive(kind=PrimitiveKind.fluorescence_readout, detail="optical or lifetime readout", knowledge=_known_if(cap.optical, "optical readout supported")),
        ]
    else:  # redox / material
        observable = ReadoutMode.redox_electrochemical if cap.electrochemical else ReadoutMode.fluorescence
        prims = [
            MechanismPrimitive(kind=PrimitiveKind.energy_input, detail="chemical/electrochemical drive", knowledge=_known_if(cap.redox_active, "redox-active cofactor")),
            MechanismPrimitive(kind=PrimitiveKind.biological_transduction, detail="redox state modulates optical/electrochemical signal", knowledge=_known_if(cap.redox_active, "flavin redox modulates fluorescence (public)")),
            MechanismPrimitive(kind=PrimitiveKind.electrochemical_readout if cap.electrochemical else PrimitiveKind.fluorescence_readout, detail="readout", knowledge=_known_if(cap.optical or cap.electrochemical, "readout supported")),
        ]

    kinds = {p.kind for p in prims}
    complete = bool(prims) and any(k in kinds for k in (PrimitiveKind.energy_input, PrimitiveKind.excitation)) and any(
        k in kinds for k in (PrimitiveKind.fluorescence_readout, PrimitiveKind.lifetime_readout, PrimitiveKind.electrochemical_readout)
    )
    return MechanismGraph(
        graph_id=f"graph_{candidate_id}",
        template_route_class=template,
        primitives=prims,
        observable=observable,
        complete=complete,
    )
