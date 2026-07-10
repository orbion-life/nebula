"""ObjectiveSpec — the one contract for novice and expert users.

A versioned, editable structured objective. Both the plain-language parser and
the expert configurator produce THIS. `confidential_sequence_provided` is a hard
`Literal[False]` boundary invariant.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .enums import ExpressionHost, MaterialContext, ReadoutMode, ScaffoldFamily

OBJECTIVE_SCHEMA_VERSION = "2.0.0"


class RawObjective(BaseModel):
    model_config = ConfigDict(extra="forbid")
    objective_text: str = Field(min_length=1, max_length=5000)
    user_mode: Literal["novice", "expert"] = "novice"
    instrument_id: str | None = None
    seed: int = 1337


class FieldProvenance(BaseModel):
    """How each compiled field was obtained — honesty scales beyond a flat list."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    field: str
    source: Literal["verbatim", "inferred", "defaulted"]
    by: Literal["llm", "rule"]
    note: str | None = None


class ObjectiveSpec(BaseModel):
    """Structured, editable objective. Superset of the TS `ObjectiveInput`."""
    model_config = ConfigDict(extra="forbid")

    schema_version: str = OBJECTIVE_SCHEMA_VERSION
    objective_id: str
    objective_text: str
    user_mode: Literal["novice", "expert"] = "novice"

    # what to SENSE (was entirely absent before) vs how to READ it
    application_domain: str | None = None
    intended_function: str | None = None
    sensed_quantity_or_state: str | None = None
    desired_modalities: list[ReadoutMode] = Field(default_factory=list)
    acceptable_readouts: list[ReadoutMode] = Field(default_factory=list)

    # environment / context
    material_context: MaterialContext = MaterialContext.unknown
    immobilization_or_integration: str | None = None
    expression_host: ExpressionHost = ExpressionHost.unknown
    allowed_cofactors: list[str] = Field(default_factory=list)
    excluded_cofactors: list[str] = Field(default_factory=list)
    excitation_allowed: list[str] = Field(default_factory=list, description="excitation labels, e.g. blue-light/green-light/red-light/UV")
    excitation_ranges_nm: list[tuple[float, float]] = Field(default_factory=list)
    static_field_range_mT: tuple[float, float] | None = None
    rf_frequency_range_MHz: tuple[float, float] | None = None
    temperature_range_C: tuple[float, float] | None = None
    pH_range: tuple[float, float] | None = None
    oxygen_condition: Literal["aerobic", "anaerobic", "controlled", "unknown"] = "unknown"

    # response requirements
    response_direction: Literal["increase", "decrease", "either", "unknown"] = "unknown"
    minimum_effect_size: float | None = Field(default=None, description="required |ΔF/F| or dynamic range")
    maximum_response_time_s: float | None = None
    assay_geometry: str | None = None
    available_instrumentation: list[str] = Field(default_factory=list)
    instrument_id: str | None = None

    # multi-objective controls
    optimization_objectives: list[tuple[str, float]] = Field(
        default_factory=list, description="(component_name, weight) pairs",
    )
    hard_constraints: list[str] = Field(default_factory=list)
    soft_preferences: list[str] = Field(default_factory=list)

    # retrieval seeds (mechanism-route query planning)
    seed_query: str | None = Field(default=None, description="explicit UniProt Lucene query for expert mode")
    seed_accessions: list[str] = Field(default_factory=list)
    target_scaffold_families: list[ScaffoldFamily] = Field(default_factory=list)
    include_unreviewed: bool = False

    # honesty + boundary
    manufacturing_constraints: list[str] = Field(default_factory=list)
    safety_constraints: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    forbidden_assumptions: list[str] = Field(default_factory=list)
    field_provenance: list[FieldProvenance] = Field(default_factory=list)
    confidential_sequence_provided: Literal[False] = False

    seed: int = 1337
