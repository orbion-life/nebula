import type { MechanismRoute } from "../types";

/**
 * Mechanism route registry.
 *
 * Each route is a transparent causal chain from cofactor/chromophore to a
 * measurable readout, with each step labeled as a public anchor, an assumption,
 * or an unknown. `maxClaimLevel` is the strongest thing the route is allowed to
 * say. Metal/cofactor is deliberately capped at diagnostic_only/confounder.
 */
export const MECHANISM_ROUTES: MechanismRoute[] = [
  {
    id: "route_lov_flavin_rp",
    name: "LOV/flavin radical-pair optical route",
    routeClass: "LOV_flavin_radical_pair",
    requiredCofactors: ["FMN"],
    supportedReadouts: ["fluorescence", "RF_magnetic", "lifetime"],
    causalSteps: [
      { step: "Blue light excites the flavin (FMN) cofactor", support: "public_anchor" },
      {
        step: "Photochemistry can transiently form a spin-correlated radical pair",
        support: "public_anchor",
        failureMode: "Radical pair may not form or may be too short-lived to matter",
      },
      {
        step: "Weak static field modulates radical-pair reaction yield",
        support: "assumption",
        failureMode: "Field effect may be below noise for this scaffold",
      },
      {
        step: "Yield change alters observable fluorescence / recovery kinetics",
        support: "assumption",
        failureMode: "Optical coupling to yield may be negligible",
      },
      { step: "Optical readout under field/RF conditions", support: "public_anchor" },
    ],
    simulatorPlugin: "radical_pair_response_proxy",
    controlRequirements: [
      "Illuminated no-field control",
      "RF off/on paired control",
      "Photobleaching decay control",
      "Oxygen level control",
    ],
    confounders: ["photobleaching", "oxygen quenching", "temperature drift"],
    maxClaimLevel: "measurement_triage",
    publicAnchors: ["ev_radical_pair_mfe", "ev_flavin_photochemistry", "ev_lov_photocycle"],
  },
  {
    id: "route_cry_fad_rp",
    name: "Cryptochrome/FAD radical-pair route",
    routeClass: "cryptochrome_FAD_radical_pair",
    requiredCofactors: ["FAD"],
    supportedReadouts: ["fluorescence", "RF_magnetic"],
    causalSteps: [
      { step: "Blue light excites FAD in a cryptochrome-like scaffold", support: "public_anchor" },
      {
        step: "Electron transfer along a tryptophan chain forms a radical pair",
        support: "public_anchor",
        failureMode: "Chain geometry may not support a long-lived pair",
      },
      {
        step: "Static field modulates singlet/triplet interconversion",
        support: "assumption",
        failureMode: "Effect size uncertain without a specific public fixture",
      },
      {
        step: "Downstream optical/redox observable shifts",
        support: "unknown",
        failureMode: "Readout coupling not established for arbitrary constructs",
      },
    ],
    simulatorPlugin: "radical_pair_response_proxy",
    controlRequirements: [
      "Illuminated no-field control",
      "Oxygen level control",
      "Photobleaching decay control",
    ],
    confounders: ["oxygen quenching", "photobleaching", "weak effect size"],
    maxClaimLevel: "diagnostic_only",
    publicAnchors: ["ev_cryptochrome_fad", "ev_radical_pair_mfe", "ev_flavin_photochemistry"],
  },
  {
    id: "route_triplet_fp",
    name: "Triplet-state fluorescent-protein (ODMR-like) route",
    routeClass: "triplet_FP",
    requiredCofactors: ["intrinsic chromophore"],
    supportedReadouts: ["fluorescence", "ODMR_like", "lifetime"],
    causalSteps: [
      { step: "Excitation populates the chromophore excited state", support: "public_anchor" },
      {
        step: "Intersystem crossing populates a triplet/dark state",
        support: "public_anchor",
        failureMode: "Triplet yield may be very low",
      },
      {
        step: "RF resonance perturbs triplet spin sublevels (ODMR-like)",
        support: "assumption",
        failureMode: "Clean protein ODMR contrast is not established",
      },
      {
        step: "Fluorescence intensity/lifetime shifts with RF",
        support: "unknown",
        failureMode: "Contrast may be unobservable at ambient conditions",
      },
    ],
    simulatorPlugin: "triplet_lifetime_proxy",
    controlRequirements: [
      "RF off/on paired control",
      "Oxygen control (triplet quenching)",
      "Photobleaching decay control",
      "Temperature control",
    ],
    confounders: ["oxygen quenching", "low triplet yield", "photobleaching"],
    maxClaimLevel: "diagnostic_only",
    publicAnchors: ["ev_fp_triplet", "ev_oxygen_quenching"],
  },
  {
    id: "route_rfp_flavin_photo",
    name: "RFP + flavin photochemical (light-history) route",
    routeClass: "RFP_flavin_photochemical",
    requiredCofactors: ["FMN", "intrinsic chromophore"],
    supportedReadouts: ["fluorescence", "lifetime"],
    causalSteps: [
      { step: "Flavin photochemistry driven by prior light history", support: "public_anchor" },
      {
        step: "Photoproduct modulates nearby red fluorescent protein signal",
        support: "assumption",
        failureMode: "Coupling depends on proximity/geometry that is not fixed here",
      },
      { step: "Fluorescence reports integrated light history", support: "assumption" },
    ],
    simulatorPlugin: "photokinetic_ode_proxy",
    controlRequirements: [
      "Explicit light-history control",
      "Photobleaching decay control",
      "Dark-recovery control",
    ],
    confounders: ["photobleaching", "light-history ambiguity"],
    maxClaimLevel: "measurement_triage",
    publicAnchors: ["ev_flavin_photochemistry", "ev_photobleaching"],
  },
  {
    id: "route_redox_electrochem",
    name: "Redox/electrochemical flavoprotein route",
    routeClass: "redox_electrochemical",
    requiredCofactors: ["FAD", "FMN"],
    supportedReadouts: ["redox_electrochemical", "fluorescence"],
    causalSteps: [
      { step: "Flavin redox state set by chemical/electrochemical environment", support: "public_anchor" },
      {
        step: "Redox state modulates fluorescence and electrochemical signal",
        support: "public_anchor",
        failureMode: "Cross-talk with pH and oxygen",
      },
      { step: "Readout tracks a controllable chemical variable", support: "assumption" },
    ],
    simulatorPlugin: "redox_response_proxy",
    controlRequirements: [
      "Redox titration control",
      "Oxygen control",
      "pH control",
    ],
    confounders: ["oxygen", "pH cross-talk", "electrode fouling"],
    maxClaimLevel: "measurement_triage",
    publicAnchors: ["ev_redox_flavoprotein", "ev_oxygen_quenching"],
  },
  {
    id: "route_material_state",
    name: "Material-state (hydrogel/film) response route",
    routeClass: "material_state",
    requiredCofactors: [],
    supportedReadouts: ["material_state", "fluorescence", "lifetime"],
    causalSteps: [
      { step: "Material swelling/crosslink state changes fluorophore environment", support: "public_anchor" },
      {
        step: "Environment shift alters intensity/lifetime",
        support: "public_anchor",
        failureMode: "Confounded by bleaching and temperature",
      },
      { step: "Signal reports material state", support: "assumption" },
    ],
    simulatorPlugin: "material_state_proxy",
    controlRequirements: [
      "Reference fluorophore control",
      "Temperature control",
      "Photobleaching decay control",
    ],
    confounders: ["temperature drift", "photobleaching", "scattering"],
    maxClaimLevel: "measurement_triage",
    publicAnchors: ["ev_material_state", "ev_photobleaching"],
  },
  {
    id: "route_metal_confounder",
    name: "Metal/cofactor annotation (confounder-only)",
    routeClass: "metal_cofactor_confounder",
    requiredCofactors: ["metal ion"],
    supportedReadouts: ["fluorescence"],
    causalSteps: [
      { step: "A metal/paramagnetic cofactor is present", support: "public_anchor" },
      {
        step: "No established optical spin-transduction path is supplied",
        support: "unknown",
        failureMode: "Presence is not a mechanism; readout coupling is undefined",
      },
    ],
    simulatorPlugin: "confounder_annotation",
    controlRequirements: [
      "Apo (metal-free) control",
      "Explicit transduction-path specification before any claim",
    ],
    confounders: ["no defined readout path", "spectral interference"],
    maxClaimLevel: "diagnostic_only",
    publicAnchors: ["ev_metal_confounder"],
  },
];

export function routeById(id: string): MechanismRoute | undefined {
  return MECHANISM_ROUTES.find((r) => r.id === id);
}

export function routeByClass(routeClass: string): MechanismRoute | undefined {
  return MECHANISM_ROUTES.find((r) => r.routeClass === routeClass);
}
