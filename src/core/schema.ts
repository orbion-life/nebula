import { z } from "zod";

/**
 * Runtime validation for the pipeline boundary (zod).
 *
 * The compiled ObjectiveInput is produced deterministically by the objective
 * compiler; this schema validates the RAW user input before it enters the
 * pipeline so malformed input degrades gracefully instead of throwing.
 */
export const RawObjectiveSchema = z.object({
  objectiveText: z.string().min(1).max(5000),
});

export type RawObjectiveParsed = z.infer<typeof RawObjectiveSchema>;

/** Returns a safe, trimmed objective or a documented fallback. */
export function safeParseObjective(input: unknown): {
  ok: boolean;
  objectiveText: string;
  issues: string[];
} {
  const result = RawObjectiveSchema.safeParse(input);
  if (result.success) {
    return { ok: true, objectiveText: result.data.objectiveText, issues: [] };
  }
  return {
    ok: false,
    objectiveText: "",
    issues: result.error.issues.map((i) => i.message),
  };
}
