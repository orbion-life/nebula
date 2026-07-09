import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface ElectronicStructureFixture {
  computed: false;
  label: "synthetic assumption sweep, not prediction";
  note: string;
}

/**
 * PySCF adapter (physics).
 *
 * Would run quantum-chemistry electronic-structure calculations for cofactor
 * environments in selected outliers. Unconfigured, nothing is computed and the
 * app relies on documented assumptions only.
 */
export function pyscfCompute(
  config?: AdapterConfig,
): AdapterResult<ElectronicStructureFixture> {
  const fallback: ElectronicStructureFixture = {
    computed: false,
    label: "synthetic assumption sweep, not prediction",
    note: "No electronic-structure computation performed; documented assumptions used instead.",
  };
  if (!isConfigured(config)) {
    return unavailable({
      adapter: "PySCF",
      wouldDo:
        "Run electronic-structure calculations (e.g. cofactor frontier orbitals) for outlier triage.",
      requiredSetup: "Python env with pyscf; set config.enabled and config.binaryPath/endpoint.",
      claimBoundary:
        "Computed properties are model outputs under assumptions; not experimental validation.",
      fixtureFallback: fallback,
    });
  }
  return unavailable({
    adapter: "PySCF",
    wouldDo: "Electronic-structure calculations for cofactor environments.",
    requiredSetup: "Live PySCF call not implemented in this public hook.",
    claimBoundary: "Model output under assumptions; not validation.",
    fixtureFallback: fallback,
    note: "Configured, but the live calculation is intentionally not wired in the public repo.",
  });
}
