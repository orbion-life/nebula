import { hashSeed, linspace, mulberry32, noise, round } from "./rng";
import { nominal } from "./physics";
import { RADICAL_PAIR_ARTIFACT } from "./generated/radicalPair";
import type {
  MechanismRoute,
  PhysicsParameterSpace,
  SimulationOutput,
  Trace,
} from "./types";
import { SYNTHETIC_TRACE_LABEL } from "./types";

/**
 * Multimodal signal simulator.
 *
 * The radical-pair route is driven by the Python-generated spin-dynamics
 * artifact (src/data/generated/radical_pair_mary.v1.json): a real Zeeman +
 * hyperfine + Haberkorn + relaxation MARY curve and an eigenspectrum-derived RF
 * response. RF is a frequency-resolved resonance, NOT a scalar multiplier.
 *
 * The remaining routes use transparent MECHANISM-SHAPED PROXIES (not physics
 * solvers). Every trace is a synthetic assumption sweep, deterministic for a
 * fixed seed. These curves show what a measurement COULD look like under the
 * stated assumptions so a team can decide whether it is worth measuring, they
 * are not predictions of biology.
 *
 * proxy equations (non-radical-pair routes):
 *   bleach(t)        = exp(-k_bleach * t) + baseline_drift * t
 *   observed(t)      = baseline + response - nuisance
 */

const DEFAULT_SEED = 1337;

export function simulate(
  route: MechanismRoute,
  space: PhysicsParameterSpace,
  seed: number = DEFAULT_SEED,
): SimulationOutput {
  const routeSeed = (seed ^ hashSeed(route.id)) >>> 0;
  const traces: Trace[] = [];

  switch (route.simulatorPlugin) {
    case "radical_pair_response_proxy":
      traces.push(...radicalPairTraces());
      break;
    case "triplet_lifetime_proxy":
      traces.push(...tripletTraces(space, routeSeed));
      break;
    case "photokinetic_ode_proxy":
      traces.push(...photokineticTraces(space, routeSeed));
      break;
    case "redox_response_proxy":
      traces.push(...redoxTraces(space, routeSeed));
      break;
    case "material_state_proxy":
      traces.push(...materialTraces(space, routeSeed));
      break;
    case "confounder_annotation":
      traces.push(...confounderTraces(routeSeed));
      break;
  }

  // Every non-confounder route also gets the mandatory nuisance/control traces:
  // photobleaching (control), oxygen and temperature (nuisances). These can each
  // swamp a small spin-linked signal, so they are always simulated.
  if (route.simulatorPlugin !== "confounder_annotation") {
    traces.push(bleachControl(space, routeSeed));
    traces.push(oxygenNuisance(space, routeSeed));
    traces.push(temperatureNuisance(space, routeSeed));
  }

  return {
    label: SYNTHETIC_TRACE_LABEL,
    routeId: route.id,
    seed,
    traces,
    confounders: route.confounders,
  };
}

/**
 * Radical-pair traces from the generated spin-dynamics artifact (real physics).
 * The MARY curve carries the characteristic non-monotonic low-field effect, and
 * the RF trace is a frequency-resolved resonance (never a scalar multiplier).
 * No synthetic noise is added: these are the deterministic model outputs.
 */
function radicalPairTraces(): Trace[] {
  const art = RADICAL_PAIR_ARTIFACT.data;

  const dFvsB: Trace = {
    id: "delta_f_vs_b",
    title: "ΔF/F vs static magnetic field (radical-pair spin dynamics)",
    xLabel: "B field (mT)",
    yLabel: "ΔF/F (assumption-derived)",
    x: art.B0_mT,
    y: art.dFF_assumptionDerived,
    condition:
      "singlet-born FAD•−/TrpH•+ pair; Zeeman + hyperfine + Haberkorn + relaxation; low-field effect visible",
    requiredControl: "Illuminated no-field baseline; subtract photobleach control",
    isControl: false,
    isNuisance: false,
  };

  const rf: Trace = {
    id: "delta_yield_vs_rf",
    title: "Fluorescence contrast vs RF frequency (resonance)",
    xLabel: "RF frequency (MHz)",
    yLabel: "normalized contrast",
    x: art.rf.freq_MHz,
    y: art.rf.rfResponseNormalized,
    condition: `fixed B0 = ${art.rf.workingField_mT} mT, B1 = ${art.rf.b1_mT} mT; resonance from static-Hamiltonian eigen-gaps (not a scalar gain)`,
    requiredControl: "RF off (B1 = 0) reference, must be flat",
    isControl: false,
    isNuisance: false,
  };

  return [dFvsB, rf];
}

