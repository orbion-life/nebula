import { RADICAL_PAIR_ARTIFACT } from "./generated/radicalPair";
import type {
  ConstructHypothesis,
  InstrumentProfile,
  MechanismRoute,
  RouteClass,
  SimulationEvidence,
  Trace,
} from "./types";

/**
 * Simulation evidence.
 *
 * For each candidate/route we compute — BEFORE ranking — what the experiment
 * would look like under a specific instrument: the peak observable signature
 * reachable within the instrument's field/RF envelope, the expected SNR against
 * its noise floor, the ensemble uncertainty, how well the signature can be
 * distinguished from nuisances, and how completely the required controls can be
 * run. Changing the physics (the artifact) or the instrument changes these
 * numbers and therefore changes the ranking.
 *
 * Radical-pair routes are driven by the Python-generated spin-dynamics artifact.
 * Other routes use transparent, mechanism-shaped proxy magnitudes grounded in
 * the public parameter space (never a prediction for any construct).
 */

/** Peak fractional signature and actuation needs per route class. */
interface RouteSignatureSpec {
  /** Peak |ΔF/F| the mechanism could produce (proxy magnitude); RP is computed. */
  peakDeltaFOverF: number;
  needsStaticField: boolean;
  needsRF: boolean;
}

// Non-radical-pair peaks are UNCITED, illustrative mechanism-shaped magnitudes
// (order-of-magnitude only), NOT fitted or measured. Routes carrying these are
// tagged source: "analytic_proxy" so they can never be presented as the
// generated-artifact physics. Only the radical-pair route uses computed physics.
const ROUTE_SIGNATURE: Record<RouteClass, RouteSignatureSpec> = {
  // Radical-pair peaks are overwritten from the artifact; the value here is a
  // fallback only.
  LOV_flavin_radical_pair: { peakDeltaFOverF: 0.02, needsStaticField: true, needsRF: false },
  cryptochrome_FAD_radical_pair: { peakDeltaFOverF: 0.02, needsStaticField: true, needsRF: false },
  triplet_FP: { peakDeltaFOverF: 0.016, needsStaticField: false, needsRF: true },
  RFP_flavin_photochemical: { peakDeltaFOverF: 0.35, needsStaticField: false, needsRF: false },
  redox_electrochemical: { peakDeltaFOverF: 0.45, needsStaticField: false, needsRF: false },
  material_state: { peakDeltaFOverF: 0.3, needsStaticField: false, needsRF: false },
  metal_cofactor_confounder: { peakDeltaFOverF: 0, needsStaticField: false, needsRF: false },
  unsupported: { peakDeltaFOverF: 0, needsStaticField: false, needsRF: false },
};

/** Typical competing nuisance amplitude (fractional) used for discrimination. */
const NUISANCE_FLOOR = 0.05;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Fluorescence transduction coefficient recorded in the artifact provenance. */
function transductionCoefficient(): number {
  const p = RADICAL_PAIR_ARTIFACT.parameters.find(
    (x) => x.name === "c_transduction_fluorescence",
  );
  return typeof p?.value === "number" ? p.value : 0.5;
}

/**
 * Radical-pair peak fractional signature ΔF/F within an instrument field range.
 * dF/F(B) = c_transduction * phi_S(0) * MFE%(B) / 100  (assumption-derived).
 * `mfeOverride` lets a counterfactual test inject a different physics curve.
 */
export function radicalPairSignature(
  fieldRange: [number, number],
  mfeOverride?: number[],
): { signature: number; ensembleStd: number } {
  const art = RADICAL_PAIR_ARTIFACT.data;
  const c = transductionCoefficient();
  const phi0 = art.singletYield[0];
  const mfe = mfeOverride ?? art.mfePercent;
  const dff = mfe.map((m) => c * phi0 * (m / 100));
  // Peak |ΔF/F| within the instrument's reachable field, and the ensemble std
  // AT that field (not the global-max std) — an honest per-signature uncertainty.
  let signature = 0;
  let peakIdx = 0;
  for (let i = 0; i < dff.length; i++) {
    if (art.B0_mT[i] >= fieldRange[0] && art.B0_mT[i] <= fieldRange[1] && Math.abs(dff[i]) > signature) {
      signature = Math.abs(dff[i]);
      peakIdx = i;
    }
  }
  const ensembleStd = (c * phi0 * art.ensemble.stdMfePercent[peakIdx]) / 100;
  return { signature, ensembleStd };
}

