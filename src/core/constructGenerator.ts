import { EVIDENCE_CARDS } from "./fixtures/evidenceCards";
import { routeForScaffold } from "./mechanismRouter";
import type {
  ArchitectureKind,
  ConstructHypothesis,
  ObjectiveInput,
  ReadoutMode,
  ScaffoldFamily,
} from "./types";

/**
 * Construct hypothesis generator.
 *
 * Produces 3-5 PUBLIC construct hypotheses from public scaffold families. It
 * never emits a mutation list, an orderable sequence, or a private candidate.
 * Every hypothesis is `public_hypothesis_not_validated` with
 * `privateCandidate: false`.
 */

interface ScaffoldTemplate {
  scaffold: ScaffoldFamily;
  title: string;
  architecture: ArchitectureKind;
  cofactors: string[];
  readouts: ReadoutMode[];
  whyWork: string[];
  whyFail: string[];
  materialFitByContext: (ctx: string) => string[];
  triggers: (obj: ObjectiveInput) => boolean;
}

const TEMPLATES: ScaffoldTemplate[] = [
  {
    scaffold: "LOV_flavin",
    title: "LOV/flavin blue-light construct with field-modulated optical readout",
    architecture: "single_scaffold",
    cofactors: ["FMN"],
    readouts: ["fluorescence", "RF_magnetic", "lifetime"],
    whyWork: [
      "Flavin is photoactive under blue light with a well-characterized public photocycle",
      "Radical-pair mechanism gives a public, transparent route to a field-linked signal",
      "Light history is controllable, which helps measurement design",
    ],
    whyFail: [
      "Any field effect may be below noise for a given scaffold",
      "Photobleaching and oxygen can swamp a small signal",
    ],
    materialFitByContext: (ctx) => [
      `Compatible with ${ctx} if flavin stays bound and photoactive`,
      "Needs a reference channel to separate material effects",
    ],
    triggers: (obj) =>
      obj.desiredReadouts.includes("fluorescence") ||
      obj.desiredReadouts.includes("RF_magnetic") ||
      obj.excitationAllowed.includes("blue-light"),
  },
  {
    scaffold: "cryptochrome_FAD",
    title: "Cryptochrome/FAD radical-pair construct (cautious magnetic route)",
    architecture: "single_scaffold",
    cofactors: ["FAD"],
    readouts: ["fluorescence", "RF_magnetic"],
    whyWork: [
      "FAD radical-pair chemistry is a public candidate mechanism for magnetosensitivity",
      "Blue-light excitation is compatible with the stated objective",
    ],
    whyFail: [
      "Effect size is uncertain without a specific public fixture",
      "Readout coupling to spin state is not established for arbitrary constructs",
    ],
    materialFitByContext: (ctx) => [
      `Embedding in ${ctx} may perturb the tryptophan-chain geometry`,
    ],
    triggers: (obj) => obj.desiredReadouts.includes("RF_magnetic"),
  },
  {
    scaffold: "fluorescent_protein",
    title: "Triplet-state fluorescent-protein construct (ODMR-like, diagnostic)",
    architecture: "fusion_reporter",
    cofactors: ["intrinsic chromophore"],
    readouts: ["fluorescence", "ODMR_like", "lifetime"],
    whyWork: [
      "Fluorescent proteins reliably populate triplet/dark states (public photophysics)",
      "Optical readout is mature and easy to acquire",
    ],
    whyFail: [
      "Clean spin-addressable ODMR contrast in a protein is not established",
      "Triplet yield may be low and oxygen-quenched",
    ],
    materialFitByContext: (ctx) => [
      `Bright, stable expression makes ${ctx} embedding straightforward`,
    ],
    triggers: (obj) =>
      obj.desiredReadouts.includes("ODMR_like") ||
      obj.desiredReadouts.includes("fluorescence"),
  },
  {
    scaffold: "RFP_plus_flavin",
    title: "RFP + flavin light-history reporter",
    architecture: "co_encapsulated_pair",
    cofactors: ["FMN", "intrinsic chromophore"],
    readouts: ["fluorescence", "lifetime"],
    whyWork: [
      "Flavin photochemistry can encode integrated light history",
      "Red readout separates spectrally from blue excitation",
    ],
    whyFail: [
      "Coupling depends on geometry that is not fixed in a public hypothesis",
      "Light-history ambiguity complicates interpretation",
    ],
    materialFitByContext: (ctx) => [
      `Two-component system needs co-localization control in ${ctx}`,
    ],
    triggers: (obj) => obj.excitationAllowed.includes("blue-light"),
  },
  {
    scaffold: "redox_flavoprotein",
    title: "Redox flavoprotein construct (electrochemical + optical)",
    architecture: "electrode_coupled",
    cofactors: ["FAD"],
    readouts: ["redox_electrochemical", "fluorescence"],
    whyWork: [
      "Flavin redox state modulates fluorescence and electrochemical signal (public)",
      "Ties the readout to a controllable chemical variable",
    ],
    whyFail: ["pH and oxygen cross-talk", "electrode fouling over time"],
    materialFitByContext: (ctx) => [
      `Needs electrode coupling; ${ctx} must permit charge transfer`,
    ],
    triggers: (obj) => obj.desiredReadouts.includes("redox_electrochemical"),
  },
  {
    scaffold: "material_composite",
    title: "Material-state composite reporter (hydrogel/film)",
    architecture: "material_composite",
    cofactors: [],
    readouts: ["material_state", "fluorescence", "lifetime"],
    whyWork: [
      "Material swelling/crosslink state changes embedded fluorophore environment (public)",
      "Directly targets the material objective",
    ],
    whyFail: [
      "Confounded by photobleaching, temperature, and scattering",
      "Requires a reference fluorophore to be interpretable",
    ],
    materialFitByContext: (ctx) => [`Purpose-built for ${ctx} state sensing`],
    // Trigger on an explicit material-state readout OR whenever the objective
    // targets a solid material context (a hydrogel/film/chip/wearable objective
    // should always surface a material-state option).
    triggers: (obj) =>
      obj.desiredReadouts.includes("material_state") ||
      ["hydrogel", "film", "chip", "wearable"].includes(obj.materialContext),
  },
  {
    scaffold: "metal_cofactor",
    title: "Metal/cofactor annotation (confounder-only, not a mechanism)",
    architecture: "single_scaffold",
    cofactors: ["metal ion"],
    readouts: ["fluorescence"],
    whyWork: [
      "A bound metal/paramagnetic cofactor is a legitimate annotation to record",
    ],
    whyFail: [
      "Presence is not a mechanism; no optical spin-transduction path is defined",
      "Stays diagnostic-only until an explicit transduction path is supplied",
    ],
    materialFitByContext: () => ["Included only to flag a confounder, not to propose a sensor"],
    triggers: () => true, // always available as a confounder annotation
  },
];

