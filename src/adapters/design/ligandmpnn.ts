import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";
import type { DesignHandoffFixture } from "./rfdiffusion";

/**
 * LigandMPNN adapter (design handoff).
 *
 * Would design sequences around ligand/cofactor/scaffold constraints. Downstream
 * handoff only. Never emits a private mutation list or a ready-to-test sequence.
 */
export function ligandMpnnDesign(
  config?: AdapterConfig,
): AdapterResult<DesignHandoffFixture> {
  const fallback: DesignHandoffFixture = {
    artifactType: "sequence",
    publicDemoOnly: true,
    artifactPreview: "PUBLIC-DEMO-STUB / not a real sequence / cofactor-pocket sequence handoff",
    note: "Public demo handoff only; never a private mutation list or orderable sequence.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "LigandMPNN",
      wouldDo: "Design sequences around a ligand/cofactor/scaffold environment.",
      requiredSetup: "GPU + LigandMPNN install; set config.enabled and config.binaryPath.",
      claimBoundary:
        "Public demo handoff only; not a private mutation list, not ready-to-test, not validated.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "LigandMPNN",
    wouldDo: "Design sequences around cofactor constraints.",
    requiredSetup: "Live design not implemented in this public hook.",
    claimBoundary: "Public demo handoff only; never a private candidate.",
    fixtureFallback: fallback,
    note: "Configured, but live design is intentionally not wired in the public repo.",
  });
}
