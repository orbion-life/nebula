import type { ConstructHypothesis, MechanismRoute, RationaleCard } from "./types";

/**
 * Falsification criteria — explicit kill rules for measurement triage.
 * Answers: "What experiment result would make us abandon this route?"
 */
export function buildFalsificationCriteria(
  h: ConstructHypothesis,
  route: MechanismRoute,
): RationaleCard {
  const bullets: string[] = [];

  if (route.simulatorPlugin === "radical_pair_response_proxy") {
    bullets.push(
      "If ΔF/F vs static field is flat under photobleach + oxygen controls → abandon spin-linked field route (no falsifiable field coupling).",
    );
    bullets.push(
      "If RF on/off contrast matches photobleach decay kinetics only → route is confounded; downgrade to nuisance-only.",
    );
  } else {
    bullets.push(
      "If primary readout change tracks illumination history only (photobleach curve) with no stimulus arm → discard as measurement artifact.",
    );
  }

  bullets.push(
    `If ${route.controlRequirements[0] ?? "illuminated no-field control"} shows the same magnitude as stimulus arm → hypothesis ${h.id} fails triage.`,
  );

  if (route.confounders.includes("oxygen quenching")) {
    bullets.push(
      "If deoxygenated vs aerated samples show no change in spin-linked contrast but large fluorescence change → oxygen falsifies radical-pair interpretation.",
    );
  } else {
    bullets.push(
      "If cofactor-less or dark-state control matches signal amplitude → cofactor/chromophore route is falsified.",
    );
  }

  return {
    kind: "falsification_criteria",
    title: "Falsification criteria (kill rules)",
    bullets: bullets.slice(0, 3),
  };
}
