import { auditClaim } from "./claimFirewall";
import { generateHypotheses } from "./constructGenerator";
import { buildAdapterRequest, runDesignAdapter } from "./designAdapter";
import { routeById } from "./fixtures/routes";
import { compileObjective } from "./objectiveCompiler";
import { generateParameterSpace } from "./physics";
import { rankHypotheses } from "./ranking";
import { buildRationale } from "./rationale";
import { safeParseObjective } from "./schema";
import { simulate } from "./simulator";
import type { DiscoverResult, RawObjective } from "./types";

/** Core pipeline output before the mandatory swarm review layer. */
export type DiscoverCore = Omit<DiscoverResult, "swarmReview">;

/**
 * Deterministic discovery stages through measurement handoff (no swarm).
 * Used by the swarm reproducibility lens to avoid circular pipeline calls.
 */
export function runDiscoverCore(
  raw: RawObjective,
  seed = 1337,
): DiscoverCore {
  const parsed = safeParseObjective(raw);
  const objective = compileObjective({
    objectiveText: parsed.ok ? parsed.objectiveText : raw.objectiveText ?? "",
  });
  const hypotheses = generateHypotheses(objective);
  const ranking = rankHypotheses(hypotheses, objective);

  const selectedHypothesisId = ranking[0].hypothesisId;
  const selected = hypotheses.find((h) => h.id === selectedHypothesisId)!;
  const selectedRoute = routeById(selected.mechanismRouteId)!;

  const parameterSpace = generateParameterSpace(selectedRoute);
  const simulation = simulate(selectedRoute, parameterSpace, seed);
  const rationale = buildRationale(selected, selectedRoute);

  const adapterReq = buildAdapterRequest(
    selected,
    objective.materialContext,
    objective.constraints,
  );
  const designAdapter = runDesignAdapter(adapterReq);

  const blockedClaimExample = auditClaim(
    "We discovered a working quantum biosensor that predicts magnetic response.",
  );
  const allowedClaimExample =
    "This public construct hypothesis has a plausible, source-backed mechanism route and is measurement-worthy under transparent synthetic assumptions; it requires experimental validation.";

  return {
    product: "Nebula Discover",
    status: "diagnostic_only_not_validated",
    objective,
    hypotheses,
    ranking,
    selectedHypothesisId,
    selectedRoute,
    parameterSpace,
    simulation,
    rationale,
    designAdapter,
    requiredControls: selectedRoute.controlRequirements,
    confounders: selectedRoute.confounders,
    blockedClaimExample,
    allowedClaimExample,
  };
}
