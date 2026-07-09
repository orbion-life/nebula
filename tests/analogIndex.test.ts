import { describe, expect, it } from "vitest";
import { embed, vectorAnalogSearch, PUBLIC_CORPUS } from "../src/core/analogIndex";

describe("public vector analog index", () => {
  it("has a curated public corpus", () => {
    expect(PUBLIC_CORPUS.length).toBeGreaterThanOrEqual(10);
    for (const e of PUBLIC_CORPUS) {
      expect(e.publicRef.length).toBeGreaterThan(0);
    }
  });

  it("produces deterministic, L2-normalized embeddings", () => {
    const a = embed("LOV flavin blue light");
    const b = embed("LOV flavin blue light");
    expect(Array.from(a)).toEqual(Array.from(b));
    const norm = Math.sqrt(Array.from(a).reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("ranks relevant public analogs first (LOV/flavin query)", () => {
    const hits = vectorAnalogSearch("blue-light flavin LOV radical pair sensor");
    expect(hits.length).toBeGreaterThan(0);
    // The top hit should be a flavin/LOV-family entry, not an unrelated RFP.
    expect(["LOV_flavin", "cryptochrome_FAD", "redox_flavoprotein"]).toContain(
      hits[0].family,
    );
    for (const h of hits) {
      expect(h.cosine).toBeGreaterThanOrEqual(0);
      expect(h.cosine).toBeLessThanOrEqual(1);
      expect(h.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic across calls", () => {
    const q = "red fluorescent protein triplet";
    expect(vectorAnalogSearch(q)).toEqual(vectorAnalogSearch(q));
  });
});
