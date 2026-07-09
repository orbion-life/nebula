import { RADICAL_PAIR_ARTIFACT, radicalPairParameters } from "./generated/radicalPair";
import { generateParameterSpace } from "./physics";
import type {
  MechanismRoute,
  ParameterEnsemble,
  ParameterProvenance,
  PhysicsParameter,
} from "./types";

/**
 * Parameter ensembles.
 *
 * Radical-pair routes reuse the Python-generated seeded ensemble (12 members)
 * and its provenance table. Other routes expose their transparent parameter
 * space as a single-member ensemble with mapped provenance. Nothing here is a
 * fitted or validated value.
 */
function spaceParamToProvenance(p: PhysicsParameter): ParameterProvenance {
  return {
    name: p.name,
    value: (p.valueRange[0] + p.valueRange[1]) / 2,
    unit: p.unit,
    range: p.valueRange,
    uncertainty: p.uncertainty,
    sourceType:
      p.source === "public_anchor"
        ? "literature"
        : p.source === "user_constraint"
          ? "user_constraint"
          : "assumption",
    citationOrAssumption:
      p.source === "public_anchor"
        ? "public-anchor-shaped range (see evidence cards)"
        : "transparent demo assumption",
    applicabilityLimits: "synthetic sweep range; not a fitted or validated value",
  };
}

export function buildParameterEnsemble(
  route: MechanismRoute,
  seed: number,
): ParameterEnsemble {
  if (route.simulatorPlugin === "radical_pair_response_proxy") {
    return {
      routeId: route.id,
      seed: RADICAL_PAIR_ARTIFACT.generator.seed,
      nMembers: RADICAL_PAIR_ARTIFACT.data.ensemble.nMembers,
      members: RADICAL_PAIR_ARTIFACT.data.ensemble.members,
      parameters: radicalPairParameters(),
      label: "synthetic_parameter_ensemble_not_validation",
    };
  }
  const space = generateParameterSpace(route);
  return {
    routeId: route.id,
    seed,
    nMembers: 1,
    members: [
      Object.fromEntries(
        space.parameters.map((p) => [p.name, (p.valueRange[0] + p.valueRange[1]) / 2]),
      ),
    ],
    parameters: space.parameters.map(spaceParamToProvenance),
    label: "synthetic_parameter_ensemble_not_validation",
  };
}
