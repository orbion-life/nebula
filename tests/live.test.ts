import { afterEach, describe, expect, it, vi } from "vitest";
import { esmAnalogSearchLive } from "../src/adapters/retrieval/esm";
import { faissSearchLive } from "../src/adapters/retrieval/faiss";
import { radicalPyRunLive } from "../src/adapters/physics/radicalpy";

/**
 * Live adapter wiring tests.
 *
 * These verify the live paths are REAL (they call fetch / would spawn a process)
 * but degrade gracefully: unconfigured or failing calls fall back to the
 * deterministic offline engines, and success is clearly marked "ran".
 */
afterEach(() => vi.unstubAllGlobals());

describe("ESM live adapter", () => {
  it("falls back to the offline vector index when unconfigured", async () => {
    const r = await esmAnalogSearchLive("blue-light flavin sensor");
    expect(r.available).toBe(false);
    expect(r.fixtureFallback.method).toBe("vector_index_fallback");
    expect(r.fixtureFallback.hits.length).toBeGreaterThan(0);
  });

  it("performs a real HTTP call and returns a live result when configured", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hits: [
          { id: "aslov2", name: "AsLOV2", family: "LOV_flavin", score: 0.9, cosine: 0.9, keyword: 0.8, publicRef: "public" },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await esmAnalogSearchLive("flavin", {
      enabled: true,
      endpoint: "http://localhost:9/embed",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(r.available).toBe(true);
    expect(r.status).toBe("ran");
    expect(r.result?.method).toBe("esm_embedding");
    expect(r.result?.hits[0].id).toBe("aslov2");
  });

  it("degrades gracefully when the live call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );
    const r = await esmAnalogSearchLive("flavin", {
      enabled: true,
      endpoint: "http://localhost:9/embed",
    });
    expect(r.available).toBe(false);
    expect(r.note.toLowerCase()).toContain("degraded");
    expect(r.fixtureFallback.hits.length).toBeGreaterThan(0);
  });
});

describe("FAISS live adapter", () => {
  it("falls back to the offline vector index when unconfigured", async () => {
    const r = await faissSearchLive("flavin");
    expect(r.available).toBe(false);
    expect(r.fixtureFallback.index).toBe("vector_index_fallback");
  });
});

describe("RadicalPy live adapter", () => {
  it("falls back to the deterministic proxy when unconfigured", async () => {
    const r = await radicalPyRunLive({});
    expect(r.available).toBe(false);
    expect(r.fixtureFallback.usingProxy).toBe(true);
    expect(r.fixtureFallback.label).toBe("synthetic assumption sweep, not prediction");
  });
});
