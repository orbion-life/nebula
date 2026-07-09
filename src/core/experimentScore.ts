import type {
  ArchitectureKind,
  ClaimLevel,
  ExperimentScore,
  ExperimentScoreComponents,
  InstrumentProfile,
  MechanismRoute,
  ObjectiveInput,
  ReadoutMode,
  SimulationEvidence,
} from "./types";

/**
 * Experiment-value ranking.
 *
 * Replaces the old heuristic "worthiness" score (and its arbitrary display
 * offset). Ranks the NEXT EXPERIMENT to run using eight transparent components
 * derived from the pre-computed SimulationEvidence and the chosen instrument:
 *
 *   + expected information gain    (objective-aligned mechanism-resolution value)
 *   + expected observability / SNR (can the instrument see it at all)
 *   + instrument compatibility     (readout / field / RF actuation fit)
 *   + mechanism discrimination     (distinguishable from nuisances)
 *   + uncertainty reduction        (does measuring shrink the unknown)
 *   + control completeness         (can the required controls be run)
 *   - execution burden             (construct + control + RF complexity)
 *   - nuisance / confounder risk   (swamping risk)
 *
 * No hidden weights, no normalization offset, no predicted sensor performance.
 * The score answers only: which measurement is most worth running next, and it
 * depends on both the physics (SimulationEvidence) and the instrument.
 */

export const EXPERIMENT_WEIGHTS = {
  expectedInformationGain: 0.3,
  expectedObservabilitySNR: 0.18,
  instrumentCompatibility: 0.12,
  mechanismDiscrimination: 0.1,
  uncertaintyReduction: 0.1,
  controlCompleteness: 0.08,
  executionBurden: 0.1, // subtracted
  nuisanceConfounderRisk: 0.12, // subtracted
} as const;

const CLAIM_CEILING_VALUE: Record<ClaimLevel, number> = {
  partner_ready_dossier: 1.0,
  measurement_triage: 0.8,
  diagnostic_only: 0.55,
};

const ARCH_BURDEN: Record<ArchitectureKind, number> = {
  single_scaffold: 0.15,
  fusion_reporter: 0.25,
  surface_immobilized: 0.3,
  material_composite: 0.35,
  co_encapsulated_pair: 0.4,
  electrode_coupled: 0.45,
};

/** Informative static-field window (mT) for radical-pair experiments. */
const RP_FIELD_WINDOW = 10;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function unresolvedFraction(route: MechanismRoute): number {
  const n = route.causalSteps.length;
  if (n === 0) return 0;
  const unresolved = route.causalSteps.filter(
    (s) => s.support === "assumption" || s.support === "unknown",
  ).length;
  return unresolved / n;
}

function objectiveAlignment(
  route: MechanismRoute,
  objective: ObjectiveInput,
): number {
  const desired = new Set<ReadoutMode>(objective.desiredReadouts);
  if (desired.size === 0) return 0.5;
  const overlap = route.supportedReadouts.filter((r) => desired.has(r)).length;
  return clamp01(overlap / desired.size);
}

function readoutOverlap(route: MechanismRoute, inst: InstrumentProfile): number {
  if (route.supportedReadouts.length === 0) return 0;
  const set = new Set(inst.readoutModes);
  const overlap = route.supportedReadouts.filter((r) => set.has(r)).length;
  return overlap / route.supportedReadouts.length;
}

interface ScoreInput {
  hypothesis: { id: string; architectureKind: ArchitectureKind };
  route: MechanismRoute;
  evidence: SimulationEvidence;
}

