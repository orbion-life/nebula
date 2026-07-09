import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface AlphaFoldRecord {
  accession: string;
  meanPlddt: number | null;
  note: string;
}

/** AlphaFold DB adapter. Would fetch a public predicted structure + pLDDT. */
export function fetchAlphaFold(
  accession: string,
  config?: AdapterConfig,
): AdapterResult<AlphaFoldRecord> {
  const fallback: AlphaFoldRecord = {
    accession,
    meanPlddt: null,
    note: "A predicted structure informs geometry only; it does NOT determine spin response.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "AlphaFold DB",
      wouldDo: "Fetch a public predicted structure (and pLDDT) for the scaffold.",
      requiredSetup: "Set config.enabled and config.endpoint to the AlphaFold DB API.",
      claimBoundary:
        "Predicted geometry only. Sequence/structure prediction never determines spin/magnetic response.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "AlphaFold DB",
    wouldDo: "Fetch a public predicted structure for the scaffold.",
    requiredSetup: "Live fetch not implemented in this public hook.",
    claimBoundary: "Predicted geometry only; not a spin-response claim.",
    fixtureFallback: fallback,
    note: "Configured, but live fetch is intentionally not wired in the public repo.",
  });
}
