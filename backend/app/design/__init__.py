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

from ..contracts.design import GenerativePreview
from ..contracts.objective import ObjectiveSpec

_log = logging.getLogger(__name__)


class DesignAdapter(Protocol):
    """A real de novo generator (RFdiffusion/ProteinMPNN/...) implements this seam."""

    name: str

    def invent(self, objective: ObjectiveSpec, n: int) -> list[GenerativePreview]: ...


class PreviewDesigner:
    """Deterministic, honest previews. No ML, no coordinates, no sequence, no randomness."""

    name = "deterministic-preview"

    def invent(self, objective: ObjectiveSpec, n: int = 3) -> list[GenerativePreview]:
        sensed = objective.sensed_quantity_or_state or "the stated target"
        return [
            GenerativePreview(
                label=f"de novo scaffold {i:02d}",
                invented_for=sensed,
                generator=self.name,
                note=(
                    "Invented, not retrieved. Generative preview until a real design adapter is "
                    "wired; not validated, not an orderable sequence."
                ),
            )
            for i in range(1, n + 1)
        ]


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


def generate_previews(objective: ObjectiveSpec, n: int = 3) -> list[GenerativePreview]:
    """Public entry point the orchestrator calls. Uses the configured design adapter and
    ALWAYS degrades to the deterministic preview on any error, so the design step never breaks
    a run and never silently borrows another account's compute."""
    adapter = _select_adapter()
    if isinstance(adapter, PreviewDesigner):
        return adapter.invent(objective, n)
    try:
        out = adapter.invent(objective, n)
        return out or PreviewDesigner().invent(objective, n)
    except Exception as exc:  # network / timeout / misconfig / HTTP error → honest fallback
        # log the exception TYPE only: an httpx error's str() would contain the endpoint URL
        _log.warning("design adapter %s failed (%s); using the deterministic preview.", adapter.name, type(exc).__name__)
        return PreviewDesigner().invent(objective, n)
