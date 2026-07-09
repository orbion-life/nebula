import type {
  ExpressionHost,
  MaterialContext,
  ObjectiveInput,
  RawObjective,
  ReadoutMode,
} from "./types";

/**
 * Objective compiler.
 *
 * Deterministic keyword-driven parse of a messy natural-language objective into
 * structured constraints. This is intentionally transparent (no hidden model):
 * a scientist can read the rules and see exactly why a readout was extracted.
 *
 * Claude's role in the product is to help phrase/expand messy objectives; the
 * compiled contract here is deterministic code so the pipeline is reproducible.
 */

const READOUT_KEYWORDS: Array<[ReadoutMode, RegExp]> = [
  ["fluorescence", /\b(fluoresc|optical|gfp|rfp|brightness|intensity)\b/i],
  ["lifetime", /\b(lifetime|flim|decay time|nanosecond)\b/i],
  ["RF_magnetic", /\b(magnetic|magneto|rf[- ]?linked|radio[- ]?frequency|b[- ]?field|spin)\b/i],
  ["ODMR_like", /\b(odmr|optically detected|triplet|spin resonance)\b/i],
  ["redox_electrochemical", /\b(redox|electrochemical|electrode|potentiostat)\b/i],
  ["material_state", /\b(hydrogel|film|swelling|crosslink|material[- ]?state|stiffness)\b/i],
];

const MATERIAL_KEYWORDS: Array<[MaterialContext, RegExp]> = [
  ["hydrogel", /\bhydrogel\b/i],
  ["film", /\bfilm\b/i],
  ["chip", /\bchip|microfluidic|device\b/i],
  ["wearable", /\bwearable|patch|skin\b/i],
  ["cell", /\bin[- ]?cell|intracellular|live cell\b/i],
  ["solution", /\bsolution|in vitro|cuvette\b/i],
];

const HOST_KEYWORDS: Array<[ExpressionHost, RegExp]> = [
  ["bacteria", /\bbacteri|e\.? ?coli|prokaryot\b/i],
  ["mammalian", /\bmammalian|hek|cho\b/i],
  ["yeast", /\byeast|pichia|saccharomyces\b/i],
  ["cell_free", /\bcell[- ]?free|in vitro translation\b/i],
];

const EXCITATION_KEYWORDS: Array<[string, RegExp]> = [
  ["blue-light", /\bblue[- ]?light|blue excitation|450 ?nm|470 ?nm\b/i],
  ["green-light", /\bgreen[- ]?light|530 ?nm|560 ?nm\b/i],
  ["red-light", /\bred[- ]?light|630 ?nm|far[- ]?red\b/i],
  ["UV", /\buv|ultraviolet|365 ?nm\b/i],
];

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function compileObjective(raw: RawObjective): ObjectiveInput {
  const text = raw.objectiveText;

  let desiredReadouts = READOUT_KEYWORDS.filter(([, re]) => re.test(text)).map(
    ([mode]) => mode,
  );
  // "quantum" is translated into concrete candidate readouts rather than left vague.
  if (/\bquantum\b/i.test(text) && desiredReadouts.length === 0) {
    desiredReadouts = ["fluorescence", "RF_magnetic", "ODMR_like"];
  }
  if (desiredReadouts.length === 0) desiredReadouts = ["fluorescence"];

  const materialMatch = MATERIAL_KEYWORDS.find(([, re]) => re.test(text));
  const materialContext: MaterialContext = materialMatch
    ? materialMatch[0]
    : "unknown";

  const hostMatch = HOST_KEYWORDS.find(([, re]) => re.test(text));
  const expressionHost: ExpressionHost = hostMatch ? hostMatch[0] : "unknown";

  const excitationAllowed = uniq(
    EXCITATION_KEYWORDS.filter(([, re]) => re.test(text)).map(([name]) => name),
  );

  const constraints: string[] = [];
  if (/\bopen[- ]?source|public|synthetic\b/i.test(text))
    constraints.push("public/synthetic evidence only");
  if (/\bno confidential|no proprietary|no private sequence\b/i.test(text))
    constraints.push("no confidential sequences");
  if (/\bmeasurement first|deserves measurement|what to measure\b/i.test(text))
    constraints.push("output measurement-worthiness ordering");
  if (/\bcontrols?\b/i.test(text)) constraints.push("controls required");

  const missingInformation: string[] = [];
  if (materialContext === "unknown")
    missingInformation.push("material context not specified");
  if (expressionHost === "unknown")
    missingInformation.push("expression host not specified");
  if (excitationAllowed.length === 0)
    missingInformation.push("excitation wavelength not specified");
  if (!desiredReadouts.includes("RF_magnetic") && /\bquantum\b/i.test(text))
    missingInformation.push(
      "quantum requested but no concrete RF/magnetic readout stated",
    );

  const forbiddenAssumptions = [
    "do not assume any listed protein already works as a sensor",
    "do not assume sequence alone predicts spin response",
    "do not assume simulated traces are measured data",
  ];

  return {
    objectiveText: text,
    desiredReadouts: uniq(desiredReadouts),
    materialContext,
    expressionHost,
    excitationAllowed,
    constraints,
    confidentialSequenceProvided: false,
    missingInformation,
    forbiddenAssumptions,
  };
}
