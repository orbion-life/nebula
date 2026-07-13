import Fuse from "fuse.js";

/**
 * Public analog index (real vector index, offline & deterministic).
 *
 * This is a genuine embedding index, NOT keyword-only search. Each public
 * corpus entry is embedded into an L2-normalized hashed-trigram vector; queries
 * are embedded the same way and ranked by cosine similarity, then blended with a
 * Fuse.js keyword score for robustness (hybrid retrieval). In production this is
 * where a FAISS/hnswlib index over ESM embeddings would slot in (see the
 * retrieval adapters); this TS index is the laptop-friendly implementation.
 *
 * CLAIM BOUNDARY: this finds PUBLIC ANALOGS only. It never predicts spin,
 * magnetic, or sensing response. Analog != prediction.
 */

export interface CorpusEntry {
  id: string;
  name: string;
  family: string;
  keywords: string[];
  publicRef: string;
}

export interface CorpusHit {
  id: string;
  name: string;
  family: string;
  score: number; // hybrid 0..1
  cosine: number; // vector similarity 0..1
  keyword: number; // keyword similarity 0..1
  publicRef: string;
}

/**
 * Curated PUBLIC corpus of well-known public proteins/scaffolds used as analog
 * targets. All are public, literature-known constructs, none are Orbion
 * candidates, none carry any sensing claim.
 */
export const PUBLIC_CORPUS: CorpusEntry[] = [
  { id: "aslov2", name: "AsLOV2 (Avena sativa phototropin LOV2)", family: "LOV_flavin", keywords: ["LOV", "FMN", "blue light", "photocycle", "cysteinyl adduct", "radical"], publicRef: "phototropin LOV2 domain (public)" },
  { id: "ilov", name: "iLOV (engineered fluorescent LOV)", family: "LOV_flavin", keywords: ["LOV", "FMN", "fluorescent", "flavin", "oxygen-independent", "blue light"], publicRef: "iLOV fluorescent flavoprotein (public)" },
  { id: "minisog", name: "miniSOG (mini singlet oxygen generator)", family: "LOV_flavin", keywords: ["LOV", "FMN", "flavin", "singlet oxygen", "fluorescent", "triplet"], publicRef: "miniSOG flavoprotein (public)" },
  { id: "fbfp", name: "FbFP (FMN-based fluorescent protein)", family: "redox_flavoprotein", keywords: ["FMN", "flavin", "fluorescent", "oxygen-independent", "redox"], publicRef: "Drepper et al. 2007 FbFP (public)" },
  { id: "bluf", name: "BLUF domain photoreceptor", family: "LOV_flavin", keywords: ["BLUF", "FAD", "flavin", "blue light", "photocycle"], publicRef: "BLUF blue-light photoreceptor (public)" },
  { id: "cry", name: "Cryptochrome (CRY) photolyase-like", family: "cryptochrome_FAD", keywords: ["cryptochrome", "FAD", "radical pair", "tryptophan chain", "magnetic", "blue light"], publicRef: "cryptochrome/FAD photoreceptor (public)" },
  { id: "egfp", name: "EGFP (enhanced green fluorescent protein)", family: "fluorescent_protein", keywords: ["GFP", "chromophore", "fluorescent", "triplet", "blinking", "green"], publicRef: "EGFP (public)" },
  { id: "mscarlet", name: "mScarlet (red fluorescent protein)", family: "RFP_plus_flavin", keywords: ["RFP", "red fluorescent", "chromophore", "bright"], publicRef: "mScarlet RFP (public)" },
  { id: "eyfp", name: "EYFP (yellow fluorescent protein)", family: "fluorescent_protein", keywords: ["YFP", "fluorescent", "chromophore", "triplet", "yellow"], publicRef: "EYFP (public)" },
  { id: "dronpa", name: "Dronpa (photoswitchable FP)", family: "fluorescent_protein", keywords: ["photoswitch", "dark state", "fluorescent", "blinking", "triplet"], publicRef: "Dronpa photoswitchable FP (public)" },
  { id: "flavodoxin", name: "Flavodoxin (redox flavoprotein)", family: "redox_flavoprotein", keywords: ["FMN", "flavin", "redox", "electron transfer", "electrochemical"], publicRef: "flavodoxin (public)" },
  { id: "phot", name: "Phototropin (phot1/phot2)", family: "LOV_flavin", keywords: ["LOV", "FMN", "kinase", "blue light", "photocycle", "flavin"], publicRef: "phototropin (public)" },
];

const DIM = 256;

/** Extract lowercased character trigrams from a string. */
function trigrams(text: string): string[] {
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const out: string[] = [];
  for (let i = 0; i < s.length - 2; i++) out.push(s.slice(i, i + 3));
  return out;
}

/** Stable FNV-1a hash into [0, DIM). */
function hashDim(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DIM;
}

/** Deterministic L2-normalized hashed-trigram embedding. */
export function embed(text: string): Float64Array {
  const v = new Float64Array(DIM);
  for (const t of trigrams(text)) v[hashDim(t)] += 1;
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i] * b[i];
  return dot; // both normalized
}

function entryText(e: CorpusEntry): string {
  return `${e.name} ${e.family} ${e.keywords.join(" ")}`;
}

// Precompute corpus embeddings once (deterministic).
const CORPUS_VECTORS: Array<{ entry: CorpusEntry; vec: Float64Array }> =
  PUBLIC_CORPUS.map((entry) => ({ entry, vec: embed(entryText(entry)) }));

const fuse = new Fuse(PUBLIC_CORPUS, {
  keys: ["name", "family", "keywords"],
  includeScore: true,
  threshold: 0.6,
  ignoreLocation: true,
});

const COSINE_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/**
 * Hybrid vector + keyword analog search over the public corpus.
 * Deterministic for a fixed query.
 */
export function vectorAnalogSearch(query: string, limit = 5): CorpusHit[] {
  const q = embed(query);

  const keywordScore = new Map<string, number>();
  for (const r of fuse.search(query)) {
    keywordScore.set(r.item.id, 1 - (r.score ?? 1));
  }

  const hits: CorpusHit[] = CORPUS_VECTORS.map(({ entry, vec }) => {
    const cos = Math.max(0, cosine(q, vec));
    const kw = keywordScore.get(entry.id) ?? 0;
    const score = COSINE_WEIGHT * cos + KEYWORD_WEIGHT * kw;
    return {
      id: entry.id,
      name: entry.name,
      family: entry.family,
      score: Math.round(score * 1000) / 1000,
      cosine: Math.round(cos * 1000) / 1000,
      keyword: Math.round(kw * 1000) / 1000,
      publicRef: entry.publicRef,
    };
  });

  hits.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)));
  return hits.slice(0, limit);
}
