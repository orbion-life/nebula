import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface UniProtRecord {
  accession: string;
  proteinName: string;
  sequenceLength: number | null;
  note: string;
}

/**
 * UniProt adapter. Would fetch a public protein record; unconfigured by default.
 */
export function fetchUniProt(
  accession: string,
  config?: AdapterConfig,
): AdapterResult<UniProtRecord> {
  const fallback: UniProtRecord = {
    accession,
    proteinName: "(public demo fixture — not fetched)",
    sequenceLength: null,
    note: "Public analog only. Presence of a UniProt annotation is not a sensing claim.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "UniProt API",
      wouldDo: "Fetch a public UniProt record (sequence + annotations) for the scaffold.",
      requiredSetup: "Set config.enabled and config.endpoint to the UniProt REST base URL.",
      claimBoundary:
        "Public data retrieval only; annotations inform hypotheses, not validation.",
      fixtureFallback: fallback,
    });
  }
  // A real implementation would fetch here; kept as a documented hook.
  return unavailable({
    adapter: "UniProt API",
    wouldDo: "Fetch a public UniProt record for the scaffold.",
    requiredSetup: "Live fetch not implemented in this public hook.",
    claimBoundary: "Public data retrieval only.",
    fixtureFallback: fallback,
    note: "Configured, but live fetch is intentionally not wired in the public repo.",
  });
}