function evidenceForScaffold(scaffold: ScaffoldFamily): string[] {
  return EVIDENCE_CARDS.filter((c) => c.scaffoldFamilies.includes(scaffold)).map(
    (c) => c.id,
  );
}

export function generateHypotheses(
  objective: ObjectiveInput,
  maxHypotheses = 5,
): ConstructHypothesis[] {
  const triggered = TEMPLATES.filter((t) => t.triggers(objective));

  // Always keep the metal confounder available, but never let it crowd out
  // real routes: it goes last.
  const ordered = [
    ...triggered.filter((t) => t.scaffold !== "metal_cofactor"),
    ...triggered.filter((t) => t.scaffold === "metal_cofactor"),
  ];

  const chosen = ordered.slice(0, Math.max(3, Math.min(maxHypotheses, ordered.length)));
  const ctx =
    objective.materialContext === "unknown"
      ? "the target material"
      : objective.materialContext;

  return chosen.map((t, i): ConstructHypothesis => {
    const route = routeForScaffold(t.scaffold);
    const readoutModes = t.readouts.filter(
      (r) =>
        objective.desiredReadouts.includes(r) ||
        route.supportedReadouts.includes(r),
    );
    return {
      id: `ch_${String(i + 1).padStart(2, "0")}_${t.scaffold}`,
      title: t.title,
      status: "public_hypothesis_not_validated",
      scaffoldFamily: t.scaffold,
      architectureKind: t.architecture,
      cofactorOrChromophore: t.cofactors,
      readoutModes: readoutModes.length ? readoutModes : t.readouts,
      materialFit: t.materialFitByContext(ctx),
      expressionContext: [
        objective.expressionHost === "unknown"
          ? "expression host unspecified; assume bacterial-first for demo"
          : `expression host: ${objective.expressionHost}`,
      ],
      mechanismRouteId: route.id,
      whyItMightWork: t.whyWork,
      whyItMightFail: t.whyFail,
      requiredControls: route.controlRequirements,
      evidenceCardIds: evidenceForScaffold(t.scaffold),
      privateCandidate: false,
      allowedNextStep:
        route.maxClaimLevel === "diagnostic_only"
          ? "measurement_planning"
          : "internal_developability_triage",
    };
  });
}
