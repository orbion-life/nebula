/**
 * API client contract tests (node env, fetch mocked).
 * Verifies the client hits the right endpoints with the right bodies, surfaces
 * server errors as ApiError, and classifies terminal run states correctly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, compileObjective, createRun, isTerminal } from "../src/api/client";

function mockFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "MOCK",
      json: async () => body,
    } as Response;
  });
  // @ts-expect-error test shim
  globalThis.fetch = fn;
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("compileObjective POSTs the raw objective to the compile endpoint", async () => {
    const calls = mockFetch(200, { objective_id: "obj_x", desired_modalities: ["fluorescence"] });
    await compileObjective("magnetic sensor", "novice", null, 7);
    expect(calls[0].url).toBe("/api/objectives/compile");
    expect(calls[0].init?.method).toBe("POST");
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent).toMatchObject({ objective_text: "magnetic sensor", user_mode: "novice", seed: 7 });
  });

  it("createRun POSTs to /api/runs", async () => {
    const calls = mockFetch(201, { run_id: "run_1", status: "queued", input_fingerprint: "fp" });
    const r = await createRun({ objective_text: "x", user_mode: "expert" });
    expect(calls[0].url).toBe("/api/runs");
    expect(calls[0].init?.method).toBe("POST");
    expect(r.run_id).toBe("run_1");
  });

  it("surfaces server error detail as ApiError", async () => {
    mockFetch(422, { detail: "invalid objective" });
    await expect(createRun({ objective_text: "", user_mode: "novice" })).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "invalid objective",
    });
    // ApiError is the concrete type
    mockFetch(500, { detail: "boom" });
    await expect(compileObjective("x", "novice")).rejects.toBeInstanceOf(ApiError);
  });

  it("classifies terminal run states", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("retrieving_evidence")).toBe(false);
    expect(isTerminal("queued")).toBe(false);
  });
});
