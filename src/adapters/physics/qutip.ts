import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface OpenQuantumFixture {
  usingProxy: true;
  label: "synthetic assumption sweep, not prediction";
  note: string;
}

/**
 * QuTiP adapter (physics).
 *
 * Would run open-quantum-system / master-equation dynamics for triplet/ODMR-like
 * routes. Unconfigured, the app uses the deterministic TS triplet proxy. Output
 * is a synthetic assumption sweep unless anchored to real measured data.
 */
export function qutipSimulate(
  config?: AdapterConfig,
): AdapterResult<OpenQuantumFixture> {
  const fallback: OpenQuantumFixture = {
    usingProxy: true,
    label: "synthetic assumption sweep, not prediction",
    note: "Deterministic TS triplet/ODMR-like proxy is used instead.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "QuTiP",
      wouldDo: "Solve master equations for triplet spin sublevels / ODMR-like contrast.",
      requiredSetup: "Python env with qutip; set config.enabled and config.binaryPath/endpoint.",
      claimBoundary:
        "Simulation under stated assumptions; a synthetic sweep, not a measured result.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "QuTiP",
    wouldDo: "Open-quantum-system dynamics for triplet/ODMR-like routes.",
    requiredSetup: "Live QuTiP call not implemented in this public hook.",
    claimBoundary: "Synthetic assumption sweep unless real data is explicitly loaded.",
    fixtureFallback: fallback,
    note: "Configured, but the live simulation is intentionally not wired in the public repo.",
  });
}
