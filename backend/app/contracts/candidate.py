"""CandidateRecord + CandidateDossier.

A CandidateRecord is a normalized, cross-referenced REAL public protein (with a
real accession) — never a template family and never an orderable sequence or
mutation list. The dossier is the claim-safe assembled export for one candidate.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .enums import ArchitectureKind, ClaimLevel, ReadoutMode, RouteClass, ScaffoldFamily
from .physics import PhysicsEligibility
from .providers import (
    AlphaFoldModel,
    CofactorRef,
    FpbaseProtein,
    InterProMatch,
    PdbEntry,
    UniProtRecord,
)
from .provenance import Citation, Provenance


class PublicAnalog(BaseModel):
    """Retrieval-only public analog — analog != prediction (never spin response)."""
    model_config = ConfigDict(extra="forbid")
    accession_or_id: str
    name: str
    family: str | None = None
    method: Literal["mmseqs2", "esm2_embedding", "keyword"] = "keyword"
    similarity: float
    public_ref: str


class CandidateRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: str
    title: str
    status: Literal["public_hypothesis_not_validated"] = "public_hypothesis_not_validated"
    private_candidate: Literal[False] = False

    scaffold_family: ScaffoldFamily
    architecture_kind: ArchitectureKind

    # real public source records (at least one real accession)
    uniprot: UniProtRecord | None = None
    interpro_matches: list[InterProMatch] = Field(default_factory=list)
    pdb_entries: list[PdbEntry] = Field(default_factory=list)
    alphafold_model: AlphaFoldModel | None = None
    fpbase: FpbaseProtein | None = None

    cofactors: list[CofactorRef] = Field(default_factory=list)
    readout_modes: list[ReadoutMode] = Field(default_factory=list)
    mechanism_route_id: str
    route_class: RouteClass

    # generated per the real scaffold (never literal template prose)
    why_it_might_work: list[str] = Field(default_factory=list)
    why_it_might_fail: list[str] = Field(default_factory=list)
    required_controls: list[str] = Field(default_factory=list)
    confounders: list[str] = Field(default_factory=list)
    evidence_card_ids: list[str] = Field(default_factory=list)
    analogs: list[PublicAnalog] = Field(default_factory=list)

    material_fit: list[str] = Field(default_factory=list)
    expression_context: list[str] = Field(default_factory=list)
    claim_ceiling: ClaimLevel = ClaimLevel.diagnostic_only
    generated_by: str = Field(description="e.g. 'generated from UniProt Q43125 via cryptochrome_FAD_radical_pair'")
    allowed_next_step: Literal["measurement_planning", "internal_developability_triage", "discard"] = "measurement_planning"

    provenance: list[Provenance] = Field(default_factory=list)
    degradations: list[str] = Field(default_factory=list, description="explicit unavailable/degraded states — never imputed")


class StructuralEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pdb_entries: list[PdbEntry] = Field(default_factory=list)
    alphafold_model: AlphaFoldModel | None = None
    note: str = "PDB = experimental; AlphaFold = computational prediction (pLDDT confidence)"


class CandidateDossier(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dossier_id: str
    candidate: CandidateRecord
    physics_eligibility: PhysicsEligibility
    structural_evidence: StructuralEvidence
    evidence_citations: list[Citation] = Field(default_factory=list)
    claim_ceiling: ClaimLevel = ClaimLevel.diagnostic_only
    disclaimers: list[str] = Field(
        default_factory=lambda: [
            "Unvalidated public-protein candidate hypothesis; requires experimental measurement.",
            "Computation is not validation; no working sensor is claimed.",
        ],
    )
    status: Literal["public_hypothesis_not_validated"] = "public_hypothesis_not_validated"
    private_candidate: Literal[False] = False
