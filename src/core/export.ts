import { buildMeasurementPlan } from "./measurementPlan";
import { routeById } from "./fixtures/routes";
import type {
  DiscoverResult,
  MechanismRoute,
  PhysicsParameterSpace,
  RationaleCard,
  SimulationOutput,
} from "./types";

export interface HandoffExportOptions {
  /** Hypothesis to export (defaults to pipeline selection). */
  hypothesisId?: string;
  /** Active-route context when UI selection differs from pipeline default. */
  rationale?: RationaleCard[];
  simulation?: SimulationOutput;
  parameterSpace?: PhysicsParameterSpace;
  route?: MechanismRoute;
}

/**
 * Measurement handoff export.
 *
 * Turns a DiscoverResult into a claim-safe Markdown or JSON handoff for a
 * measurement collaborator. Supports UI-selected hypothesis context.
 */
export function exportMarkdown(
  result: DiscoverResult,
  options: HandoffExportOptions = {},
): string {
  const hypothesisId = options.hypothesisId ?? result.selectedHypothesisId;
  const hyp = result.hypotheses.find((h) => h.id === hypothesisId)!;
  const route = options.route ?? result.selectedRoute;
  const simulation = options.simulation ?? result.simulation;
  const parameterSpace = options.parameterSpace ?? result.parameterSpace;
  const rationale = options.rationale ?? result.rationale;
  const rank = result.ranking.find((r) => r.hypothesisId === hypothesisId)!;

  const lines: string[] = [];
  lines.push(`# Nebula Discover, Measurement Handoff`);
  lines.push("");
  lines.push(`> Status: **${result.status.replace(/_/g, " ")}**`);
  lines.push(`> All traces are **${simulation.label}**.`);
  lines.push(
    `> Exported for: **${hyp.title}** (measurement rank #${rank.rank}, score ${rank.score.toFixed(3)})`,
  );
  lines.push(
    `> Public construct hypothesis, not a working sensor, not an Orbion commercial candidate.`,
  );
  lines.push("");
  lines.push(`## Objective`);
  lines.push("");
  lines.push(`\`\`\`\n${result.objective.objectiveText.trim()}\n\`\`\``);
  lines.push("");
  lines.push(`- Desired readouts: ${result.objective.desiredReadouts.join(", ")}`);
  lines.push(`- Material context: ${result.objective.materialContext}`);
  lines.push(`- Expression host: ${result.objective.expressionHost}`);
  lines.push(`- Instrument: ${result.instrument.label} (noise floor ΔF/F ≥ ${result.instrument.minDetectableDeltaFOverF}, field ${result.instrument.staticFieldRange_mT[0]} to ${result.instrument.staticFieldRange_mT[1]} mT, RF ${result.instrument.rfAvailable ? "available" : "none"})`);
  lines.push("");
  lines.push(`## Measure this next (decisive experiment)`);
  lines.push("");
  // Keep the handoff consistent with the SELECTED hypothesis: rebuild the plan
  // for a UI-selected non-top hypothesis so the downloaded brief always matches.
  const mp =
    hypothesisId === result.selectedHypothesisId
      ? result.measurementPlan
      : (() => {
          const ev = result.simulationEvidence.find((e) => e.hypothesisId === hypothesisId);
          const rt = routeById(hyp.mechanismRouteId);
          return ev && rt
            ? buildMeasurementPlan(hyp, rt, ev, result.instrument, rank.rank)
            : result.measurementPlan;
        })();
  lines.push(`- **What to measure:** ${mp.whatToMeasure}`);
  lines.push(`- **Expected signature:** ${mp.expectedSignature}`);
  lines.push(`- **Expected uncertainty:** ${mp.expectedUncertainty}`);
  lines.push(`- **Null expectation:** ${mp.nullExpectation}`);
  lines.push(`- **Positive controls:** ${mp.positiveControls.join("; ") || "none"}`);
  lines.push(`- **Negative controls:** ${mp.negativeControls.join("; ")}`);
  lines.push(`- **Competing explanations:** ${mp.competingExplanations.join("; ")}`);
  lines.push(`- **Kill criterion:** ${mp.killCriterion}`);
  lines.push(`- **Information gained:** ${mp.informationGained}`);
  lines.push("");
  lines.push(`## Selected construct hypothesis`);
  lines.push("");
  lines.push(`**${hyp.title}**`);
  lines.push("");
  lines.push(`- Scaffold family: ${hyp.scaffoldFamily}`);
  lines.push(`- Cofactor/chromophore: ${hyp.cofactorOrChromophore.join(", ") || "none"}`);
  lines.push(`- Readout modes: ${hyp.readoutModes.join(", ")}`);
  lines.push(`- Mechanism route: ${route.name} (max claim: ${route.maxClaimLevel})`);
  lines.push(`- Allowed next step: ${hyp.allowedNextStep.replace(/_/g, " ")}`);
  lines.push("");
  lines.push(`## Mechanism route (causal chain)`);
  lines.push("");
  for (const s of route.causalSteps) {
    lines.push(`- ${s.step} (${s.support.replace(/_/g, " ")})`);
  }
  lines.push("");
  lines.push(`## Ranking (experiment value, not predicted performance)`);
  lines.push("");
  lines.push(`| Rank | Hypothesis | Score | Note |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const r of result.ranking) {
    const h = result.hypotheses.find((x) => x.id === r.hypothesisId)!;
    lines.push(`| ${r.rank} | ${h.scaffoldFamily} | ${r.score.toFixed(3)} | ${r.rationaleOneLine} |`);
  }
  lines.push("");
  lines.push(`## Retrospective public-benchmark comparison`);
  lines.push("");
  for (const b of result.benchmarkComparisons) {
    if (b.agreementKind === "no_comparison") {
      lines.push(`- ${b.measuredQualitative}`);
      continue;
    }
    lines.push(
      `- **${b.agreementKind.replace(/_/g, " ")}** vs ${b.citation.authors.split(",")[0]} et al. (${b.citation.year}), doi:${b.citation.doi}`,
    );
    lines.push(`  - Public (qualitative): ${b.measuredQualitative}`);
    lines.push(`  - Simulated: ${b.simulatedFeature}`);
    lines.push(`  - Residual: ${b.residualUncertainty}`);
    lines.push(`  - ${b.disclaimer}`);
  }
  lines.push("");
  lines.push(`## Rationale cards`);
  lines.push("");
  for (const card of rationale) {
    lines.push(`### ${card.title}`);
    for (const b of card.bullets) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push(`## Assumption parameter space (transparent, non-validation)`);
  lines.push("");
  lines.push(`| Parameter | Range | Unit | Source |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const p of parameterSpace.parameters) {
    lines.push(
      `| ${p.name} | ${p.valueRange[0]} to ${p.valueRange[1]} | ${p.unit} | ${p.source.replace(/_/g, " ")} |`,
    );
  }
  lines.push("");
  lines.push(`## Required controls`);
  lines.push("");
  for (const c of route.controlRequirements) lines.push(`- ${c}`);
  lines.push("");
  lines.push(`## Confounders`);
  lines.push("");
  for (const c of route.confounders) lines.push(`- ${c}`);
  lines.push("");
  lines.push(`## Synthetic traces (assumption sweeps, not predictions)`);
  lines.push("");
  for (const t of simulation.traces) {
    const tag = t.isControl ? " [control]" : t.isNuisance ? " [nuisance]" : "";
    lines.push(`- **${t.title}**${tag}, ${t.condition}. Control: ${t.requiredControl}`);
  }
  lines.push("");
  lines.push(`## Claim boundary`);
  lines.push("");
  lines.push(
    `- Demo unsafe claim blocked (patterns: ${result.blockedClaimExample.matchedPatterns.join("; ")}).`,
  );
  lines.push(`  - Rewrite: "${result.blockedClaimExample.rewrite}"`);
  lines.push(`- Allowed claim: "${result.allowedClaimExample}"`);
  lines.push("");
  lines.push(`## Mandatory swarm review`);
  lines.push("");
  lines.push(`- Architecture: **${result.swarmReview.architecture}** v${result.swarmReview.version}`);
  lines.push(`- Verdict: **${result.swarmReview.verdict}**`);
  lines.push(`- Summary: ${result.swarmReview.summary}`);
  lines.push(`- Arbiter: ${result.swarmReview.arbiter.rationale}`);
  lines.push(
    `- Lenses: ${result.swarmReview.lenses.length} (${result.swarmReview.counts.blocker} blocker(s), ${result.swarmReview.counts.warning} warning(s))`,
  );
  if (result.swarmReview.escalations.length > 0) {
    lines.push(`- Escalations: ${result.swarmReview.escalations.map((e) => e.theme).join(", ")}`);
  }
  lines.push(
    `- Verification: ${result.swarmReview.verification.inputFingerprint} → ${result.swarmReview.verification.outputFingerprint}`,
  );
  for (const lens of result.swarmReview.lenses.filter((l) => l.findings.length > 0)) {
    lines.push(`- **${lens.persona}**: ${lens.findings.map((f) => f.message).join("; ")}`);
  }
  lines.push("");
  lines.push(`## Design adapter (public demo only)`);
  lines.push("");
  lines.push(`- Adapter: ${result.designAdapter.adapter} (${result.designAdapter.status})`);
  lines.push(`- Artifact: ${result.designAdapter.generatedArtifactType}, ${result.designAdapter.artifactPreview}`);
  for (const w of result.designAdapter.warnings) lines.push(`  - warning: ${w}`);
  lines.push("");
  lines.push(`---`);
  lines.push(
    `Generated by Nebula Discover (public open-source module). Requires experimental validation by a measurement collaborator.`,
  );
  return lines.join("\n");
}

export function exportJson(
  result: DiscoverResult,
  options: HandoffExportOptions = {},
): string {
  const hypothesisId = options.hypothesisId ?? result.selectedHypothesisId;
  const sanitized: DiscoverResult = {
    ...result,
    selectedHypothesisId: hypothesisId,
    blockedClaimExample: {
      ...result.blockedClaimExample,
      input: "[redacted unsafe demo claim, see matchedPatterns]",
    },
  };
  if (options.rationale) sanitized.rationale = options.rationale;
  if (options.simulation) sanitized.simulation = options.simulation;
  if (options.parameterSpace) sanitized.parameterSpace = options.parameterSpace;
  if (options.route) sanitized.selectedRoute = options.route;
  return JSON.stringify(sanitized, null, 2);
}
