import type { SwarmLensReport, SwarmVerdict } from "../types";
import type { LensContext, SwarmLensDefinition } from "./lenses";

function verdictFrom(findings: SwarmLensReport["findings"]): SwarmVerdict {
  if (findings.some((f) => f.severity === "blocker")) return "fail";
  if (findings.some((f) => f.severity === "warning")) return "warn";
  return "pass";
}

/**
 * MAP phase — parallel specialist workers (deterministic synchronous fan-out).
 * Each lens reviews the producer artifact in isolation (producer-reviewer pattern).
 */
export function mapLenses(
  ctx: LensContext,
  lenses: SwarmLensDefinition[],
): SwarmLensReport[] {
  const reports = lenses.map((lens) => {
    const findings = lens.run(ctx).map((f) => ({
      ...f,
      theme: f.theme ?? lens.themes[0],
    }));
    return {
      lens: lens.id,
      persona: lens.persona,
      tier: lens.tier,
      trustWeight: lens.trustWeight,
      verdict: verdictFrom(findings),
      findings,
    };
  });

  reports.sort((a, b) => a.lens.localeCompare(b.lens));
  return reports;
}
