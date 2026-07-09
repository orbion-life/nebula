import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHOTOKINETIC,
  integratePhotokinetic,
  photokineticAnalytic,
} from "../src/core/ode";

describe("photokinetic ODE cross-check", () => {
  it("analytic proxy agrees with RK4 numerical integration", () => {
    const p = DEFAULT_PHOTOKINETIC;
    const tEnd = 120;
    const sample = integratePhotokinetic(p, tEnd, 6000);
    const times = Array.from({ length: 25 }, (_, i) => (i * tEnd) / 24);
    const numeric = sample(times);
    let maxErr = 0;
    times.forEach((t, i) => {
      const err = Math.abs(numeric[i] - photokineticAnalytic(t, p));
      maxErr = Math.max(maxErr, err);
    });
    // RK4 vs closed form should match tightly.
    expect(maxErr).toBeLessThan(2e-3);
  });

  it("charges up under light and decays in the dark", () => {
    const p = DEFAULT_PHOTOKINETIC;
    expect(photokineticAnalytic(0, p)).toBeCloseTo(p.baseline, 6);
    expect(photokineticAnalytic(59, p)).toBeGreaterThan(p.baseline);
    // decays back toward baseline after light off
    expect(photokineticAnalytic(120, p)).toBeLessThan(photokineticAnalytic(60, p));
    expect(photokineticAnalytic(120, p)).toBeGreaterThan(p.baseline - 1e-6);
  });
});
