"""Composable mechanism graph + capability vector.

Replaces the closed 5-route vocabulary with a typed, composable graph:

  energy input → spin-forming event → spin-bearing state → quantum evolution
  → biological transduction → observable readout → material/cellular context

The known LOV/cryptochrome/FP-triplet/redox routes are retained as VALIDATED
graph templates, not the limits of the search. A CapabilityVector is what a real
protein can physically offer, extracted from public evidence — the substrate the
frontier search composes mechanisms from.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .enums import KnowledgeStateKind, PrimitiveKind, ReadoutMode, RouteClass


class UnknownParameter(BaseModel):
    """A parameter the mechanism needs but that public evidence does not fix."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    name: str
    why_unknown: str
    how_to_resolve: str  # the measurement/computation that would fix it


class KnowledgeState(BaseModel):
    """Per-step epistemic status — makes the honest gap explicit."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    state: KnowledgeStateKind
    evidence: str | None = None  # citation / accession / structure id when known


class MechanismPrimitive(BaseModel):
    """One typed step in a mechanism graph."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    kind: PrimitiveKind
    detail: str
    knowledge: KnowledgeState
    requires: list[str] = Field(default_factory=list, description="capabilities this step needs (e.g. 'flavin', 'triplet-capable chromophore')")
    unknowns: list[UnknownParameter] = Field(default_factory=list)


class MechanismGraph(BaseModel):
    """An ordered chain of primitives from energy input to readout/context."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    graph_id: str
    template_route_class: RouteClass | None = None  # set when it matches a validated template
    primitives: list[MechanismPrimitive]
    observable: ReadoutMode
    complete: bool = Field(description="true only if every step from energy in to readout is present")

    @property
    def unresolved_fraction(self) -> float:
        if not self.primitives:
            return 1.0
        unresolved = sum(1 for p in self.primitives if p.knowledge.state != KnowledgeStateKind.known)
        return round(unresolved / len(self.primitives), 3)


class CapabilityVector(BaseModel):
    """What a real protein can physically offer, from public evidence only."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    accession: str
    cofactors: list[str] = Field(default_factory=list)
    metals: list[str] = Field(default_factory=list)
    has_flavin: bool = False
    has_metal_open_shell: bool = False
    redox_active: bool = False
    chromophore: bool = False
    triplet_capable: bool = False
    domains: list[str] = Field(default_factory=list)
    binding_site_residues: list[int] = Field(default_factory=list)
    has_experimental_structure: bool = False
    structure_confidence: float | None = None  # resolution (A) or pLDDT
    readouts_supported: list[ReadoutMode] = Field(default_factory=list)
    optical: bool = False
    magnetic_candidate: bool = False
    electrochemical: bool = False
    evidence_confidence: float = Field(ge=0.0, le=1.0, description="0..1 from reviewed status + annotation depth + structure")
    notes: list[str] = Field(default_factory=list)
