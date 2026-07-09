/**
 * Zod-validated loader for the Python-generated radical-pair artifact.
 *
 * The TypeScript app NEVER consumes the generated JSON directly: it must pass
 * this schema first. Validation runs at import time so a malformed or
 * out-of-contract artifact fails fast instead of silently feeding bad physics
 * into the pipeline. `validateRadicalPairArtifact` exposes the same check for
 * tests that feed deliberately-corrupted input.
 *
 * Source: scripts/physics/radical_pair_mary.py (RadicalPy spin dynamics).
 * The values are a SYNTHETIC ASSUMPTION SWEEP, not measured data.
 */
import { z } from "zod";
import artifactJson from "../../data/generated/radical_pair_mary.v1.json";
import type { ParameterProvenance } from "../types";

const UncertaintySchema = z.enum(["low", "medium", "high"]);

const ParameterProvenanceSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  range: z.tuple([z.number(), z.number()]),
  uncertainty: UncertaintySchema,
  sourceType: z.enum([
    "database",
    "literature",
    "assumption",
    "instrument",
    "user_constraint",
  ]),
  citationOrAssumption: z.string(),
  applicabilityLimits: z.string(),
});

const ControlSchema = z.object({
  description: z.string(),
  mfePercent: z.array(z.number()),
});

export const RadicalPairArtifactSchema = z.object({
  artifact: z.literal("radical_pair_mary"),
  schemaVersion: z.string(),
  label: z.literal("synthetic assumption sweep, not prediction"),
  generator: z.object({
    script: z.string(),
    command: z.string(),
    python: z.string(),
    radicalpy: z.string(),
    numpy: z.string(),
    scipy: z.string(),
    seed: z.number(),
    runtimeSeconds: z.number(),
  }),
  model: z.object({
    radicalPair: z.string(),
    hamiltonianTerms: z.array(z.string()),
    initialState: z.string(),
    kinetics: z.array(z.string()),
    relaxation: z.array(z.string()),
    observable: z.string(),
    opticalTransduction: z.string(),
    assumptions: z.array(z.string()),
  }),
  seriesLabels: z.record(z.string(), z.string()),
  parameters: z.array(ParameterProvenanceSchema),
  data: z.object({
    B0_mT: z.array(z.number()),
    singletYield: z.array(z.number()),
    mfePercent: z.array(z.number()),
    dFF_assumptionDerived: z.array(z.number()),
    ensemble: z.object({
      meanMfePercent: z.array(z.number()),
      stdMfePercent: z.array(z.number()),
      members: z.array(z.record(z.string(), z.number())),
      nMembers: z.number(),
    }),
    controls: z.object({
      relaxation_dominated: ControlSchema,
      no_hyperfine: ControlSchema,
    }),
    rf: z.object({
      workingField_mT: z.number(),
      b1_mT: z.number(),
      freq_MHz: z.array(z.number()),
      // Normalized to unit peak; only resonance POSITIONS are physical.
      rfResponseNormalized: z.array(z.number()),
      control_b1_zero: z.array(z.number()),
      units: z.string(),
      fidelity: z.string(),
    }),
  }),
  contentHash: z.string().length(64),
});

export type RadicalPairArtifact = z.infer<typeof RadicalPairArtifactSchema>;

export type RadicalPairValidation =
  | { ok: true; data: RadicalPairArtifact }
  | { ok: false; issues: string[] };

/** Validate arbitrary input against the artifact contract (used by tests). */
export function validateRadicalPairArtifact(input: unknown): RadicalPairValidation {
  const parsed = RadicalPairArtifactSchema.safeParse(input);
  if (parsed.success) {
    const d = parsed.data.data;
    const n = d.B0_mT.length;
    const sameLength = [
      d.singletYield,
      d.mfePercent,
      d.dFF_assumptionDerived,
      d.ensemble.meanMfePercent,
      d.ensemble.stdMfePercent,
      d.controls.relaxation_dominated.mfePercent,
      d.controls.no_hyperfine.mfePercent,
    ].every((a) => a.length === n);
    if (!sameLength) {
      return { ok: false, issues: ["field-indexed arrays have mismatched lengths"] };
    }
    if (d.rf.freq_MHz.length !== d.rf.rfResponseNormalized.length) {
      return { ok: false, issues: ["rf frequency/response arrays have mismatched lengths"] };
    }
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

function loadOrThrow(): RadicalPairArtifact {
  const result = validateRadicalPairArtifact(artifactJson);
  if (!result.ok) {
    throw new Error(
      `radical_pair_mary.v1.json failed Zod validation before consumption:\n  ${result.issues.join(
        "\n  ",
      )}`,
    );
  }
  return result.data;
}

/** The validated artifact. Import-time validation = fail fast on bad physics. */
export const RADICAL_PAIR_ARTIFACT: RadicalPairArtifact = loadOrThrow();

/** Provenance rows as the shared ParameterProvenance contract. */
export function radicalPairParameters(): ParameterProvenance[] {
  return RADICAL_PAIR_ARTIFACT.parameters as ParameterProvenance[];
}
