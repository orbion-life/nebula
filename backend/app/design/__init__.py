"""Generative design seam — "the unmade".

The DesignAdapter protocol is the seam a real de novo pipeline (RFdiffusion, ProteinMPNN,
LigandMPNN) plugs into. Absent such an adapter, PreviewDesigner produces deterministic,
clearly-labelled previews so the frontier lane never fabricates generated coordinates or
sequences offline. Computation is not validation; an invented scaffold is a discovery to prove
at the bench, never a proven sensor.

Adapter selection is environment-driven and OPT-IN. The default is the deterministic preview
(no GPU, no network, no credentials). A real GPU adapter is bring-your-own-compute: it activates
only when the deployer sets both its endpoint URL and a bearer token, and any failure or
misconfiguration falls back to the preview — a public build never reaches, and never bills,
anyone else's Modal account. See docs/DESIGN_ADAPTERS.md.
"""
from __future__ import annotations

import logging
import os
from typing import Protocol

from ..contracts.candidate import CandidateRecord
from ..contracts.design import GenerativePreview
from ..contracts.objective import ObjectiveSpec

_log = logging.getLogger(__name__)


class DesignAdapter(Protocol):
    """A real de novo generator (RFdiffusion/ProteinMPNN/...) implements this seam.

    `candidates` is the ranked shortlist so a design brief can name the protein + cofactor motif
    it targets (a design intent). A real adapter may additionally scaffold around that motif."""

    name: str

    def invent(self, objective: ObjectiveSpec, candidates: list[CandidateRecord] | None, n: int) -> list[GenerativePreview]: ...


# route_class → a short, honest description of the geometric site a design would target.
_ROUTE_MOTIF: dict[str, str] = {
    "LOV_flavin_radical_pair": "flavin radical-pair site",
    "cryptochrome_FAD_radical_pair": "FAD radical-pair site",
    "RFP_flavin_photochemical": "flavin photochemical site",
    "triplet_FP": "chromophore triplet site",
    "redox_electrochemical": "redox cofactor site",
    "material_state": "responsive material interface",
    "metal_cofactor_confounder": "metal cofactor site",
}


def _route_key(route_class: object) -> str:
    return str(getattr(route_class, "value", route_class))


def _motif_note(route_class: object, cofactor: str | None) -> str:
    base = _ROUTE_MOTIF.get(_route_key(route_class), "cofactor site")
    if cofactor and cofactor.lower() not in base.lower():
        return f"{cofactor} {base}"
    return base


def _design_rationale(accession: str | None, motif: str) -> str:
    target = accession or "the top-ranked candidate"
    return (
        f"A de novo backbone brief targeting the {motif} that {target} uses for its mechanism route. "
        "This is a design intent, not a produced or validated construct: coordinates require the "
        "RFdiffusion adapter and no sequence is generated."
    )


class PreviewDesigner:
    """Deterministic, honest previews. No ML, no coordinates, no sequence, no randomness.

    Each brief is linked (round-robin) to a top-ranked candidate so the frontier reads per protein:
    it NAMES the protein + cofactor motif it would target, without claiming any backbone was built."""

    name = "deterministic-preview"

    def invent(self, objective: ObjectiveSpec, candidates: list[CandidateRecord] | None = None, n: int = 3) -> list[GenerativePreview]:
        sensed = objective.sensed_quantity_or_state or "the stated target"
        cands = candidates or []
        out: list[GenerativePreview] = []
        for i in range(1, n + 1):
            cand = cands[(i - 1) % len(cands)] if cands else None
            accession = cand.uniprot.primary_accession if (cand and cand.uniprot) else None
            cofactor = cand.cofactors[0].name if (cand and cand.cofactors) else None
            motif = _motif_note(cand.route_class, cofactor) if cand else None
            out.append(GenerativePreview(
                label=f"de novo scaffold {i:02d}",
                invented_for=sensed,
                generator=self.name,
                note=(
                    "Invented, not retrieved. Generative preview until a real design adapter is "
                    "wired; not validated, not an orderable sequence."
                ),
                invented_from_candidate_id=cand.candidate_id if cand else None,
                invented_from_accession=accession,
                mechanism_route_id=cand.mechanism_route_id if cand else None,
                motif_note=motif,
                design_rationale=_design_rationale(accession, motif) if motif else None,
            ))
        return out


_OFF = {"", "preview", "none", "off", "0", "false"}


def _select_adapter() -> DesignAdapter:
    """Pick the design adapter from the environment. Default: the deterministic preview.
    A GPU adapter is strictly opt-in and bring-your-own-compute."""
    kind = os.environ.get("NEBULA_DESIGN_ADAPTER", "preview").strip().lower()
    if kind in _OFF:
        return PreviewDesigner()
    if kind == "modal":
        url = os.environ.get("NEBULA_MODAL_RFDIFFUSION_URL", "").strip()
        token = os.environ.get("NEBULA_MODAL_RFDIFFUSION_TOKEN", "").strip()
        if url and token:
            from .modal_rfdiffusion import ModalRFdiffusionAdapter

            return ModalRFdiffusionAdapter(url, token)
        _log.warning(
            "NEBULA_DESIGN_ADAPTER=modal but NEBULA_MODAL_RFDIFFUSION_URL/TOKEN are unset; "
            "using the deterministic preview (no external compute)."
        )
        return PreviewDesigner()
    _log.warning("Unknown NEBULA_DESIGN_ADAPTER=%r; using the deterministic preview.", kind)
    return PreviewDesigner()


def generate_previews(objective: ObjectiveSpec, candidates: list[CandidateRecord] | None = None, n: int = 3) -> list[GenerativePreview]:
    """Public entry point the orchestrator calls. `candidates` is the RANKED shortlist so each
    design brief can name the protein + cofactor motif it targets. Uses the configured design
    adapter and ALWAYS degrades to the deterministic preview on any error, so the design step never
    breaks a run and never silently borrows another account's compute."""
    adapter = _select_adapter()
    if isinstance(adapter, PreviewDesigner):
        return adapter.invent(objective, candidates, n)
    try:
        out = adapter.invent(objective, candidates, n)
        return out or PreviewDesigner().invent(objective, candidates, n)
    except Exception as exc:  # network / timeout / misconfig / HTTP error → honest fallback
        # log the exception TYPE only: an httpx error's str() would contain the endpoint URL
        _log.warning("design adapter %s failed (%s); using the deterministic preview.", adapter.name, type(exc).__name__)
        return PreviewDesigner().invent(objective, candidates, n)
