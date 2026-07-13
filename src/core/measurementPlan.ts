import { buildFalsificationCriteria } from "./falsification";
import { RADICAL_PAIR_ARTIFACT } from "./generated/radicalPair";
import type {
  ConstructHypothesis,
  InstrumentProfile,
  MeasurementPlan,
  MechanismRoute,
  SimulationEvidence,
} from "./types";

/**
 * Measurement plan, the decisive next-experiment card (the product's top
 * output). It states, for the selected hypothesis under the selected
 * instrument: what to measure, the expected signature and uncertainty, the null
 * expectation, the required positive/negative controls, competing explanations,
 * the exact kill criterion, and what the result would add.
 */

function radicalPairSignatureText(inst: InstrumentProfile): string {
  const d = RADICAL_PAIR_ARTIFACT.data;
  const lfe = Math.min(...d.mfePercent);
  const lfeField = d.B0_mT[d.mfePercent.indexOf(lfe)];
  const rfIdx = d.rf.rfResponseNormalized.indexOf(Math.min(...d.rf.rfResponseNormalized));
  const rfFreq = d.rf.freq_MHz[rfIdx];
  const rfClause = inst.rfAvailable
    ? ` plus an RF-frequency resonance near ${rfFreq.toFixed(0)} MHz (RF off = flat control)`
    : " (no RF actuation on this instrument, static-field curve only)";
  // Ensemble range so the nominal point is not read as the only outcome (W4).
  const means = d.ensemble.meanMfePercent;
  const emin = Math.min(...means);
  const emax = Math.max(...means);
  return `A non-monotonic ΔF/F vs static field: a low-field dip near ${lfeField.toFixed(
    1,
  )} mT (~${lfe.toFixed(1)}% of the yield) rising to a high-field saturation within ${
    inst.staticFieldRange_mT[1]
  } mT${rfClause}. Across the parameter ensemble the field effect spans ~${emin.toFixed(1)}%…+${emax.toFixed(1)}% of the yield.`;
}

function splitControls(
  route: MechanismRoute,
  isRP: boolean,
): { positive: string[]; negative: string[] } {
  const negative: string[] = [];
  const positive: string[] = [];
  for (const c of route.controlRequirements) {
    const lc = c.toLowerCase();
    if (
      lc.includes("no-field") ||
      lc.includes("apo") ||
      lc.includes("metal-free") ||
      lc.includes("reference") ||
      lc.includes("dark")
    ) {
      negative.push(c);
    } else {
      positive.push(c);
    }
  }
  // Every plan carries the mandatory flat photobleach control as a negative.
  negative.push("Illuminated no-stimulus photobleach control (must stay flat)");
  // Radical-pair magnetofluorescence has O2 (paramagnetic; first-order
  // confounder) and temperature (sets recombination/relaxation) as MANDATORY
  // controls, independent of the route's own list.
  if (isRP) {
    const has = (needle: string) =>
      [...positive, ...negative].some((c) => c.toLowerCase().includes(needle));
    if (!has("oxygen")) positive.push("Deoxygenated vs air-saturated O₂ control (mandatory for radical-pair)");
    if (!has("temperature")) positive.push("Temperature-clamped control (recombination/relaxation depend on T)");
  }
  return { positive, negative };
}

export function buildMeasurementPlan(
  h: ConstructHypothesis,
  route: MechanismRoute,
  evidence: SimulationEvidence,
  inst: InstrumentProfile,
  rank: number,
): MeasurementPlan {
  const isRP = route.simulatorPlugin === "radical_pair_response_proxy";
  const { positive, negative } = splitControls(route, isRP);
  const kill = buildFalsificationCriteria(h, route).bullets[0];

  const expectedSignature = isRP
    ? radicalPairSignatureText(inst)
    : `A ${route.supportedReadouts[0].replace(/_/g, " ")} change of order ${(
        evidence.signatureMetric * 100
      ).toFixed(0)}% ΔF/F under the route's controllable variable, above the ${inst.label} noise floor.`;

  const expectedUncertainty = evidence.observable
    ? `Ensemble spread ≈ ±${(evidence.ensembleStd * 100).toFixed(2)}% ΔF/F across the parameter ensemble; expected SNR ≈ ${evidence.expectedSNR.toFixed(
        1,
      )} on ${inst.label}.`
    : `Signature (~${(evidence.signatureMetric * 100).toFixed(
        2,
      )}% ΔF/F) is at or below the ${inst.label} noise floor, NOT observable on this instrument; choose a lower-noise instrument first.`;

  const competingExplanations = [
    ...route.confounders.map((c) => `${c} mimicking or masking the signal`),
    "photobleaching or baseline drift misread as a stimulus response",
  ].slice(0, 4);

  return {
    hypothesisId: h.id,
    routeId: route.id,
    rank,
    instrumentId: inst.id,
    whatToMeasure: isRP
      ? `Fluorescence (ΔF/F) vs static magnetic field${
          inst.rfAvailable ? " and vs RF frequency" : ""
        } for the ${h.scaffoldFamily.replace(/_/g, " ")} construct, interleaved with the no-field baseline.`
      : `The ${route.supportedReadouts[0].replace(/_/g, " ")} readout of the ${h.scaffoldFamily.replace(
          /_/g,
          " ",
        )} construct against its controllable variable, interleaved with controls.`,
    expectedSignature,
    expectedUncertainty,
    nullExpectation:
      "Under the mandatory controls, the readout is FLAT (no field/stimulus-dependent change beyond the photobleach/nuisance envelope).",
    positiveControls: positive,
    negativeControls: negative,
    competingExplanations,
    killCriterion: kill,
    informationGained: evidence.observable
      ? `Resolves whether the ${route.routeClass.replace(
          /_/g,
          " ",
        )} coupling produces a measurable, control-surviving signal for this scaffold class, advancing it from hypothesis toward ${route.maxClaimLevel.replace(
          /_/g,
          " ",
        )} or falsifying it.`
      : `Tells you this signature is not reachable on ${inst.label}; the informative next step is an instrument with a lower noise floor or the required actuation, not this measurement.`,
  };
}
