"""Generative design seam — "the unmade".

The DesignAdapter protocol is the seam a real de novo pipeline (RFdiffusion, ProteinMPNN,
LigandMPNN) plugs into. Absent such an adapter, PreviewDesigner produces deterministic,
clearly-labelled previews so the frontier lane never fabricates generated coordinates or
sequences offline. Computation is not validation; an invented scaffold is a discovery to prove
at the bench, never a proven sensor.
"""
from __future__ import annotations

from typing import Protocol

from ..contracts.design import GenerativePreview
from ..contracts.objective import ObjectiveSpec


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


def generate_previews(objective: ObjectiveSpec, n: int = 3) -> list[GenerativePreview]:
    """Public entry point the orchestrator calls; swap in a real DesignAdapter here later."""
    return PreviewDesigner().invent(objective, n)
