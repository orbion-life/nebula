import { describe, expect, it } from "vitest";
import { compileObjective } from "../src/core/objectiveCompiler";
import { generateHypotheses } from "../src/core/constructGenerator";
import { DEMO_OBJECTIVE } from "../src/core/pipeline";

describe("construct hypothesis generator", () => {
  const objective = compileObjective(DEMO_OBJECTIVE);
  const hyps = generateHypotheses(objective);

  it("produces 3-5 hypotheses", () => {
    expect(hyps.length).toBeGreaterThanOrEqual(3);
    expect(hyps.length).toBeLessThanOrEqual(5);
  });

  it("marks every hypothesis as public and not a private candidate", () => {
    for (const h of hyps) {
      expect(h.status).toBe("public_hypothesis_not_validated");
      expect(h.privateCandidate).toBe(false);
    }
  });

  it("never emits a mutation list or orderable sequence", () => {
    const blob = JSON.stringify(hyps).toLowerCase();
    expect(blob).not.toMatch(/mutation|→[a-z]\d+[a-z]|orderable|ready[- ]to[- ]order/);
    // no bare uppercase amino-acid strings that look like sequences
    expect(JSON.stringify(hyps)).not.toMatch(/\b[ACDEFGHIKLMNPQRSTVWY]{12,}\b/);
  });

  it("keeps the metal/cofactor route as confounder-only, last", () => {
    const metal = hyps.find((h) => h.scaffoldFamily === "metal_cofactor");
    if (metal) {
      expect(hyps[hyps.length - 1].scaffoldFamily).toBe("metal_cofactor");
    }
  });

  it("is deterministic", () => {
    const again = generateHypotheses(objective);
    expect(again).toEqual(hyps);
  });

  it("surfaces a material-state hypothesis for a solid-material objective", () => {
    // Objective names a hydrogel but does NOT use a 'material_state' readout word.
    const obj = compileObjective({
      objectiveText:
        "Fluorescent protein sensor embedded in a hydrogel. Blue-light excitation.",
    });
    const material = generateHypotheses(obj).find(
      (h) => h.scaffoldFamily === "material_composite",
    );
    expect(material).toBeDefined();
    expect(material!.readoutModes).toContain("material_state");
  });
});
