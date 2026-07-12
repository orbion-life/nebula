"""Public evidence-card registry — Python port of src/core/fixtures/evidenceCards.ts + the
route->publicAnchors map from src/core/fixtures/routes.ts.

A citation supports the PLAUSIBILITY of a mechanism route; it NEVER implies that a specific
construct hypothesis is validated. Two cards are honestly flagged `demo_assumption` (no citation).
This registry is kept 1-to-1 with the TS source (a cross-check test asserts the DOIs never drift),
so the shipped dossier cites real literature with no runtime LLM.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from ..contracts.enums import ClaimLevel
from ..contracts.provenance import Citation


@dataclass(frozen=True)
class EvidenceCardDef:
    id: str
    title: str
    provenance: Literal["public_literature", "demo_assumption"]
    relation: str  # supports | requires | assumes | confounded_by | falsified_by | caps_claim_at
    citations: tuple[Citation, ...] = ()
    caps_claim_at: ClaimLevel | None = None
    note: str = ""


def _c(authors: str, year: int, title: str, venue: str, doi: str) -> Citation:
    return Citation(authors=authors, year=year, title=title, venue=venue, doi=doi)


# citations shared across cards (deduped by DOI at render time)
_HORE_2016 = _c(
    "Hore PJ, Mouritsen H", 2016, "The Radical-Pair Mechanism of Magnetoreception",
    "Annual Review of Biophysics 45:299-344", "10.1146/annurev-biophys-032116-094545",
)
_MAEDA_2008 = _c(
    "Maeda K, Henbest KB, Cintolesi F, et al.", 2008, "Chemical compass model of avian magnetoreception",
    "Nature 453:387-390", "10.1038/nature06834",
)
_MASSEY_2000 = _c(
    "Massey V", 2000, "The chemical and biological versatility of riboflavin",
    "Biochemical Society Transactions 28(4):283-296", "10.1042/bst0280283",
)
_PHOTOBLEACH_1995 = _c(
    "Song L, Hennink EJ, Young IT, Tanke HJ", 1995,
    "Photobleaching kinetics of fluorescein in quantitative fluorescence microscopy",
    "Biophysical Journal 68(6):2588-2600", "10.1016/S0006-3495(95)80442-X",
)


EVIDENCE_CARDS: dict[str, EvidenceCardDef] = {
    "ev_radical_pair_mfe": EvidenceCardDef(
        id="ev_radical_pair_mfe",
        title="Radical-pair reactions can be magnetically sensitive",
        provenance="public_literature", relation="supports",
        caps_claim_at=ClaimLevel.measurement_triage,
        citations=(_HORE_2016, _MAEDA_2008),
        note="Supports plausibility of a field-dependent optical readout; does not prove any specific construct responds.",
    ),
    "ev_flavin_photochemistry": EvidenceCardDef(
        id="ev_flavin_photochemistry",
        title="Flavin cofactors are photochemically active",
        provenance="public_literature", relation="requires",
        citations=(_MASSEY_2000,),
        note="Blue-light excitation is compatible; requires the flavin cofactor to be present and photoactive in context.",
    ),
    "ev_lov_photocycle": EvidenceCardDef(
        id="ev_lov_photocycle",
        title="LOV domains have a characterized blue-light photocycle",
        provenance="public_literature", relation="supports",
        caps_claim_at=ClaimLevel.measurement_triage,
        citations=(_c(
            "Salomon M, Christie JM, Knieb E, Lempert U, Briggs WR", 2000,
            "Photochemical and Mutational Analysis of the FMN-Binding Domains of the Plant Blue Light Receptor, Phototropin",
            "Biochemistry 39(31):9401-9410", "10.1021/bi000585+",
        ),),
        note="Gives a concrete, controllable light-history handle for measurement design.",
    ),
    "ev_cryptochrome_fad": EvidenceCardDef(
        id="ev_cryptochrome_fad",
        title="Cryptochrome/FAD is the leading candidate radical-pair magnetoreceptor",
        provenance="public_literature", relation="assumes",
        caps_claim_at=ClaimLevel.diagnostic_only,
        citations=(_MAEDA_2008,),
        note="Stays diagnostic-only for engineered constructs: an in-cell, readout-coupled magnetic effect is not established for arbitrary scaffolds.",
    ),
    "ev_fp_triplet": EvidenceCardDef(
        id="ev_fp_triplet",
        title="Fluorescent proteins populate triplet/dark states",
        provenance="public_literature", relation="assumes",
        caps_claim_at=ClaimLevel.diagnostic_only,
        citations=(_c(
            "Dickson RM, Cubitt AB, Tsien RY, Moerner WE", 1997,
            "On/off blinking and switching behaviour of single molecules of green fluorescent protein",
            "Nature 388:355-358", "10.1038/41048",
        ),),
        note="Triplet/dark-state population is real; a clean spin-addressable optical (ODMR) readout in a protein is not established and stays diagnostic-only.",
    ),
    "ev_oxygen_quenching": EvidenceCardDef(
        id="ev_oxygen_quenching",
        title="Oxygen quenches triplet and radical states",
        provenance="public_literature", relation="confounded_by",
        citations=(_c(
            "Wilkinson F, Helman WP, Ross AB", 1993,
            "Quantum Yields for the Photosensitized Formation of the Lowest Electronically Excited Singlet State of Molecular Oxygen in Solution",
            "Journal of Physical and Chemical Reference Data 22(1):113-262", "10.1063/1.555934",
        ),),
        note="Mandatory oxygen control; a small spin-linked signal can be swamped by oxygen variation.",
    ),
    "ev_photobleaching": EvidenceCardDef(
        id="ev_photobleaching",
        title="Photobleaching produces (often non-single-exponential) signal decay",
        provenance="public_literature", relation="confounded_by",
        citations=(_PHOTOBLEACH_1995,),
        note="Requires a no-field / no-RF illuminated control to separate bleaching from any response.",
    ),
    "ev_field_effect_falsified": EvidenceCardDef(
        id="ev_field_effect_falsified",
        title="Flat field response under controls falsifies spin-linked readout",
        provenance="public_literature", relation="falsified_by",
        caps_claim_at=ClaimLevel.diagnostic_only,
        citations=(_HORE_2016,),
        note="Kill criterion: no field-dependent signal after mandatory controls means abandon the spin-linked route for this scaffold.",
    ),
    "ev_redox_flavoprotein": EvidenceCardDef(
        id="ev_redox_flavoprotein",
        title="Flavin fluorescence is redox- and environment-dependent",
        provenance="public_literature", relation="supports",
        caps_claim_at=ClaimLevel.measurement_triage,
        citations=(_c(
            "Drepper T, Eggert T, Circolone F, et al.", 2007,
            "Reporter proteins for in vivo fluorescence without oxygen",
            "Nature Biotechnology 25(4):443-445", "10.1038/nbt1293",
        ),),
        note="Redox readout is well posed; ties signal to a controllable chemical variable.",
    ),
    "ev_metal_confounder": EvidenceCardDef(
        id="ev_metal_confounder",
        title="A genuine spin mechanism has stringent requirements",
        provenance="public_literature", relation="caps_claim_at",
        caps_claim_at=ClaimLevel.diagnostic_only,
        citations=(_HORE_2016,),
        note="Presence is an annotation, not a mechanism. Stays confounder/diagnostic-only unless an explicit optical or electrical spin-transduction path is supplied.",
    ),
    "ev_material_state": EvidenceCardDef(
        id="ev_material_state",
        title="Demo assumption: material state modulates embedded-fluorophore signal",
        provenance="demo_assumption", relation="assumes",
        caps_claim_at=ClaimLevel.measurement_triage,
        citations=(),
        note="Demo assumption to shape the material-state trace; must be separated from bleaching and temperature drift by measurement.",
    ),
    "ev_demo_field_window": EvidenceCardDef(
        id="ev_demo_field_window",
        title="Demo assumption: usable field/RF window",
        provenance="demo_assumption", relation="assumes",
        citations=(),
        note="Chosen to make the synthetic sweep legible; not a claim about any real instrument or protein.",
    ),
}


# route_id -> ordered public anchors (mirrors src/core/fixtures/routes.ts publicAnchors)
ROUTE_ANCHORS: dict[str, tuple[str, ...]] = {
    "route_lov_flavin_rp": ("ev_radical_pair_mfe", "ev_flavin_photochemistry", "ev_lov_photocycle"),
    "route_cry_fad_rp": ("ev_cryptochrome_fad", "ev_radical_pair_mfe", "ev_flavin_photochemistry"),
    "route_triplet_fp": ("ev_fp_triplet", "ev_oxygen_quenching"),
    "route_rfp_flavin_photo": ("ev_flavin_photochemistry", "ev_photobleaching"),
    "route_redox_electrochem": ("ev_redox_flavoprotein", "ev_oxygen_quenching"),
    "route_material_state": ("ev_material_state", "ev_photobleaching"),
    "route_metal_confounder": ("ev_metal_confounder",),
}


def card_ids_for_route(route_id: str) -> list[str]:
    """The evidence-card ids anchoring a route (public + demo), in declared order."""
    return list(ROUTE_ANCHORS.get(route_id, ()))


def cards_for_route(route_id: str) -> list[EvidenceCardDef]:
    return [EVIDENCE_CARDS[cid] for cid in ROUTE_ANCHORS.get(route_id, ()) if cid in EVIDENCE_CARDS]


def citations_for_route(route_id: str) -> list[Citation]:
    """Public-literature citations for a route, deduped by DOI, preserving declared order.
    Demo-assumption cards contribute no citation (they are surfaced as 'rationale, not citation')."""
    seen: set[str] = set()
    out: list[Citation] = []
    for card in cards_for_route(route_id):
        if card.provenance != "public_literature":
            continue
        for cit in card.citations:
            if cit.doi not in seen:
                seen.add(cit.doi)
                out.append(cit)
    return out
