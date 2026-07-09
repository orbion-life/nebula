import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";
import type { DesignHandoffFixture } from "./rfdiffusion";

/**
 * Boltz adapter (design handoff / structure check).
 *
 * Would predict the structure/complex of a proposed design handoff to sanity-check
 * its fold. Still a prediction, never a sensing claim or validation.
 */
export function boltzPredict(
  config?: AdapterConfig,
): AdapterResult<DesignHandoffFixture> {
  const fallback: DesignHandoffFixture = {
    artifactType: "template",
    publicDemoOnly: true,
    artifactPreview: "PUBLIC-DEMO-STUB / predicted fold sanity-check placeholder",
    note: "Predicted structure only; not validation and not a spin-response prediction.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "Boltz",
      wouldDo: "Predict the structure/complex of a proposed public design handoff.",
      requiredSetup: "GPU + Boltz install; set config.enabled and config.binaryPath.",
      claimBoundary:
        "Predicted structure only; not validation, not a sensing or spin-response claim.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "Boltz",
    wouldDo: "Predict the fold/complex of a design handoff.",
    requiredSetup: "Live prediction not implemented in this public hook.",
    claimBoundary: "Predicted structure only; not validation.",
    fixtureFallback: fallback,
    note: "Configured, but live prediction is intentionally not wired in the public repo.",
  });
}
