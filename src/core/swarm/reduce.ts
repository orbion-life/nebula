import {
  ESCALATION_MIN_COMMITTEE_LENSES,
  TRUSTED_FIRST_LENS_ORDER,
} from "./architecture";
import type { SwarmLensDefinition } from "./lenses";
import type {
  SwarmArbiterDecision,
  SwarmEscalation,
  SwarmLensReport,
  SwarmVerdict,
} from "../types";

export interface ReduceResult {
  lenses: SwarmLensReport[];
  counts: { blocker: number; warning: number; info: number };
  escalations: SwarmEscalation[];
  verdict: SwarmVerdict;
  arbiter: SwarmArbiterDecision;
}

/**
 * REDUCE phase — severity-weighted consensus (not majority voting).
 * Cross-lens theme escalation when multiple committee lenses agree.
 */
export function reduceLensReports(
  reports: SwarmLensReport[],
  lensDefs: SwarmLensDefinition[],
): ReduceResult {
  const defById = new Map(lensDefs.map((l) => [l.id, l]));
  const escalations: SwarmEscalation[] = [];
  const mutated = reports.map((r) => ({
    ...r,
    findings: r.findings.map((f) => ({ ...f })),
  }));

  const themeCommitteeLenses = new Map<string, Set<string>>();
  for (const report of mutated) {
    const def = defById.get(report.lens);
    if (!def || def.tier !== "committee") continue;
    for (const finding of report.findings) {
      if (finding.severity !== "warning") continue;
      const theme = finding.theme ?? def.themes[0] ?? report.lens;
      if (!themeCommitteeLenses.has(theme)) themeCommitteeLenses.set(theme, new Set());
      themeCommitteeLenses.get(theme)!.add(report.lens);
    }
  }

  for (const [theme, lenses] of themeCommitteeLenses) {
    if (lenses.size < ESCALATION_MIN_COMMITTEE_LENSES) continue;
    const hasBlocker = mutated.some((r) =>
      r.findings.some(
        (f) => (f.theme ?? theme) === theme && f.severity === "blocker",
      ),
    );
    if (hasBlocker) continue;

    let escalated = false;
    for (const report of mutated) {
      for (const finding of report.findings) {
        const fTheme = finding.theme ?? defById.get(report.lens)?.themes[0];
        if (fTheme === theme && finding.severity === "warning" && !escalated) {
          finding.severity = "blocker";
          finding.message = `[escalated: ${lenses.size} committee lenses] ${finding.message}`;
          escalations.push({
            theme,
            lenses: [...lenses].sort(),
            fromSeverity: "warning",
            toSeverity: "blocker",
            message: `${lenses.size} committee lenses flagged theme "${theme}".`,
          });
          escalated = true;
          report.verdict = "fail";
        }
      }
    }
  }

  const counts = { blocker: 0, warning: 0, info: 0 };
  for (const report of mutated) {
    for (const f of report.findings) counts[f.severity]++;
    report.verdict = lensVerdict(report.findings);
  }

  const verdict: SwarmVerdict =
    counts.blocker > 0 ? "fail" : counts.warning > 0 ? "warn" : "pass";

  const arbiter = synthesizeArbiter(mutated, verdict, escalations);

  return {
    lenses: mutated,
    counts,
    escalations,
    verdict,
    arbiter,
  };
}

function lensVerdict(findings: SwarmLensReport["findings"]): SwarmVerdict {
  if (findings.some((f) => f.severity === "blocker")) return "fail";
  if (findings.some((f) => f.severity === "warning")) return "warn";
  return "pass";
}

function synthesizeArbiter(
  reports: SwarmLensReport[],
  verdict: SwarmVerdict,
  escalations: SwarmEscalation[],
): SwarmArbiterDecision {
  const trustedRank = new Map<string, number>(
    TRUSTED_FIRST_LENS_ORDER.map((id, i) => [id, i]),
  );

  const patchCandidates: Array<{ lens: string; message: string; weight: number }> =
    [];
  const warnings: string[] = [];

  for (const report of reports) {
    for (const f of report.findings) {
      if (f.severity === "blocker") {
        patchCandidates.push({
          lens: report.lens,
          message: f.message,
          weight:
            (trustedRank.get(report.lens) ?? 99) * -1 + report.trustWeight * -0.01,
        });
      } else if (f.severity === "warning") {
        warnings.push(`${report.persona}: ${f.message}`);
      }
    }
  }

  patchCandidates.sort((a, b) => a.weight - b.weight || a.lens.localeCompare(b.lens));

  const rationale =
    verdict === "pass"
      ? "Severity-weighted consensus: no blockers; producer artifact cleared for demo handoff."
      : verdict === "warn"
        ? `Severity-weighted consensus: ${warnings.length} warning(s); no blockers after ${escalations.length} escalation(s).`
        : `Severity-weighted consensus: ${patchCandidates.length} blocker(s) require patches before demo/submit.`;

  return {
    verdict,
    rationale,
    requiredPatches: patchCandidates.map((p) => `[${p.lens}] ${p.message}`),
    acceptedWarnings: verdict === "warn" ? warnings : [],
  };
}
