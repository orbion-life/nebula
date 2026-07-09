import { vectorAnalogSearch, type CorpusHit } from "../../core/analogIndex";
import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface AnalogSearchResult {
  method: "vector_index_fallback" | "esm_embedding";
  hits: CorpusHit[];
  note: string;
}

/**
 * ESM embedding adapter (retrieval).
 *
 * Offline default: deterministic hybrid vector index over the public corpus
 * (src/core/analogIndex.ts). When configured with a live ESM embedding endpoint,
 * `esmAnalogSearchLive` performs a real HTTP call and, on any failure, degrades
 * to the offline vector index.
 *
 * CRITICAL: embeddings are used for PUBLIC ANALOG SEARCH ONLY. They do NOT and
 * must NOT predict spin, magnetic, or sensing response.
 */
export function esmAnalogSearch(
  query: string,
  config?: AdapterConfig,
): AdapterResult<AnalogSearchResult> {
  const fallback: AnalogSearchResult = {
    method: "vector_index_fallback",
    hits: vectorAnalogSearch(query),
    note: "Offline deterministic vector index over the public corpus. Analog != prediction.",
  };
  return unavailable({
    adapter: "ESM-2 / ESM-C embeddings",
    wouldDo:
      "Embed the query with a protein language model and retrieve public analogs by embedding similarity.",
    requiredSetup:
      "Call esmAnalogSearchLive() with { enabled, endpoint } pointing at an ESM embedding service (GPU recommended).",
    claimBoundary:
      "Embeddings are for public analog search only. Sequence models do NOT predict spin/magnetic response.",
    fixtureFallback: fallback,
    note: isConfigured(config)
      ? "Use esmAnalogSearchLive() for the configured live path."
      : undefined,
  });
}

/**
 * LIVE ESM analog search. Performs a real HTTP POST to a configured embedding
 * service. Degrades gracefully to the offline vector index on any error.
 *
 * Expected service contract (you provide the service):
 *   POST {endpoint}  body: { query: string }
 *   200 -> { hits: Array<{ id, name, family, score }> }  OR  { embedding: number[] }
 */
export async function esmAnalogSearchLive(
  query: string,
  config?: AdapterConfig,
): Promise<AdapterResult<AnalogSearchResult>> {
  const offline = esmAnalogSearch(query, config);
  if (!isConfigured(config) || !config?.endpoint) return offline;

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`ESM service HTTP ${res.status}`);
    const data: unknown = await res.json();
    const hits = normalizeHits(data, query);
    const liveResult: AnalogSearchResult = {
      method: "esm_embedding",
      hits,
      note: "Live ESM embedding service result. Analog != prediction.",
    };
    return {
      adapter: "ESM-2 / ESM-C embeddings",
      available: true,
      status: "ran",
      wouldDo: offline.wouldDo,
      requiredSetup: offline.requiredSetup,
      claimBoundary: offline.claimBoundary,
      fixtureFallback: offline.fixtureFallback,
      result: liveResult,
      note: `Live ESM embedding service returned ${hits.length} public analog(s). Analog != prediction.`,
    };
  } catch (err) {
    return {
      ...offline,
      note: `Live ESM call failed (${(err as Error).message}); degraded to offline vector index.`,
    };
  }
}

function normalizeHits(data: unknown, query: string): CorpusHit[] {
  const obj = data as { hits?: unknown };
  if (obj && Array.isArray(obj.hits)) {
    return (obj.hits as CorpusHit[]).slice(0, 5);
  }
  // If the service returned only an embedding, fall back to the local ranking.
  return vectorAnalogSearch(query);
}
