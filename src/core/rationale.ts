import { evidenceById } from "./fixtures/evidenceCards";
import { buildFalsificationCriteria } from "./falsification";
import type {
  ConstructHypothesis,
  MechanismRoute,
  RationaleCard,
} from "./types";

/**
 * Rationale + evidence engine.
 *
 * Produces scientist-readable cards including falsification kill rules.
 */
export function buildRationale(
  h: ConstructHypothesis,
  route: MechanismRoute,
): RationaleCard[] {
  const anchors = route.publicAnchors
    .map((id) => evidenceById(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return [
    {
      kind: "why_measure_first",
      title: "Why measure this first",
      bullets: [
        `Route claim level is ${route.maxClaimLevel.replace(/_/g, " ")} — the strongest thing we may say.`,
        h.whyItMightWork[0] ?? "Has a transparent public mechanism route.",
        "Ranked for measurement triage, not predicted performance.",
      ],
    },
    {
      kind: "mechanism_route",
      title: "Mechanism route",
      bullets: route.causalSteps
        .slice(0, 3)
        .map((s) => `${s.step} (${s.support.replace(/_/g, " ")})`),
    },
    {
      kind: "evidence_anchors",
      title: "Evidence anchors",
      bullets: anchors.slice(0, 3).map((a) => {
        if (a.provenance === "demo_assumption") {
          return `${a.title} [demo assumption]`;
        }
        const c = a.citations[0];
        const ref = c ? ` — ${c.authors.split(",")[0]} et al. ${c.year}, doi:${c.doi}` : "";
        return `${a.title} [public: ${a.citations.length} citation(s)]${ref}`;
      }),
    },
    {
      kind: "failure_modes",
      title: "Why it might fail",
      bullets: [
        ...h.whyItMightFail.slice(0, 2),
        `Confounders: ${route.confounders.join(", ")}.`,
      ],
    },
    {
      kind: "required_controls",
      title: "Required controls",
      bullets: route.controlRequirements.slice(0, 3),
    },
    buildFalsificationCriteria(h, route),
    {
      kind: "claim_boundary",
      title: "Claim boundary",
      bullets: [
        "Public construct hypothesis — not a proven, working sensor.",
        "All traces are synthetic assumption sweeps, not predictions.",
        "Requires experimental measurement by a collaborator to test.",
      ],
    },
  ];
}
