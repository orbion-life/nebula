/**
 * Research-backed swarm architecture for Nebula.
 *
 * Pattern: Hierarchical Map-Reduce + Producer-Reviewer (Pipeline Triad)
 *
 * References (public, citable):
 * - Map-Reduce parallel specialist workers + reduce aggregation (LangGraph Send API;
 *   AgentPatterns.ai multi-agent map-reduce)
 * - Producer-Reviewer isolation: reviewer sees artifact + frozen rubric only, not
 *   producer reasoning (Planner-Generator-Evaluator / Pipeline Triad patterns)
 * - Severity-weighted consensus instead of majority voting (avoids "consensus trap"
 *   under adversarial majorities; arXiv:2604.17139)
 * - Trusted-first synthesis order for reduce (Frontiers 2026 MAS adversarial robustness)
 * - Two-tier sentry → committee staging (MAS-Shield-style lightweight-then-deep audit)
 */

export const SWARM_ARCHITECTURE_ID =
  "hierarchical-map-reduce-producer-reviewer" as const;

export const SWARM_ARCHITECTURE_VERSION = "1.0.0";

export const SWARM_STAGE_ORDER = [
  "orchestrate",
  "map",
  "reduce",
  "synthesize",
] as const;

/** Committee lenses must agree (same theme) to escalate a warning. */
export const ESCALATION_MIN_COMMITTEE_LENSES = 2;

/** Trusted-first arbiter ordering (sentry lenses that gate release). */
export const TRUSTED_FIRST_LENS_ORDER = [
  "reproducibility-engineer",
  "claim-ip-auditor",
  "protein-engineer",
  "hackathon-judge",
] as const;
