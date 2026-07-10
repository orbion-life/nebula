"""Run state machine.

Linear discovery pipeline (simulation happens BEFORE ranking) with two escape
states (failed, cancelled). Transitions are the single source of truth; the
orchestrator may only move a run along an allowed edge.
"""
from __future__ import annotations

from ..contracts.enums import TERMINAL_STATUSES, RunStatus

# from_status -> allowed next statuses
ALLOWED_TRANSITIONS: dict[RunStatus, frozenset[RunStatus]] = {
    RunStatus.queued: frozenset({RunStatus.compiling_objective, RunStatus.cancelled}),
    RunStatus.compiling_objective: frozenset({RunStatus.retrieving_evidence, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.retrieving_evidence: frozenset({RunStatus.assessing_physics, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.assessing_physics: frozenset({RunStatus.simulating, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.simulating: frozenset({RunStatus.ranking, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.ranking: frozenset({RunStatus.planning, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.planning: frozenset({RunStatus.completed, RunStatus.failed, RunStatus.cancelled}),
    RunStatus.completed: frozenset(),
    RunStatus.failed: frozenset(),
    RunStatus.cancelled: frozenset(),
}

# the happy-path order, used for progress fractions
PIPELINE_ORDER: tuple[RunStatus, ...] = (
    RunStatus.queued,
    RunStatus.compiling_objective,
    RunStatus.retrieving_evidence,
    RunStatus.assessing_physics,
    RunStatus.simulating,
    RunStatus.ranking,
    RunStatus.planning,
    RunStatus.completed,
)


class IllegalTransition(ValueError):
    pass


def can_transition(frm: RunStatus, to: RunStatus) -> bool:
    return to in ALLOWED_TRANSITIONS.get(frm, frozenset())


def assert_transition(frm: RunStatus, to: RunStatus) -> None:
    if not can_transition(frm, to):
        raise IllegalTransition(f"illegal run transition {frm.value} -> {to.value}")


def is_terminal(status: RunStatus) -> bool:
    return status in TERMINAL_STATUSES


def progress_fraction(status: RunStatus) -> float:
    """0..1 progress along the happy path (terminal error/cancel report 1.0)."""
    if status in (RunStatus.failed, RunStatus.cancelled):
        return 1.0
    try:
        idx = PIPELINE_ORDER.index(status)
    except ValueError:
        return 0.0
    return round(idx / (len(PIPELINE_ORDER) - 1), 3)
