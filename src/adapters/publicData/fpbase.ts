import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface FpbaseRecord {
  name: string;
  exMaxNm: number | null;
  emMaxNm: number | null;
  note: string;
}

/** FPbase adapter. Would fetch public fluorescent-protein spectra/properties. */
export function fetchFpbase(
  name: string,
  config?: AdapterConfig,
): AdapterResult<FpbaseRecord> {
  const fallback: FpbaseRecord = {
    name,
    exMaxNm: null,
    emMaxNm: null,
    note: "Public spectral data only; not a validated sensor property.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "FPbase API",
      wouldDo: "Fetch public excitation/emission spectra and brightness for a fluorescent protein.",
      requiredSetup: "Set config.enabled and config.endpoint to the FPbase API.",
      claimBoundary:
        "Public optical properties inform readout feasibility, not sensing validation.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "FPbase API",
    wouldDo: "Fetch public FP spectra/properties.",
    requiredSetup: "Live fetch not implemented in this public hook.",
    claimBoundary: "Public optical properties only.",
    fixtureFallback: fallback,
    note: "Configured, but live fetch is intentionally not wired in the public repo.",
  });
}
