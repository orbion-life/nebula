import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { runDiscoverCore, ObjectiveValidationError } from "../src/core/discoverCore";
import { exportJson, exportMarkdown } from "../src/core/export";

describe("end-to-end pipeline", () => {
  const result = runDiscover(DEMO_OBJECTIVE, 1337);

  it("surfaces Zod validation errors for an invalid objective (never bypasses)", () => {
    expect(() => runDiscoverCore({ objectiveText: "" })).toThrow(ObjectiveValidationError);
    try {
      runDiscover({ objectiveText: "" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ObjectiveValidationError);
      expect((e as ObjectiveValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it("produces simulation evidence for every candidate before ranking", () => {
    expect(result.simulationEvidence.length).toBe(result.hypotheses.length);
    expect(result.ranking.length).toBe(result.hypotheses.length);
    for (const e of result.simulationEvidence) {
      expect(typeof e.expectedSNR).toBe("number");
    }
  });

  it("carries a decisive measurement plan for the top hypothesis", () => {
    const mp = result.measurementPlan;
    expect(mp.hypothesisId).toBe(result.selectedHypothesisId);
    expect(mp.whatToMeasure).toBeTruthy();
    expect(mp.killCriterion).toBeTruthy();
    expect(mp.positiveControls.length + mp.negativeControls.length).toBeGreaterThan(0);
  });

  it("runs the full transformation and selects a top hypothesis", () => {
    expect(result.product).toBe("Nebula");
    expect(result.hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(result.ranking[0].rank).toBe(1);
    expect(result.selectedHypothesisId).toBe(result.ranking[0].hypothesisId);
  });

  it("is deterministic for a fixed seed", () => {
    const again = runDiscover(DEMO_OBJECTIVE, 1337);
    expect(again).toEqual(result);
  });

  it("carries a blocked claim example that is downgraded", () => {
    expect(result.blockedClaimExample.blocked).toBe(true);
    expect(result.allowedClaimExample).toMatch(/requires experimental validation/i);
  });

  it("exports markdown with controls, confounders, and the synthetic label", () => {
    const md = exportMarkdown(result);
    expect(md).toMatch(/synthetic assumption sweep, not prediction/i);
    expect(md).toMatch(/Required controls/i);
    expect(md).toMatch(/Confounders/i);
    expect(md).toMatch(/not an Orbion commercial candidate/i);
    expect(md).toMatch(/Mandatory swarm review/i);
  });

  it("export is valid JSON", () => {
    expect(() => JSON.parse(exportJson(result))).not.toThrow();
  });
});
