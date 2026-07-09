import { describe, expect, it } from "vitest";
import {
  RADICAL_PAIR_ARTIFACT,
  radicalPairParameters,
  validateRadicalPairArtifact,
} from "../src/core/generated/radicalPair";

describe("generated radical-pair artifact", () => {
  it("loads and passes Zod validation at import", () => {
    expect(RADICAL_PAIR_ARTIFACT.artifact).toBe("radical_pair_mary");
    expect(RADICAL_PAIR_ARTIFACT.label).toBe(
      "synthetic assumption sweep, not prediction",
    );
    expect(RADICAL_PAIR_ARTIFACT.contentHash).toHaveLength(64);
    expect(RADICAL_PAIR_ARTIFACT.generator.radicalpy).toBeTruthy();
  });

  it("reproduces the qualitative radical-pair MARY signature (LFE dip + HFE rise)", () => {
    const mfe = RADICAL_PAIR_ARTIFACT.data.mfePercent;
    // Low-field effect: a clear negative dip.
    expect(Math.min(...mfe)).toBeLessThan(-2);
    // High-field effect: a positive saturation region.
    expect(Math.max(...mfe)).toBeGreaterThan(1);
  });

  it("counterfactual controls collapse the effect", () => {
    const relax = RADICAL_PAIR_ARTIFACT.data.controls.relaxation_dominated.mfePercent;
    const noHf = RADICAL_PAIR_ARTIFACT.data.controls.no_hyperfine.mfePercent;
    // Fast relaxation nearly kills the magnetic field effect.
    expect(Math.max(...relax.map(Math.abs))).toBeLessThan(2);
    // No hyperfine => no singlet-triplet mixing => exactly no field effect.
    expect(Math.max(...noHf.map(Math.abs))).toBeLessThan(1e-6);
  });

  it("RF response is frequency-resolved and vanishes without drive (B1=0)", () => {
    const rf = RADICAL_PAIR_ARTIFACT.data.rf;
    // A real resonance produces a non-trivial dip somewhere in the spectrum.
    expect(Math.min(...rf.rfResponseNormalized)).toBeLessThan(-0.1);
    // With no RF drive the response is flat (RF is not a scalar multiplier).
    expect(Math.max(...rf.control_b1_zero.map(Math.abs))).toBeLessThan(1e-6);
  });

  it("every parameter carries full provenance", () => {
    const params = radicalPairParameters();
    expect(params.length).toBeGreaterThan(0);
    for (const p of params) {
      expect(p.name).toBeTruthy();
      expect(p.unit).toBeTruthy();
      expect(p.range).toHaveLength(2);
      expect(["low", "medium", "high"]).toContain(p.uncertainty);
      expect([
        "database",
        "literature",
        "assumption",
        "instrument",
        "user_constraint",
      ]).toContain(p.sourceType);
      expect(p.citationOrAssumption).toBeTruthy();
      expect(p.applicabilityLimits).toBeTruthy();
    }
  });

  it("rejects a corrupted artifact instead of consuming it", () => {
    const bad = validateRadicalPairArtifact({ artifact: "radical_pair_mary" });
    expect(bad.ok).toBe(false);

    const wrongLabel = validateRadicalPairArtifact({
      ...RADICAL_PAIR_ARTIFACT,
      label: "measured data",
    });
    expect(wrongLabel.ok).toBe(false);

    // Mutated array lengths must be caught by the integrity check.
    const mismatched = validateRadicalPairArtifact({
      ...RADICAL_PAIR_ARTIFACT,
      data: {
        ...RADICAL_PAIR_ARTIFACT.data,
        mfePercent: RADICAL_PAIR_ARTIFACT.data.mfePercent.slice(0, 3),
      },
    });
    expect(mismatched.ok).toBe(false);
  });
});
