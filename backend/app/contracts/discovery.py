"""Discovery mathematics + two-lane contracts.

Separate dimensions, never one magic score:
  P  mechanistic plausibility
  M  measurability (can THIS instrument observe the effect)
  D  developability
  N  novelty vs known sensor mechanisms
  U  epistemic uncertainty / model disagreement
  IG expected information gain from measurement
  C  experimental cost

Hard rules encoded downstream: novelty (N) and uncertainty (U) NEVER raise P, M,
D, or predicted performance; they only inform lane placement and information
value. Evidence lane maximizes P·M·D; frontier lane maximizes IG·N·coverage
subject to floors on P, M, safety, and control completeness.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .enums import ClaimLevel, DiscoveryLane, ExplorationLevel
from .mechanism import MechanismGraph


class ExplorationReason(BaseModel):
    """Why a candidate sits at a given relaxation level / lane."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    level: ExplorationLevel
    outside_family_because: str | None = None      # frontier: why it's outside familiar family space
    physical_constraints_satisfied: list[str] = Field(default_factory=list)
    assumptions_remaining: list[str] = Field(default_factory=list)
    claim_ceiling: ClaimLevel  # each level lowers this


class DiscoveryScore(BaseModel):
    """Uncalibrated triage dimensions + lane assignment. No magic scalar or probability."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    candidate_id: str
    P_plausibility: float = Field(ge=0.0, le=1.0)
    M_measurability: float = Field(ge=0.0, le=1.0)
    D_developability: float = Field(ge=0.0, le=1.0)
    N_novelty: float = Field(ge=0.0, le=1.0)
    U_uncertainty: float = Field(ge=0.0, le=1.0)
    IG_information_gain: float = Field(ge=0.0, le=1.0)
    C_cost: float = Field(ge=0.0, le=1.0)
    lane: DiscoveryLane
    exploration: ExplorationReason
    pareto_rank: int = Field(description="1 = on the Pareto frontier for its lane's objectives")
    dominated_by: list[str] = Field(default_factory=list)
    rationale: str
    # Route-compatible registry scenario for this candidate. It is a handoff starting point,
    # not a recommendation or proof that the instrument can resolve the biological effect.
    suggested_instrument_id: str | None = None
    # the composed mechanism graph for this candidate: an ordered causal chain whose per-step
    # knowledge states (known/assumed/unknown) make the honest gaps explicit. Not a prediction.
    mechanism_graph: MechanismGraph | None = None


class DiscriminatingExperiment(BaseModel):
    """A lowest-cost measurement intended to discriminate a route from its controls."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    what_to_measure: str
    instrument_id: str | None = None
    expected_signature: str
    null_expectation: str
    positive_controls: list[str] = Field(default_factory=list)
    negative_controls: list[str] = Field(default_factory=list)
    replicate_plan: str
    acceptance_rule: str
    kill_criterion: str
    information_gained: str
    approx_cost: str


class CandidateMeasurementProposal(BaseModel):
    """Route-specific, falsifiable measurement handoff for any ranked candidate.

    Evidence-lane candidates need an actionable next measurement just as much as
    frontier candidates do. This contract deliberately carries no performance claim.
    """
    model_config = ConfigDict(extra="forbid", frozen=True)
    candidate_id: str
    accession: str
    title: str
    discriminating_experiment: DiscriminatingExperiment
    falsifier: str
    claim_ceiling: ClaimLevel


class FrontierExperiment(BaseModel):
    """A frontier-lane result: a plausible, measurable, out-of-family hypothesis."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    candidate_id: str
    accession: str
    title: str
    outside_family_because: str
    physical_constraints_satisfied: list[str]
    assumptions_remaining: list[str]
    discriminating_experiment: DiscriminatingExperiment
    falsifier: str
    score: DiscoveryScore
    claim_ceiling: ClaimLevel
