import { describe, expect, it } from "vitest";
import { plddtColor } from "../src/ui/discover/StructureViewer";

describe("StructureViewer confidence colors", () => {
  it("uses AlphaFold's four pLDDT bands and a neutral fallback", () => {
    expect(plddtColor(97)).toBe(0x0053d6);
    expect(plddtColor(80)).toBe(0x65cbf3);
    expect(plddtColor(60)).toBe(0xffdb13);
    expect(plddtColor(20)).toBe(0xff7d45);
    expect(plddtColor(undefined)).toBe(0x7f9bc0);
  });
});
