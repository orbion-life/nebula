import { vectorAnalogSearch } from "./analogIndex";
import { PUBLIC_BENCHMARKS } from "./benchmark";
import { evidenceById } from "./fixtures/evidenceCards";
import type {
  BenchmarkRef,
  ConstructHypothesis,
  EvidenceBundle,
  EvidenceCard,
  ObjectiveInput,
  PublicAnalog,
  ScaffoldFamily,
} from "./types";

/**
 * Evidence bundle assembly.
 *
 * Gathers the PUBLIC grounding for an objective: literature evidence cards for
 * the surfaced scaffolds, public benchmark references for the relevant mechanism
 * classes, and public scaffold analogs (retrieval only, never a spin-response
 * prediction). This is grounding for measurement design, not validation.
 */

const BENCHMARKS_BY_FAMILY: Record<ScaffoldFamily, string[]> = {
  LOV_flavin: ["bm_flavoprotein_odmr", "bm_engineered_spin_resonance", "bm_rfp_giant_mfe"],
  cryptochrome_FAD: ["bm_flavoprotein_odmr", "bm_engineered_spin_resonance"],
  redox_flavoprotein: ["bm_flavoprotein_odmr"],
  fluorescent_protein: ["bm_fp_spin_qubit"],
  RFP_plus_flavin: ["bm_rfp_giant_mfe", "bm_fp_spin_qubit"],
  metal_cofactor: [],
  material_composite: [],
  unsupported: [],
};

export function buildEvidenceBundle(
  objective: ObjectiveInput,
  hypotheses: ConstructHypothesis[],
): EvidenceBundle {
  const cardIds = new Set<string>();
  for (const h of hypotheses) for (const id of h.evidenceCardIds) cardIds.add(id);
  const cards: EvidenceCard[] = [...cardIds]
    .map((id) => evidenceById(id))
    .filter((c): c is EvidenceCard => Boolean(c));

  const benchmarkIds = new Set<string>();
  for (const h of hypotheses) {
    for (const b of BENCHMARKS_BY_FAMILY[h.scaffoldFamily] ?? []) benchmarkIds.add(b);
  }
  const benchmarks: BenchmarkRef[] = PUBLIC_BENCHMARKS.filter((b) => benchmarkIds.has(b.id));

  const analogs: PublicAnalog[] = vectorAnalogSearch(objective.objectiveText, 4).map((h) => ({
    id: h.id,
    name: h.name,
    family: h.family,
    publicRef: h.publicRef,
    score: h.score,
  }));

  return {
    objectiveText: objective.objectiveText,
    cards,
    benchmarks,
    analogs,
    assembledFrom: ["public_anchor", "demo_assumption", "user_constraint"],
    note: "Public grounding only. Evidence supports the plausibility of a mechanism class; it never establishes that any construct works as a sensing device.",
  };
}
