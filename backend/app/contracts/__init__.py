"""Nebula Discover Phase-2 contracts (authoritative source of truth).

TypeScript contracts are generated from the FastAPI OpenAPI that references
these models. Do not hand-maintain a divergent TS schema.
"""
from __future__ import annotations

from .candidate import (
    CandidateDossier,
    CandidateRecord,
    PublicAnalog,
    StructuralEvidence,
)
from .enums import (
    ArchitectureKind,
    ClaimLevel,
    ExpressionHost,
    MaterialContext,
    ParameterSourceType,
    PhysicsEligibilityKind,
    ProviderId,
    ReadoutMode,
    RetrievalMode,
    RouteClass,
    RunStatus,
    ScaffoldFamily,
    Uncertainty,
)
from .objective import FieldProvenance, ObjectiveSpec, RawObjective
from .physics import PhysicsEligibility, QmClusterPlan, SpinDynamicsPlan
from .providers import (
    AlphaFoldModel,
    BindingSite,
    CofactorRef,
    FpbaseProtein,
    FpbaseState,
    InterProMatch,
    Keyword,
    PdbCofactor,
    PdbEntry,
    PdbSearchHit,
    PdbXref,
    UniProtRecord,
)
from .provenance import Citation, ParameterProvenance, Provenance
from .run import RunCreated, RunEvent, RunState

__all__ = [
    "ArchitectureKind", "ClaimLevel", "ExpressionHost", "MaterialContext",
    "ParameterSourceType", "PhysicsEligibilityKind", "ProviderId", "ReadoutMode",
    "RetrievalMode", "RouteClass", "RunStatus", "ScaffoldFamily", "Uncertainty",
    "RawObjective", "ObjectiveSpec", "FieldProvenance",
    "Citation", "Provenance", "ParameterProvenance",
    "UniProtRecord", "InterProMatch", "PdbEntry", "PdbSearchHit", "PdbCofactor",
    "PdbXref", "BindingSite", "Keyword", "CofactorRef", "AlphaFoldModel",
    "FpbaseProtein", "FpbaseState",
    "PhysicsEligibility", "QmClusterPlan", "SpinDynamicsPlan",
    "CandidateRecord", "CandidateDossier", "PublicAnalog", "StructuralEvidence",
    "RunState", "RunEvent", "RunCreated",
]
