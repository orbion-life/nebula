"""Run state contracts — the persisted, immutable-per-input async run."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .candidate import CandidateDossier, CandidateRecord
from .enums import RunStatus
from .objective import ObjectiveSpec
from .provenance import Provenance


class RunEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    at: datetime
    from_status: RunStatus | None = None
    to_status: RunStatus
    stage: str
    note: str | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)


class RunState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str
    # content address over (objective + provider versions + config + seed) — same inputs reproduce the run
    input_fingerprint: str
    status: RunStatus = RunStatus.queued
    seed: int = 1337
    objective: ObjectiveSpec
    instrument_id: str | None = None
    current_stage: str = "queued"
    created_at: datetime
    updated_at: datetime

    candidates: list[CandidateRecord] = Field(default_factory=list)
    dossiers: list[CandidateDossier] = Field(default_factory=list)
    selected_candidate_id: str | None = None
    result_ref: str | None = None

    provider_calls: list[Provenance] = Field(default_factory=list)
    events: list[RunEvent] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    offline: bool = True

    status_note: Literal[
        "diagnostic_only_not_validated"
    ] = "diagnostic_only_not_validated"


class RunCreated(BaseModel):
    """Response to POST /api/runs."""
    model_config = ConfigDict(extra="forbid")
    run_id: str
    status: RunStatus
    input_fingerprint: str
