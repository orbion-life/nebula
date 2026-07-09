import { vectorAnalogSearch, type CorpusHit } from "../../core/analogIndex";
import { type AdapterConfig, type AdapterResult, isConfigured, unavailable } from "../types";

export interface IndexSearchResult {
  index: "vector_index_fallback" | "faiss";
  hits: CorpusHit[];
  note: string;
}

/**
 * FAISS / hnswlib vector-index adapter (retrieval).
 *
 * Offline default: the deterministic hybrid vector index in
 * src/core/analogIndex.ts (a real embedding index, not keyword-only). When
 * configured, `faissSearchLive` queries a real FAISS/hnswlib service over a
 * prebuilt PUBLIC embedding index and degrades gracefully on failure.
 *
 * Nearest-neighbour retrieval over public vectors predicts nothing.
 */
export function faissSearch(
  query: string,
  config?: AdapterConfig,
): AdapterResult<IndexSearchResult> {
  const fallback: IndexSearchResult = {
    index: "vector_index_fallback",
    hits: vectorAnalogSearch(query),
    note: "Offline deterministic vector index over the public corpus.",
  };
  return unavailable({
    adapter: "FAISS / hnswlib index",
    wouldDo:
      "Nearest-neighbour search over a prebuilt index of PUBLIC embeddings to surface analogs.",
    requiredSetup:
      "Call faissSearchLive() with { enabled, endpoint } pointing at a FAISS/hnswlib service holding a public index.",
    claimBoundary:
      "Public analog search only via nearest-neighbour retrieval over public vectors; predicts no biological property.",
    fixtureFallback: fallback,
    note: isConfigured(config)
      ? "Use faissSearchLive() for the configured live path."
      : undefined,
  });
}

/** LIVE FAISS/hnswlib query with graceful degradation to the offline index. */
export async function faissSearchLive(
  query: string,
  config?: AdapterConfig,
): Promise<AdapterResult<IndexSearchResult>> {
  const offline = faissSearch(query, config);
  if (!isConfigured(config) || !config?.endpoint) return offline;

  try {
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, k: 5 }),
    });
    if (!res.ok) throw new Error(`FAISS service HTTP ${res.status}`);
    const data = (await res.json()) as { hits?: CorpusHit[] };
    const hits = Array.isArray(data.hits)
      ? data.hits.slice(0, 5)
      : vectorAnalogSearch(query);
    return {
      adapter: "FAISS / hnswlib index",
      available: true,
      status: "ran",
      wouldDo: offline.wouldDo,
      requiredSetup: offline.requiredSetup,
      claimBoundary: offline.claimBoundary,
      fixtureFallback: offline.fixtureFallback,
      result: { index: "faiss", hits, note: "Live FAISS index result." },
      note: `Live FAISS index returned ${hits.length} public analog(s).`,
    };
  } catch (err) {
    return {
      ...offline,
      note: `Live FAISS call failed (${(err as Error).message}); degraded to offline vector index.`,
    };
  }
}
