import type { MechanismRoute, PhysicsParameterSpace, PhysicsParameter } from "./types";

/**
 * Physics data generation.
 *
 * Produces a transparent PARAMETER SPACE for a route: ranges with units,
 * provenance, and uncertainty. These are demo assumptions and public-anchor
 * shaped values, NOT fitted constants and NOT validation. Nothing here is
 * inferred from a sequence, AlphaFold, or ESM.
 */

type ParamSpec = Omit<PhysicsParameter, "route" | "canBeInterpretedAsValidation">;

const COMMON_NUISANCE: ParamSpec[] = [
  { name: "photobleach_rate_k", valueRange: [0.02, 0.15], unit: "1/s", source: "demo_assumption", uncertainty: "medium" },
  { name: "oxygen_quench_factor", valueRange: [0.05, 0.4], unit: "fraction", source: "public_anchor", uncertainty: "high" },
  { name: "temperature_drift", valueRange: [0.0, 0.03], unit: "fraction/degC", source: "demo_assumption", uncertainty: "medium" },
  { name: "acquisition_noise", valueRange: [0.005, 0.03], unit: "fraction", source: "demo_assumption", uncertainty: "low" },
  { name: "baseline_drift", valueRange: [0.0, 0.02], unit: "fraction", source: "demo_assumption", uncertainty: "low" },
];

const ROUTE_PARAMS: Record<string, ParamSpec[]> = {
  radical_pair_response_proxy: [
    { name: "response_amplitude", valueRange: [0.005, 0.06], unit: "ΔF/F", source: "demo_assumption", uncertainty: "high" },
    { name: "field_half_saturation_Bhalf", valueRange: [0.5, 5], unit: "mT", source: "demo_assumption", uncertainty: "high" },
    { name: "lfe_depth", valueRange: [0.002, 0.02], unit: "ΔF/F", source: "public_anchor", uncertainty: "high" },
    { name: "lfe_field_Blfe", valueRange: [0.2, 1.0], unit: "mT", source: "public_anchor", uncertainty: "high" },
    { name: "rf_gain", valueRange: [0.8, 1.3], unit: "x", source: "demo_assumption", uncertainty: "high" },
    { name: "radical_lifetime_window", valueRange: [0.1, 2], unit: "us", source: "public_anchor", uncertainty: "high" },
  ],
  triplet_lifetime_proxy: [
    { name: "triplet_yield", valueRange: [0.001, 0.05], unit: "fraction", source: "public_anchor", uncertainty: "high" },
    { name: "rf_contrast", valueRange: [0.002, 0.03], unit: "fraction", source: "demo_assumption", uncertainty: "high" },
    { name: "lifetime_baseline", valueRange: [2.0, 3.5], unit: "ns", source: "public_anchor", uncertainty: "medium" },
  ],
  photokinetic_ode_proxy: [
    { name: "light_history_gain", valueRange: [0.1, 0.6], unit: "ΔF/F", source: "demo_assumption", uncertainty: "medium" },
    { name: "dark_recovery_tau", valueRange: [5, 60], unit: "s", source: "public_anchor", uncertainty: "medium" },
  ],
  redox_response_proxy: [
    { name: "redox_span", valueRange: [0.2, 0.7], unit: "ΔF/F", source: "public_anchor", uncertainty: "medium" },
    { name: "midpoint_potential", valueRange: [-0.35, -0.15], unit: "V", source: "public_anchor", uncertainty: "medium" },
  ],
  material_state_proxy: [
    { name: "swelling_sensitivity", valueRange: [0.1, 0.5], unit: "ΔF/F per unit swell", source: "demo_assumption", uncertainty: "medium" },
    { name: "reference_channel_ratio", valueRange: [0.9, 1.1], unit: "x", source: "demo_assumption", uncertainty: "low" },
  ],
  confounder_annotation: [
    { name: "no_defined_transduction", valueRange: [0, 0], unit: "n/a", source: "public_anchor", uncertainty: "high" },
  ],
};

export function generateParameterSpace(
  route: MechanismRoute,
): PhysicsParameterSpace {
  const routeSpecific = ROUTE_PARAMS[route.simulatorPlugin] ?? [];
  const all =
    route.simulatorPlugin === "confounder_annotation"
      ? routeSpecific
      : [...routeSpecific, ...COMMON_NUISANCE];

  const parameters: PhysicsParameter[] = all.map((p) => ({
    ...p,
    route: route.id,
    canBeInterpretedAsValidation: false,
  }));

  return {
    routeId: route.id,
    label: "synthetic_parameter_space_not_validation",
    parameters,
  };
}

/** Midpoint of a parameter range, used as the deterministic nominal value. */
export function nominal(space: PhysicsParameterSpace, name: string): number {
  const p = space.parameters.find((x) => x.name === name);
  if (!p) return 0;
  return (p.valueRange[0] + p.valueRange[1]) / 2;
}
