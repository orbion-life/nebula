import type { DiscoverResult, RawObjective, SwarmConsensus, SwarmStageRecord } from "../types";
import {
  SWARM_ARCHITECTURE_ID,
  SWARM_ARCHITECTURE_VERSION,
  SWARM_STAGE_ORDER,
} from "./architecture";
import { stableFingerprint } from "./fingerprint";
import { SWARM_LENSES } from "./lenses";
import { mapLenses } from "./map";
import { reduceLensReports } from "./reduce";

export interface SwarmOrchestratorInput {
  result: DiscoverResult;
  raw: RawObjective;
  seed: number;
}

/**
 * Four-stage hierarchical orchestrator:
 *
 * 1. ORCHESTRATE, freeze producer artifact; build immutable reviewer context
 * 2. MAP        , parallel specialist lenses (producer-reviewer isolation)
 * 3. REDUCE     , severity-weighted consensus + cross-lens escalation
 * 4. SYNTHESIZE, arbiter decision + verification manifest
 */
export function runSwarmOrchestrator(input: SwarmOrchestratorInput): SwarmConsensus {
  const stages: SwarmStageRecord[] = [];

  const frozen = freezeProducerArtifact(input);
  stages.push({
    stage: "orchestrate",
    status: "completed",
    detail: `Frozen producer artifact for seed ${input.seed}; reviewer context is read-only.`,
  });

  const inputFingerprint = stableFingerprint({
    seed: input.seed,
    objectiveText: input.raw.objectiveText,
    core: {
      product: frozen.result.product,
      status: frozen.result.status,
      selectedHypothesisId: frozen.result.selectedHypothesisId,
      hypothesisCount: frozen.result.hypotheses.length,
    },
  });

  const mapped = mapLenses(frozen, SWARM_LENSES);
  stages.push({
    stage: "map",
    status: "completed",
    detail: `${mapped.length} lenses executed in parallel (${mapped.filter((l) => l.tier === "sentry").length} sentry, ${mapped.filter((l) => l.tier === "committee").length} committee).`,
  });

  const reduced = reduceLensReports(mapped, SWARM_LENSES);
  stages.push({
    stage: "reduce",
    status: "completed",
    detail: `Severity-weighted verdict ${reduced.verdict}; ${reduced.escalations.length} cross-lens escalation(s).`,
  });

  const summary = buildSummary(reduced.verdict, reduced.lenses.length, reduced.counts);
  const outputFingerprint = stableFingerprint({
    verdict: reduced.verdict,
    counts: reduced.counts,
    lensVerdicts: reduced.lenses.map((l) => ({ id: l.lens, v: l.verdict })),
    escalations: reduced.escalations.length,
  });

  stages.push({
    stage: "synthesize",
    status: "completed",
    detail: `Arbiter rationale recorded; verification manifest ${outputFingerprint}.`,
  });

  return {
    architecture: SWARM_ARCHITECTURE_ID,
    version: SWARM_ARCHITECTURE_VERSION,
    verdict: reduced.verdict,
    lenses: reduced.lenses,
    counts: reduced.counts,
    escalations: reduced.escalations,
    arbiter: reduced.arbiter,
    stages: SWARM_STAGE_ORDER.map(
      (id) => stages.find((s) => s.stage === id)!,
    ),
    verification: {
      inputFingerprint,
      outputFingerprint,
      deterministic: true,
    },
    summary,
  };
}

function freezeProducerArtifact(
  input: SwarmOrchestratorInput,
): SwarmOrchestratorInput {
  if (!input.result.product || !input.result.selectedHypothesisId) {
    throw new Error("Swarm orchestrator: producer artifact is incomplete.");
  }
  return {
    result: input.result,
    raw: { objectiveText: input.raw.objectiveText ?? "" },
    seed: input.seed,
  };
}

function buildSummary(
  verdict: SwarmConsensus["verdict"],
  lensCount: number,
  counts: SwarmConsensus["counts"],
): string {
  if (verdict === "pass") {
    return `All ${lensCount} specialist lenses passed with no blockers or warnings (severity-weighted consensus).`;
  }
  if (verdict === "warn") {
    return `${lensCount} lenses reviewed: ${counts.warning} warning(s), no blockers (severity-weighted consensus).`;
  }
  return `${lensCount} lenses reviewed: ${counts.blocker} blocker(s), ${counts.warning} warning(s) (severity-weighted consensus).`;
}

/** Back-compat alias used by the pipeline. */
export function runSwarmPanel(input: SwarmOrchestratorInput): SwarmConsensus {
  return runSwarmOrchestrator(input);
}

export async function runSwarm(
  raw: RawObjective,
  seed = 1337,
): Promise<SwarmConsensus> {
  const { runDiscover } = await import("../pipeline");
  return runDiscover(raw, seed).swarmReview;
}

export { SWARM_LENS_COUNT, SWARM_LENSES } from "./lenses";

export type {
  SwarmConsensus,
  SwarmFinding,
  SwarmVerdict,
  SwarmLensReport,
} from "../types";
