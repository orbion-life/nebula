import { buildBenchmarkComparisons } from "./benchmark";
import { auditClaim } from "./claimFirewall";
import { generateHypotheses } from "./constructGenerator";
import { buildAdapterRequest, runDesignAdapter } from "./designAdapter";
import { buildEvidenceBundle } from "./evidenceBundle";
import { scoreExperiments } from "./experimentScore";
import { defaultInstrument, instrumentById } from "./fixtures/instruments";
import { routeById } from "./fixtures/routes";
import { buildMeasurementPlan } from "./measurementPlan";
import { compileObjective } from "./objectiveCompiler";
import { buildParameterEnsemble } from "./parameterEnsemble";
import { generateParameterSpace } from "./physics";
import { buildRationale } from "./rationale";
import { safeParseObjective } from "./schema";
import { computeSimulationEvidence } from "./simulationEvidence";
import { simulate } from "./simulator";
import type {
  DiscoverResult,
  MechanismRoute,
  RawObjective,
  SimulationEvidence,
  Trace,
} from "./types";

/** Core pipeline output before the mandatory swarm review layer. */
export type DiscoverCore = Omit<DiscoverResult, "swarmReview">;

/** Raised when a raw objective fails Zod validation (surfaced, never bypassed). */
export class ObjectiveValidationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(`Invalid objective: ${issues.join("; ")}`);
    this.name = "ObjectiveValidationError";
    this.issues = issues;
  }
}

function seriesProvenanceFor(
  traces: Trace[],
  route: MechanismRoute,
): SimulationEvidence["seriesProvenance"] {
  const isRP = route.simulatorPlugin === "radical_pair_response_proxy";
  const realPhysicsIds = new Set(["delta_f_vs_b", "delta_yield_vs_rf"]);
  const prov: SimulationEvidence["seriesProvenance"] = {};
  for (const t of traces) {
    // No trace is measured data: real spin-dynamics artifact series are
    // "simulation"; mechanism-shaped proxies and nuisance curves are "assumption".
    prov[t.id] = isRP && realPhysicsIds.has(t.id) ? "simulation" : "assumption";
  }
  return prov;
}

/**
 * Deterministic discovery stages through measurement handoff (no swarm).
 *
 * SIMULATION BEFORE RANKING: every candidate route is simulated under the chosen
 * instrument, and the experiment-value ranking is derived from that evidence.
 */
export function runDiscoverCore(
  raw: RawObjective,
  seed = 1337,
  instrumentId?: string,
): DiscoverCore {
  const parsed = safeParseObjective(raw);
  if (!parsed.ok) {
    // Surface the validation errors instead of silently bypassing Zod.
    throw new ObjectiveValidationError(parsed.issues);
  }
  const objective = compileObjective({ objectiveText: parsed.objectiveText });
  const instrument = instrumentId ? instrumentById(instrumentId) ?? defaultInstrument() : defaultInstrument();

  const evidenceBundle = buildEvidenceBundle(objective, generateHypotheses(objective));
  const hypotheses = generateHypotheses(objective);

  const parameterEnsembles = hypotheses.map((h) =>
    buildParameterEnsemble(routeById(h.mechanismRouteId)!, seed),
  );

  // Simulate every candidate BEFORE ranking (traces filled in for the winner).
  let simulationEvidence: SimulationEvidence[] = hypotheses.map((h) => {
    const route = routeById(h.mechanismRouteId)!;
    return computeSimulationEvidence(h, route, instrument, seed);
  });

  const ranking = scoreExperiments(
    hypotheses.map((h) => ({
      hypothesis: h,
      route: routeById(h.mechanismRouteId)!,
      evidence: simulationEvidence.find((e) => e.hypothesisId === h.id)!,
    })),
    instrument,
    objective,
  );

  const selectedHypothesisId = ranking[0].hypothesisId;
  const selected = hypotheses.find((h) => h.id === selectedHypothesisId)!;
  const selectedRoute = routeById(selected.mechanismRouteId)!;

  const parameterSpace = generateParameterSpace(selectedRoute);
  const simulation = simulate(selectedRoute, parameterSpace, seed);

  // Attach the selected route's display traces + series provenance to its evidence.
  simulationEvidence = simulationEvidence.map((e) =>
    e.hypothesisId === selectedHypothesisId
      ? {
          ...e,
          traces: simulation.traces,
          seriesProvenance: seriesProvenanceFor(simulation.traces, selectedRoute),
        }
      : e,
  );

  const rationale = buildRationale(selected, selectedRoute);
  const selectedEvidence = simulationEvidence.find(
    (e) => e.hypothesisId === selectedHypothesisId,
  )!;
  const measurementPlan = buildMeasurementPlan(
    selected,
    selectedRoute,
    selectedEvidence,
    instrument,
    1,
  );
  const benchmarkComparisons = buildBenchmarkComparisons(selectedRoute);

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
    instrument,
    evidenceBundle,
    hypotheses,
    parameterEnsembles,
    simulationEvidence,
    ranking,
    selectedHypothesisId,
    selectedRoute,
    parameterSpace,
    simulation,
    rationale,
    measurementPlan,
    benchmarkComparisons,
    designAdapter,
    requiredControls: selectedRoute.controlRequirements,
    confounders: selectedRoute.confounders,
    blockedClaimExample,
    allowedClaimExample,
  };
}
