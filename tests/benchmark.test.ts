import { describe, expect, it } from "vitest";
import {
  PUBLIC_BENCHMARKS,
  buildBenchmarkComparisons,
} from "../src/core/benchmark";
import { routeByClass } from "../src/core/fixtures/routes";
import { RADICAL_PAIR_ARTIFACT } from "../src/core/generated/radicalPair";

/**
 * MANDATORY acceptance test: at least one public benchmark has a reproducible
 * comparison, every trace/feature distinguishes public vs simulation vs
 * assumption, and no measured numeric values are fabricated.
 */
describe("public benchmark comparison", () => {
  it("every benchmark carries a real-looking DOI", () => {
    for (const b of PUBLIC_BENCHMARKS) {
      expect(b.citation.doi).toMatch(/^10\.\d{4,}\/\S+$/);
      expect(b.citation.year).toBeGreaterThan(2000);
    }
  });

  it("the radical-pair route qualitatively reproduces the flavoprotein-ODMR benchmark", () => {
    const route = routeByClass("LOV_flavin_radical_pair")!;
    const comparisons = buildBenchmarkComparisons(route);
    const odmr = comparisons.find((c) => c.benchmarkId === "bm_flavoprotein_odmr")!;
    expect(odmr).toBeTruthy();
    expect(odmr.agreementKind).toBe("qualitative_reproduction");
    expect(odmr.matches).toBe(true);
    expect(odmr.citation.doi).toBe("10.1038/s41587-026-03158-5");
    // The comparison must be GROUNDED in the artifact: the RF resonance it cites
    // is actually present (a real dip), reproducibly.
    const rf = RADICAL_PAIR_ARTIFACT.data.rf;
    expect(Math.min(...rf.deltaYieldFraction)).toBeLessThan(0);
    // No fabricated measured numbers in the public/qualitative description.
    expect(odmr.measuredQualitative).not.toMatch(/\d+(\.\d+)?\s*(%|mT|MHz|ns)/);
    expect(odmr.disclaimer.toLowerCase()).toContain("no measured numeric values");
  });

  it("the RFP giant-MFE comparison cites the LFE/HFE features present in the artifact", () => {
    const route = routeByClass("LOV_flavin_radical_pair")!;
    const rfp = buildBenchmarkComparisons(route).find(
      (c) => c.benchmarkId === "bm_rfp_giant_mfe",
    )!;
    expect(rfp.agreementKind).toBe("qualitative_reproduction");
    // The simulated feature it reports must match the artifact's actual LFE/HFE.
    const mfe = RADICAL_PAIR_ARTIFACT.data.mfePercent;
    expect(Math.min(...mfe)).toBeLessThan(-2); // low-field dip exists
    expect(Math.max(...mfe)).toBeGreaterThan(1); // high-field rise exists
    expect(rfp.simulatedFeature).toMatch(/low-field dip/i);
  });

  it("routes without a spin benchmark return an honest no-comparison", () => {
    const route = routeByClass("material_state")!;
    const comparisons = buildBenchmarkComparisons(route);
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0].agreementKind).toBe("no_comparison");
  });
});
