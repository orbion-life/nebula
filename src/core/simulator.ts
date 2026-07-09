import { hashSeed, linspace, mulberry32, noise, round } from "./rng";
import { nominal } from "./physics";
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
 * MECHANISM-SHAPED PROXIES, not physics solvers. Every trace is a synthetic
 * assumption sweep, deterministic for a fixed seed. These curves show what a
 * measurement COULD look like under the stated assumptions so a team can decide
 * whether it is worth measuring — they are not predictions of biology.
 *
 * proxy equations (see .claude/skills/physics-data-simulation):
 *   saturating(B)    = amplitude * B^2 / (B^2 + Bhalf^2)  // high-field rise
 *   lowFieldEffect(B)= depth * (B/Blfe) * exp(1 - B/Blfe) // non-monotonic dip
 *   response(B)      = saturating(B) - lowFieldEffect(B)
 *   rf_effect        = response(B) * rf_gain
 *   bleach(t)        = exp(-k_bleach * t) + baseline_drift * t
 *   observed(t)      = baseline + response * bleach - nuisance
 *
 * The field response deliberately includes a low-field effect (LFE): radical-pair
 * magnetic field effects are characteristically NON-monotonic at low field, not a
 * clean saturating rise. This is still a mechanism-SHAPED proxy — the shape is
 * illustrative and the sign/magnitude are not claimed for any real construct.
 */

const DEFAULT_SEED = 1337;

/**
 * Radical-pair field response proxy including a low-field effect.
 * Not a spin-Hamiltonian solution; shape is illustrative only.
 */
function rpResponse(
  b: number,
  amp: number,
  bHalf: number,
  lfeDepth: number,
  bLfe: number,
): number {
  const saturating = (amp * b * b) / (b * b + bHalf * bHalf);
  const lowFieldEffect = lfeDepth * (b / bLfe) * Math.exp(1 - b / bLfe);
  return saturating - lowFieldEffect;
}

export function simulate(
  route: MechanismRoute,
  space: PhysicsParameterSpace,
  seed: number = DEFAULT_SEED,
): SimulationOutput {
  const routeSeed = (seed ^ hashSeed(route.id)) >>> 0;
  const traces: Trace[] = [];

  switch (route.simulatorPlugin) {
    case "radical_pair_response_proxy":
      traces.push(...radicalPairTraces(space, routeSeed));
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

function radicalPairTraces(
  space: PhysicsParameterSpace,
  seed: number,
): Trace[] {
  const amp = nominal(space, "response_amplitude");
  const bHalf = nominal(space, "field_half_saturation_Bhalf");
  const lfeDepth = nominal(space, "lfe_depth");
  const bLfe = nominal(space, "lfe_field_Blfe");
  const rfGain = nominal(space, "rf_gain");
  const noiseAmp = nominal(space, "acquisition_noise");

  const B = linspace(0, 10, 40);

  const rngOff = mulberry32(seed + 1);
  const dFvsB: Trace = {
    id: "delta_f_vs_b",
    title: "ΔF/F vs static magnetic field (with low-field effect)",
    xLabel: "B field (mT)",
    yLabel: "ΔF/F",
    x: B,
    y: B.map((b) =>
      round(rpResponse(b, amp, bHalf, lfeDepth, bLfe) + noise(rngOff, noiseAmp)),
    ),
    condition:
      "RF off, illuminated — illustrative radical-pair proxy incl. low-field dip; shape illustrative, sign/magnitude not claimed",
    requiredControl: "Illuminated no-field baseline",
    isControl: false,
    isNuisance: false,
  };

  const rngOn = mulberry32(seed + 2);
  const dFvsB_RF: Trace = {
    id: "delta_f_vs_b_rf_on",
    title: "ΔF/F vs field, RF on",
    xLabel: "B field (mT)",
    yLabel: "ΔF/F",
    x: B,
    y: B.map((b) =>
      round(
        rpResponse(b, amp, bHalf, lfeDepth, bLfe) * rfGain +
          noise(rngOn, noiseAmp),
      ),
    ),
    condition: "RF on, illuminated — same illustrative proxy scaled by RF gain",
    requiredControl: "RF off/on paired acquisition",
    isControl: false,
    isNuisance: false,
  };

  // RF off/on contrast at fixed field as a bar-like 2-point trace.
  const rngC = mulberry32(seed + 3);
  const fixedB = 6;
  const off = rpResponse(fixedB, amp, bHalf, lfeDepth, bLfe);
  const on = off * rfGain;
  const rfContrast: Trace = {
    id: "rf_off_on_contrast",
    title: "RF off/on contrast at fixed field",
    xLabel: "condition",
    yLabel: "ΔF/F",
    x: [0, 1],
    y: [round(off + noise(rngC, noiseAmp)), round(on + noise(rngC, noiseAmp))],
    condition: `fixed B = ${fixedB} mT`,
    requiredControl: "Interleaved RF off/on with same illumination",
    isControl: false,
    isNuisance: false,
  };

  return [dFvsB, dFvsB_RF, rfContrast];
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
      condition: "annotation only — presence is not a mechanism",
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