function componentsFor(
  input: ScoreInput,
  inst: InstrumentProfile,
  objective: ObjectiveInput,
): ExperimentScoreComponents {
  const { route, evidence: e, hypothesis } = input;

  const expectedInformationGain = clamp01(
    CLAIM_CEILING_VALUE[route.maxClaimLevel] *
      (0.4 + 0.6 * unresolvedFraction(route)) *
      (0.5 + 0.5 * objectiveAlignment(route, objective)),
  );

  const expectedObservabilitySNR = e.observable
    ? clamp01(0.6 + 0.4 * clamp01(Math.log10(Math.max(e.expectedSNR, 1)) / Math.log10(30)))
    : 0;

  const needsField = route.simulatorPlugin === "radical_pair_response_proxy";
  const needsRF = route.simulatorPlugin === "triplet_lifetime_proxy";
  const fieldFit = needsField
    ? clamp01(
        (Math.min(inst.staticFieldRange_mT[1], RP_FIELD_WINDOW) -
          inst.staticFieldRange_mT[0]) /
          RP_FIELD_WINDOW,
      )
    : 1;
  const rfFit = needsRF ? (inst.rfAvailable ? 1 : 0) : 1;
  const instrumentCompatibility = clamp01(
    0.5 * readoutOverlap(route, inst) + 0.3 * fieldFit + 0.2 * rfFit,
  );

  const mechanismDiscrimination = clamp01(e.mechanismDiscrimination);

  const uncertaintyReduction = e.observable
    ? clamp01(0.4 + 0.6 * e.controlCompleteness)
    : 0.1;

  const controlCompleteness = clamp01(e.controlCompleteness);

  const executionBurden = clamp01(
    ARCH_BURDEN[hypothesis.architectureKind] +
      0.06 * route.controlRequirements.length +
      (needsRF ? 0.15 : 0),
  );

  const nuisanceConfounderRisk = clamp01(e.nuisanceRisk);

  return {
    expectedInformationGain,
    expectedObservabilitySNR,
    instrumentCompatibility,
    mechanismDiscrimination,
    uncertaintyReduction,
    controlCompleteness,
    executionBurden,
    nuisanceConfounderRisk,
  };
}

function scoreOf(c: ExperimentScoreComponents): number {
  const positive =
    c.expectedInformationGain * EXPERIMENT_WEIGHTS.expectedInformationGain +
    c.expectedObservabilitySNR * EXPERIMENT_WEIGHTS.expectedObservabilitySNR +
    c.instrumentCompatibility * EXPERIMENT_WEIGHTS.instrumentCompatibility +
    c.mechanismDiscrimination * EXPERIMENT_WEIGHTS.mechanismDiscrimination +
    c.uncertaintyReduction * EXPERIMENT_WEIGHTS.uncertaintyReduction +
    c.controlCompleteness * EXPERIMENT_WEIGHTS.controlCompleteness;
  const penalty =
    c.executionBurden * EXPERIMENT_WEIGHTS.executionBurden +
    c.nuisanceConfounderRisk * EXPERIMENT_WEIGHTS.nuisanceConfounderRisk;
  return Math.round(clamp01(positive - penalty) * 1000) / 1000;
}

function rationaleFor(
  c: ExperimentScoreComponents,
  e: SimulationEvidence,
): string {
  const snr = e.observable
    ? `SNR≈${e.expectedSNR.toFixed(1)}`
    : "below instrument noise floor";
  return `${Math.round(c.expectedInformationGain * 100)}% info value · ${snr} · ${Math.round(
    c.controlCompleteness * 100,
  )}% controls runnable · nuisance risk ${Math.round(c.nuisanceConfounderRisk * 100)}%`;
}

export function scoreExperiments(
  inputs: ScoreInput[],
  inst: InstrumentProfile,
  objective: ObjectiveInput,
): ExperimentScore[] {
  const scored = inputs.map((input): ExperimentScore => {
    const components = componentsFor(input, inst, objective);
    return {
      hypothesisId: input.hypothesis.id,
      routeId: input.route.id,
      score: scoreOf(components),
      rank: 0,
      components,
      simulationDriven: true,
      label: "ranked_for_experiment_value_not_predicted_performance",
      rationaleOneLine: rationaleFor(components, input.evidence),
    };
  });

  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.hypothesisId.localeCompare(b.hypothesisId),
  );
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}
