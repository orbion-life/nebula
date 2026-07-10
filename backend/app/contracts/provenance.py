"""Provenance contracts.

Two distinct kinds, deliberately separated:

- `Provenance` — RETRIEVAL-time: which provider, which exact URL, when, what
  release/version, live vs cached vs fixture, license note. Attached to every
  fetched record so nothing in a result is unsourced.
- `ParameterProvenance` — NUMERIC: source type, citation/assumption, range,
  unit, uncertainty, applicability limits. Mirrors the TS `ParameterProvenance`.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from .enums import ParameterSourceType, ProviderId, RetrievalMode, Uncertainty


class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    authors: str
    year: int
    title: str
    venue: str
    doi: str


class Provenance(BaseModel):
    """Retrieval-time provenance for one provider call."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    provider: ProviderId
    endpoint_url: str = Field(description="the exact URL fetched (or the fixture path)")
    http_status: int | None = None
    retrieved_at: datetime
    mode: RetrievalMode
    source_release: str | None = Field(
        default=None, description="e.g. UniProt x-uniprot-release '2026_02'; None where the provider exposes no version",
    )
    cache_control: str | None = None
    etag: str | None = None
    license_note: str | None = None
    citation: Citation | None = None
    disclaimer: str = "public reference retrieval, not sensor validation"


class ParameterProvenance(BaseModel):
    """Full provenance for one numeric (or database-descriptor) parameter."""
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)
    name: str
    value: float | str
    unit: str
    value_range: tuple[float, float] = Field(alias="range")
    uncertainty: Uncertainty
    source_type: ParameterSourceType
    citation_or_assumption: str
    applicability_limits: str