function tripletTraces(
  space: PhysicsParameterSpace,
  seed: number,
): Trace[] {
  const contrast = nominal(space, "rf_contrast");
  const lifetime = nominal(space, "lifetime_baseline");
  const noiseAmp = nominal(space, "acquisition_noise");
  const t = linspace(0, 10, 40);

  const rng = mulberry32(seed + 1);
  const odmr: Trace = {
    id: "odmr_like_contrast",
    title: "ODMR-like fluorescence contrast vs RF frequency",
    xLabel: "RF detuning (arb.)",
    yLabel: "fractional contrast",
    x: t,
    y: t.map((f) => {
      const resonance = -contrast * Math.exp(-Math.pow((f - 5) / 1.2, 2));
      return round(resonance + noise(rng, noiseAmp));
    }),
    condition: "illuminated, RF swept",
    requiredControl: "RF off reference and oxygen control",
    isControl: false,
    isNuisance: false,
  };

  const rng2 = mulberry32(seed + 2);
  const lifetimeTrace: Trace = {
    id: "lifetime_shift",
    title: "Fluorescence lifetime shift, RF off vs on",
    xLabel: "condition",
    yLabel: "lifetime (ns)",
    x: [0, 1],
    y: [
      round(lifetime + noise(rng2, noiseAmp)),
      round(lifetime * (1 - contrast) + noise(rng2, noiseAmp)),
    ],
    condition: "RF off vs RF on",
    requiredControl: "Paired lifetime acquisition, temperature held",
    isControl: false,
    isNuisance: false,
  };

  return [odmr, lifetimeTrace];
}

function photokineticTraces(
  space: PhysicsParameterSpace,
  seed: number,
): Trace[] {
  const gain = nominal(space, "light_history_gain");
  const tau = nominal(space, "dark_recovery_tau");
  const noiseAmp = nominal(space, "acquisition_noise");
  const t = linspace(0, 120, 60);

  const rng = mulberry32(seed + 1);
  const lightHistory: Trace = {
    id: "light_history_response",
    title: "F/F0 vs time (light on then dark recovery)",
    xLabel: "time (s)",
    yLabel: "F/F0",
    x: t,
    y: t.map((time) => {
      // Continuous (ODE-consistent) photokinetic model: charge toward 1+gain with
      // time constant 15s while lit, then decay from the charged value with tau.
      // Cross-checked against an RK4 integrator in src/core/ode.ts.
      const f60 = gain * (1 - Math.exp(-60 / 15));
      const charging = time < 60 ? gain * (1 - Math.exp(-time / 15)) : 0;
      const recovery = time >= 60 ? f60 * Math.exp(-(time - 60) / tau) : 0;
      const base = 1 + charging + recovery;
      return round(base + noise(rng, noiseAmp));
    }),
    condition: "blue light 0-60s, dark 60-120s",
    requiredControl: "Explicit light-history log + dark recovery control",
    isControl: false,
    isNuisance: false,
  };

  return [lightHistory];
}

function redoxTraces(
  space: PhysicsParameterSpace,
  seed: number,
): Trace[] {
  const span = nominal(space, "redox_span");
  const mid = nominal(space, "midpoint_potential");
  const noiseAmp = nominal(space, "acquisition_noise");
  const V = linspace(-0.5, 0.0, 40);

  const rng = mulberry32(seed + 1);
  const redox: Trace = {
    id: "redox_response",
    title: "Fluorescence vs redox potential (Nernst-like)",
    xLabel: "potential (V)",
    yLabel: "F/F0",
    x: V,
    y: V.map((v) => {
      const frac = 1 / (1 + Math.exp((v - mid) / 0.03));
      return round(1 + span * frac + noise(rng, noiseAmp));
    }),
    condition: "redox titration, oxygen controlled",
    requiredControl: "Redox titration + pH + oxygen controls",
    isControl: false,
    isNuisance: false,
  };

  return [redox];
}