function canRunControl(control: string, inst: InstrumentProfile): boolean {
  const c = control.toLowerCase();
  if (c.includes("oxygen")) return inst.oxygenControl;
  if (c.includes("temperature")) return inst.temperatureControl;
  if (c.includes("rf ")) return inst.rfAvailable;
  if (
    c.includes("light") ||
    c.includes("photobleach") ||
    c.includes("dark-recovery") ||
    c.includes("illuminat") ||
    c.includes("no-field")
  ) {
    return inst.illuminationControllable;
  }
  // Sample-prep controls (redox titration, pH, reference fluorophore, apo,
  // transduction-path specification) are not instrument-limited.
  return true;
}

function controlCompleteness(route: MechanismRoute, inst: InstrumentProfile): number {
  if (route.controlRequirements.length === 0) return 1;
  const runnable = route.controlRequirements.filter((c) => canRunControl(c, inst)).length;
  return runnable / route.controlRequirements.length;
}

function nuisanceRisk(route: MechanismRoute, inst: InstrumentProfile): number {
  if (route.confounders.length === 0) return 0;
  const perConfounder = route.confounders.map((conf) => {
    const c = conf.toLowerCase();
    if (c.includes("oxygen")) return inst.oxygenControl ? 0.25 : 0.85;
    if (c.includes("temperature")) return inst.temperatureControl ? 0.25 : 0.8;
    if (c.includes("photobleach")) return inst.illuminationControllable ? 0.3 : 0.75;
    // intrinsic confounders the instrument cannot control away
    return 0.7;
  });
  return clamp01(perConfounder.reduce((a, b) => a + b, 0) / perConfounder.length);
}

export interface SimulationEvidenceOpts {
  /** Display traces (from the simulator) attached to the evidence. */
  traces?: Trace[];
  /** Physics counterfactual: override the radical-pair MFE% curve. */
  radicalPairMfeOverride?: number[];
}

export function computeSimulationEvidence(
  h: ConstructHypothesis,
  route: MechanismRoute,
  inst: InstrumentProfile,
  seed: number,
  opts: SimulationEvidenceOpts = {},
): SimulationEvidence {
  const spec = ROUTE_SIGNATURE[route.routeClass];
  const usesArtifact = route.simulatorPlugin === "radical_pair_response_proxy";

  let signatureMetric: number;
  let ensembleStd: number;
  let source: SimulationEvidence["source"];
  let artifactRef: string | undefined;

  if (usesArtifact) {
    const { signature, ensembleStd: std } = radicalPairSignature(
      inst.staticFieldRange_mT,
      opts.radicalPairMfeOverride,
    );
    signatureMetric = signature;
    ensembleStd = std;
    source = "generated_artifact";
    artifactRef = `radical_pair_mary.${RADICAL_PAIR_ARTIFACT.schemaVersion}@${RADICAL_PAIR_ARTIFACT.contentHash.slice(
      0,
      12,
    )}`;
  } else {
    signatureMetric = spec.needsRF && !inst.rfAvailable ? 0 : spec.peakDeltaFOverF;
    ensembleStd = signatureMetric * 0.3;
    source = "analytic_proxy";
  }

  const readoutOk = route.supportedReadouts.some((r) => inst.readoutModes.includes(r));
  const rfOk = !spec.needsRF || inst.rfAvailable;
  const expectedSNR = signatureMetric / inst.minDetectableDeltaFOverF;
  const observable = readoutOk && rfOk && signatureMetric > 0 && expectedSNR >= 1;

  const controls = controlCompleteness(route, inst);
  const nuisance = nuisanceRisk(route, inst);
  const mechanismDiscrimination = observable
    ? clamp01(
        (signatureMetric / (signatureMetric + NUISANCE_FLOOR)) *
          (0.5 + 0.5 * controls),
      )
    : 0.05;

  const traces = opts.traces ?? [];
  const seriesProvenance: SimulationEvidence["seriesProvenance"] = {};
  for (const t of traces) {
    seriesProvenance[t.id] = "simulation";
  }

  return {
    routeId: route.id,
    hypothesisId: h.id,
    source,
    artifactRef,
    signatureMetric,
    signatureUnit: "ΔF/F (assumption-derived, F₀-normalized)",
    expectedSNR,
    observable,
    ensembleStd,
    mechanismDiscrimination,
    controlCompleteness: controls,
    nuisanceRisk: nuisance,
    traces,
    seriesProvenance,
    seed,
  };
}
