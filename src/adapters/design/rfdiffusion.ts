import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface DesignHandoffFixture {
  artifactType: "backbone" | "sequence" | "template" | "none";
  publicDemoOnly: true;
  artifactPreview: string;
  note: string;
}

/**
 * RFdiffusion adapter (design handoff).
 *
 * Would generate a public backbone around a motif/cofactor environment. This is
 * a downstream HANDOFF, not the discovery engine. Unconfigured, it returns a
 * public-demo stub. It never emits an Orbion candidate or a validated sensor.
 */
export function rfdiffusionGenerate(
  config?: AdapterConfig,
): AdapterResult<DesignHandoffFixture> {
  const fallback: DesignHandoffFixture = {
    artifactType: "backbone",
    publicDemoOnly: true,
    artifactPreview: "PUBLIC-DEMO-STUB / not a real backbone / motif-scaffolding handoff",
    note: "Public demo handoff only; not an Orbion candidate and not validated for sensing.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "RFdiffusion",
      wouldDo: "Generate a public backbone around a motif/cofactor environment.",
      requiredSetup: "GPU + RFdiffusion install; set config.enabled and config.binaryPath.",
      claimBoundary:
        "Public demo handoff only; outputs are not commercial candidates and not validated.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "RFdiffusion",
    wouldDo: "Generate a public backbone.",
    requiredSetup: "Live generation not implemented in this public hook.",
    claimBoundary: "Public demo handoff only; never a private candidate.",
    fixtureFallback: fallback,
    note: "Configured, but live generation is intentionally not wired in the public repo.",
  });
}