function materialTraces(
  space: PhysicsParameterSpace,
  seed: number,
): Trace[] {
  const sens = nominal(space, "swelling_sensitivity");
  const noiseAmp = nominal(space, "acquisition_noise");
  const swell = linspace(0, 2, 40);

  const rng = mulberry32(seed + 1);
  const material: Trace = {
    id: "material_state_response",
    title: "F/F0 vs material swelling state",
    xLabel: "swelling (a.u.)",
    yLabel: "F/F0 (ratiometric)",
    x: swell,
    y: swell.map((s) => round(1 + sens * s + noise(rng, noiseAmp))),
    condition: "ratiometric vs reference fluorophore",
    requiredControl: "Reference fluorophore + temperature control",
    isControl: false,
    isNuisance: false,
  };

  return [material];
}

function confounderTraces(_seed: number): Trace[] {
  // Deliberately flat/zero: the metal route has no defined readout path.
  const x = linspace(0, 10, 20);
  return [
    {
      id: "no_defined_readout",
      title: "No defined optical spin-transduction path",
      xLabel: "B field (mT)",
      yLabel: "ΔF/F (undefined)",
      x,
      y: x.map(() => 0),
      condition: "annotation only, presence is not a mechanism",
      requiredControl: "Apo (metal-free) control; supply transduction path before any claim",
      isControl: true,
      isNuisance: false,
    },
  ];
}

function bleachControl(
  space: PhysicsParameterSpace,
  seed: number,
): Trace {
  const k = nominal(space, "photobleach_rate_k");
  const drift = nominal(space, "baseline_drift");
  const noiseAmp = nominal(space, "acquisition_noise");
  const t = linspace(0, 60, 40);
  const rng = mulberry32(seed + 11);
  return {
    id: "photobleach_control",
    title: "Photobleaching + baseline-drift control (no field, no RF)",
    xLabel: "time (s)",
    yLabel: "F/F0",
    x: t,
    // exponential bleach plus a slow linear baseline drift term.
    y: t.map((time) =>
      round(Math.exp(-k * time) + drift * (time / 60) + noise(rng, noiseAmp)),
    ),
    condition: "illuminated, no stimulus",
    requiredControl: "This IS the control: subtract before interpreting any response",
    isControl: true,
    isNuisance: false,
  };
}

function temperatureNuisance(
  space: PhysicsParameterSpace,
  seed: number,
): Trace {
  const d = nominal(space, "temperature_drift");
  const noiseAmp = nominal(space, "acquisition_noise");
  const T = linspace(15, 40, 40);
  const rng = mulberry32(seed + 13);
  return {
    id: "temperature_nuisance",
    title: "Temperature drift nuisance curve",
    xLabel: "temperature (°C)",
    yLabel: "signal retained (F/F0)",
    x: T,
    // signal drops ~linearly with temperature away from a 25°C reference.
    y: T.map((t) => round(1 - d * (t - 25) + noise(rng, noiseAmp))),
    condition: "varying temperature",
    requiredControl:
      "Hold/measure temperature; drift can mimic or mask a spin-linked response",
    isControl: false,
    isNuisance: true,
  };
}

function oxygenNuisance(
  space: PhysicsParameterSpace,
  seed: number,
): Trace {
  const q = nominal(space, "oxygen_quench_factor");
  const noiseAmp = nominal(space, "acquisition_noise");
  const o2 = linspace(0, 1, 40);
  const rng = mulberry32(seed + 12);
  return {
    id: "oxygen_nuisance",
    title: "Oxygen quenching nuisance curve",
    xLabel: "relative [O2]",
    yLabel: "signal retained (F/F0)",
    x: o2,
    y: o2.map((o) => round(1 - q * o + noise(rng, noiseAmp))),
    condition: "varying dissolved oxygen",
    requiredControl: "Hold/measure oxygen; a spin-linked signal can be swamped by O2 drift",
    isControl: false,
    isNuisance: true,
  };
}
