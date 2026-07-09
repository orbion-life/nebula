import { describe, expect, it } from "vitest";
import { compileObjective } from "../src/core/objectiveCompiler";
import { DEMO_OBJECTIVE } from "../src/core/pipeline";

describe("objective compiler", () => {
  it("extracts readouts, material, host, excitation from the demo objective", () => {
    const o = compileObjective(DEMO_OBJECTIVE);
    expect(o.desiredReadouts).toContain("fluorescence");
    expect(o.desiredReadouts).toContain("RF_magnetic");
    expect(o.materialContext).toBe("hydrogel");
    expect(o.expressionHost).toBe("bacteria");
    expect(o.excitationAllowed).toContain("blue-light");
    expect(o.confidentialSequenceProvided).toBe(false);
    expect(o.constraints).toContain("public/synthetic evidence only");
  });

  it("translates vague 'quantum' into concrete candidate readouts", () => {
    const o = compileObjective({ objectiveText: "We want a quantum protein readout." });
    expect(o.desiredReadouts).toEqual(
      expect.arrayContaining(["fluorescence", "RF_magnetic", "ODMR_like"]),
    );
  });

  it("flags missing information deterministically", () => {
    const o = compileObjective({ objectiveText: "fluorescence readout" });
    expect(o.materialContext).toBe("unknown");
    expect(o.missingInformation).toContain("material context not specified");
  });

  it("is deterministic", () => {
    const a = compileObjective(DEMO_OBJECTIVE);
    const b = compileObjective(DEMO_OBJECTIVE);
    expect(a).toEqual(b);
  });
});
