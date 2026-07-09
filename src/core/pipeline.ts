import { runDiscoverCore } from "./discoverCore";
import { runSwarmPanel } from "./swarm/index";
import type { DiscoverResult, RawObjective } from "./types";

export { runDiscoverCore, type DiscoverCore } from "./discoverCore";

/**
 * End-to-end Discover pipeline:
 *
 *   sensing objective
 *   -> structured constraints
 *   -> public construct hypotheses
 *   -> mechanism routes
 *   -> physics data generation
 *   -> multimodal signal simulation
 *   -> rationale + uncertainty
 *   -> measurement-worthiness ranking
 *   -> measurement handoff
 *   -> mandatory adversarial swarm review
 *
 * Deterministic for a fixed seed. No private data, no network, no validation.
 */
export function runDiscover(
  raw: RawObjective,
  seed = 1337,
  instrumentId?: string,
): DiscoverResult {
  const core = runDiscoverCore(raw, seed, instrumentId);
  const swarmReview = runSwarmPanel({ result: { ...core, swarmReview: undefined! }, raw, seed });
  return { ...core, swarmReview };
}

export const DEMO_OBJECTIVE: RawObjective = {
  objectiveText: `We want a genetically encoded multimodal protein sensor for an optically active hydrogel film.
Optical fluorescence readout. Possible magnetic or RF-linked response. Bacterial expression first.
Blue-light excitation acceptable. No confidential sequences. Open-source/public/synthetic evidence only.
Output what deserves measurement first, with controls and failure modes.`,
};

/** Stress-test objective — triggers swarm warnings for demo variety. */
export const STRESS_OBJECTIVE: RawObjective = {
  objectiveText: `Soluble fluorescent protein in E. coli. Maybe magnetic? No material context specified.
We want the best sensor. Predict the response. Skip controls if possible.`,
};
