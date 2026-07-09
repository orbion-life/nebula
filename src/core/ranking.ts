import { routeById } from "./fixtures/routes";
import type {
  ConstructHypothesis,
  MeasurementWorthiness,
  ObjectiveInput,
  WorthinessComponents,
} from "./types";

/**
 * Measurement-worthiness ranking.
 *
 * Scores ONLY measurement-worthiness (should we measure this first?), NEVER
 * predicted sensor performance. Weights are open and printed in the UI. There
 * are no hidden proprietary weights, no Nebula score, no Astra score.
 */

const CLAIM_LEVEL_SUPPORT: Record<string, number> = {
  measurement_triage: 0.85,
  partner_ready_dossier: 1.0,
  diagnostic_only: 0.45,
};

const WEIGHTS: WorthinessComponents = {
  routeSupport: 0.22,
  readoutCompatibility: 0.18,
  constructExecutability: 0.15,
  cofactorFeasibility: 0.12,
  controlQuality: 0.15,
  nuisanceRiskPenalty: 0.1, // subtracted
  uncertaintyPenalty: 0.08, // subtracted
};

/**
 * Score normalization offset.
 *
 * The positive component weights sum to 0.82 and the penalty weights sum to 0.18.
 * Adding this offset lifts the score floor so results occupy a legible ~0..1 band
 * (a perfect, penalty-free route approaches 1.0). It is a fixed, monotonic display
 * transform applied equally to every hypothesis: it NEVER changes rank order and
 * encodes no hidden per-hypothesis weighting.
 */
const SCORE_NORMALIZATION_OFFSET = 0.18;

const EXECUTABILITY: Record<string, number> = {
  single_scaffold: 0.9,
  fusion_reporter: 0.8,
  surface_immobilized: 0.7,
  co_encapsulated_pair: 0.6,
  material_composite: 0.65,
  electrode_coupled: 0.55,
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function componentsFor(
  h: ConstructHypothesis,
  objective: ObjectiveInput,
): WorthinessComponents {
  const route = routeById(h.mechanismRouteId);
  const routeSupport = route ? CLAIM_LEVEL_SUPPORT[route.maxClaimLevel] : 0.3;

  const wanted = new Set(objective.desiredReadouts);
  const overlap = h.readoutModes.filter((r) => wanted.has(r)).length;
  const readoutCompatibility = clamp01(
    wanted.size === 0 ? 0.5 : overlap / wanted.size,
  );

  const constructExecutability = EXECUTABILITY[h.architectureKind] ?? 0.5;

  const cofactorFeasibility = clamp01(
    1 - Math.max(0, h.cofactorOrChromophore.length - 1) * 0.2,
  );

  const controlQuality = clamp01((route?.controlRequirements.length ?? 0) / 4);

  const nuisanceRiskPenalty = clamp01((route?.confounders.length ?? 0) / 4);

  // Higher uncertainty for diagnostic-only routes.
  const uncertaintyPenalty =
    route?.maxClaimLevel === "diagnostic_only" ? 0.8 : 0.35;

  return {
    routeSupport,
    readoutCompatibility,
    constructExecutability,
    cofactorFeasibility,
    controlQuality,
    nuisanceRiskPenalty,
    uncertaintyPenalty,
  };
}

function scoreOf(c: WorthinessComponents): number {
  const positive =
    c.routeSupport * WEIGHTS.routeSupport +
    c.readoutCompatibility * WEIGHTS.readoutCompatibility +
    c.constructExecutability * WEIGHTS.constructExecutability +
    c.cofactorFeasibility * WEIGHTS.cofactorFeasibility +
    c.controlQuality * WEIGHTS.controlQuality;
  const penalty =
    c.nuisanceRiskPenalty * WEIGHTS.nuisanceRiskPenalty +
    c.uncertaintyPenalty * WEIGHTS.uncertaintyPenalty;
  return (
    Math.round(clamp01(positive - penalty + SCORE_NORMALIZATION_OFFSET) * 1000) /
    1000
  );
}

export function rankHypotheses(
  hypotheses: ConstructHypothesis[],
  objective: ObjectiveInput,
): MeasurementWorthiness[] {
  const scored = hypotheses.map((h) => {
    const components = componentsFor(h, objective);
    const score = scoreOf(components);
    const route = routeById(h.mechanismRouteId);
    return {
      hypothesisId: h.id,
      score,
      rank: 0,
      components,
      label: "ranked_for_measurement_triage_not_performance" as const,
      rationaleOneLine: `${route?.maxClaimLevel ?? "unsupported"} route; ${
        Math.round(components.readoutCompatibility * 100)
      }% readout match; ${route?.confounders.length ?? 0} known confounders.`,
    };
  });

  // Deterministic ordering: score desc, then hypothesisId asc for ties.
  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.hypothesisId.localeCompare(b.hypothesisId),
  );
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}

export const RANKING_WEIGHTS = WEIGHTS;
