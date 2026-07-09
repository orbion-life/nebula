import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { exportJson, exportMarkdown } from "../src/core/export";

describe("end-to-end pipeline", () => {
  const result = runDiscover(DEMO_OBJECTIVE, 1337);

  it("runs the full transformation and selects a top hypothesis", () => {
    expect(result.product).toBe("Nebula Discover");
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
