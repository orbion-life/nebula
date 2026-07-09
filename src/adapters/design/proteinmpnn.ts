import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";
import type { DesignHandoffFixture } from "./rfdiffusion";

/**
 * ProteinMPNN adapter (design handoff).
 *
 * Would design sequences for a fixed public template scaffold. Downstream
 * handoff only. Never emits a commercial candidate.
 */
export function proteinMpnnDesign(
  config?: AdapterConfig,
): AdapterResult<DesignHandoffFixture> {
  const fallback: DesignHandoffFixture = {
    artifactType: "sequence",
    publicDemoOnly: true,
    artifactPreview: "PUBLIC-DEMO-STUB / not a real sequence / public template sequence handoff",
    note: "Public demo handoff only; outputs are not commercial candidates.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "ProteinMPNN",
      wouldDo: "Design sequences for a fixed public template scaffold.",
      requiredSetup: "GPU/CPU + ProteinMPNN install; set config.enabled and config.binaryPath.",
      claimBoundary: "Public demo handoff only; not a commercial candidate and not validated.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "ProteinMPNN",
    wouldDo: "Design sequences for a public template scaffold.",
    requiredSetup: "Live design not implemented in this public hook.",
    claimBoundary: "Public demo handoff only; never a private candidate.",
    fixtureFallback: fallback,
    note: "Configured, but live design is intentionally not wired in the public repo.",
  });
}
