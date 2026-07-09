import { describe, expect, it } from "vitest";
import { MECHANISM_ROUTES, routeByClass } from "../src/core/fixtures/routes";
import { generateParameterSpace } from "../src/core/physics";
import { simulate } from "../src/core/simulator";
import { SYNTHETIC_TRACE_LABEL } from "../src/core/types";

describe("multimodal simulator", () => {
  it("returns identical traces for a fixed seed (determinism)", () => {
    const route = routeByClass("LOV_flavin_radical_pair")!;
    const space = generateParameterSpace(route);
    const a = simulate(route, space, 1337);
    const b = simulate(route, space, 1337);
    expect(a).toEqual(b);
  });

  it("produces different traces for different seeds", () => {
    const route = routeByClass("LOV_flavin_radical_pair")!;
    const space = generateParameterSpace(route);
    const a = simulate(route, space, 1);
    const b = simulate(route, space, 2);
    expect(a.traces[0].y).not.toEqual(b.traces[0].y);
  });

  it("labels every simulation as a synthetic assumption sweep", () => {
    for (const route of MECHANISM_ROUTES) {
      const space = generateParameterSpace(route);
      const out = simulate(route, space, 1337);
      expect(out.label).toBe(SYNTHETIC_TRACE_LABEL);
    }
  });

  it("includes mandatory photobleach + oxygen controls for non-confounder routes", () => {
    for (const route of MECHANISM_ROUTES) {
      if (route.simulatorPlugin === "confounder_annotation") continue;
      const space = generateParameterSpace(route);
      const out = simulate(route, space, 1337);
      const ids = out.traces.map((t) => t.id);
      expect(ids).toContain("photobleach_control");
      expect(ids).toContain("oxygen_nuisance");
    }
  });

  it("radical-pair field response is non-monotonic (has a low-field effect)", () => {
    const route = routeByClass("LOV_flavin_radical_pair")!;
    const space = generateParameterSpace(route);
    const out = simulate(route, space, 1337);
    const dFvsB = out.traces.find((t) => t.id === "delta_f_vs_b")!;
    // A clean saturating curve would be monotonically increasing. A radical-pair
    // low-field effect dips below the endpoint value at low field, so the global
    // minimum must NOT be at the first sample.
    const minIndex = dFvsB.y.indexOf(Math.min(...dFvsB.y));
    expect(minIndex).toBeGreaterThan(0);
    expect(Math.min(...dFvsB.y)).toBeLessThan(dFvsB.y[dFvsB.y.length - 1]);
  });

  it("always simulates temperature nuisance for real routes", () => {
    for (const route of MECHANISM_ROUTES) {
      if (route.simulatorPlugin === "confounder_annotation") continue;
      const space = generateParameterSpace(route);
      const ids = simulate(route, space, 1337).traces.map((t) => t.id);
      expect(ids).toContain("temperature_nuisance");
    }
  });

  it("metal/cofactor route yields a flat, undefined-readout annotation only", () => {
    const route = routeByClass("metal_cofactor_confounder")!;
    const space = generateParameterSpace(route);
    const out = simulate(route, space, 1337);
    expect(out.traces).toHaveLength(1);
    expect(out.traces[0].y.every((v) => v === 0)).toBe(true);
    expect(route.maxClaimLevel).toBe("diagnostic_only");
  });
});
