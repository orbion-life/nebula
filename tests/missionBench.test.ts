import { describe, expect, it } from "vitest";
import { readoutsForSense } from "../src/ui/discover/objective/MissionBench";

describe("mission bench decision fields", () => {
  it("maps sensing targets to readouts without product-form leakage", () => {
    expect(readoutsForSense("magnetic field")).toEqual(["RF_magnetic", "fluorescence"]);
    expect(readoutsForSense("radio-frequency field")).toEqual(["RF_magnetic", "ODMR_like", "fluorescence"]);
    expect(readoutsForSense("redox potential")).toEqual(["redox_electrochemical", "fluorescence"]);
    expect(readoutsForSense("light history")).toEqual(["fluorescence", "lifetime"]);
    for (const target of ["magnetic field", "radio-frequency field", "redox potential", "light history"] as const) {
      expect(readoutsForSense(target)).not.toContain("material_state");
    }
  });
});
