import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface RcsbRecord {
  pdbId: string;
  title: string;
  note: string;
}

/** RCSB PDB adapter. Would fetch a public experimental structure. */
export function fetchRcsb(
  pdbId: string,
  config?: AdapterConfig,
): AdapterResult<RcsbRecord> {
  const fallback: RcsbRecord = {
    pdbId,
    title: "(public demo fixture — not fetched)",
    note: "Public structure reference only; not a designed or private candidate.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "RCSB PDB APIs",
      wouldDo: "Fetch a public experimental structure and metadata for the scaffold.",
      requiredSetup: "Set config.enabled and config.endpoint to the RCSB data/REST API.",
      claimBoundary: "Public structures only; geometry context, not a sensing claim.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "RCSB PDB APIs",
    wouldDo: "Fetch a public structure for the scaffold.",
    requiredSetup: "Live fetch not implemented in this public hook.",
    claimBoundary: "Public structures only.",
    fixtureFallback: fallback,
    note: "Configured, but live fetch is intentionally not wired in the public repo.",
  });
}
