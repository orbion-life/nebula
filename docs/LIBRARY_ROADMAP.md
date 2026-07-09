# Library Roadmap

Nebula Discover keeps a **small, fast, deterministic core** and represents heavy
research tools as **optional adapters**. The structured source of truth is
[`src/core/libraryRegistry.ts`](../src/core/libraryRegistry.ts); this document is
the narrative version.

## Two layers

### 1. Sunday-safe core (runs on a normal laptop)

| Library | Status | Role |
| --- | --- | --- |
| Vite, React, TypeScript | installed | app + build + type-level claim safety |
| zod | installed | runtime validation at the pipeline boundary |
| Fuse.js | installed | offline fuzzy **public analog search** (retrieval fallback) |
| Deterministic TS math / ODE | installed | seeded PRNG + mechanism-shaped proxy traces |
| d3 / visx / recharts | documented future | richer charts (we currently hand-roll Tufte-style SVG to stay dependency-light) |
| 3Dmol.js | documented future | in-browser public structure viewer |
| SQLite | documented future | optional local caching of public fixtures |

The core demo does **not** import any research adapter. `npm test` and
`npm run build` never require Python, a GPU, or network access.

### 2. Research adapters (optional)

Grouped by layer. Each has a hook file under `src/adapters/` that fails
gracefully to a safe demo fixture when not configured.

- **public_data** — UniProt, RCSB PDB, AlphaFold DB, FPbase (adapters);
  Biopython, gemmi, biotite, RDKit (documented future, server-side parsing/chem).
- **retrieval** — ESM-2 / ESM-C embeddings, FAISS (adapters); hnswlib,
  sentence-transformers (documented future). Used for **public analog search only**.
- **physics** — RadicalPy, QuTiP, PySCF (adapters); scipy.solve_ivp, JAX, NumPyro
  (documented future). Would replace the deterministic proxy with real dynamics.
- **design_adapter** — RFdiffusion, LigandMPNN, ProteinMPNN, Boltz (adapters).
  Downstream design **handoffs**, not the discovery engine.

## What runs in the current demo

Objective compile → public evidence (with real citations) → construct hypotheses
→ mechanism route → deterministic physics proxy → multimodal synthetic traces →
measurement-worthiness ranking → measurement handoff export. All offline,
deterministic for a fixed seed.

## What is implemented now (beyond stubs)

- **Real deterministic vector index** for public analog search
  (`src/core/analogIndex.ts`): hashed-trigram embeddings + cosine kNN over a
  curated public corpus, blended with Fuse.js keyword scores.
- **Live adapter wiring** (opt-in, graceful): `esmAnalogSearchLive`,
  `faissSearchLive` (real HTTP), `radicalPyRunLive` (real Node subprocess).
- **ODE cross-check**: `src/core/ode.ts` RK4 integrator validates the photokinetic
  proxy (always-on test); `scripts/solve_ivp_crosscheck.py` is the optional scipy
  reference.
- **visx** charts and an opt-in **3Dmol.js** public-structure viewer (lazy-loaded).

## What is stubbed / precomputed

- Design adapters return `PUBLIC-DEMO-STUB` artifacts (never real sequences).
- Retrieval adapters fall back to the deterministic vector index when no live
  embedding service is configured.
- Physics adapters fall back to the deterministic TS proxy when no live simulator
  is configured.

## What requires external installation / GPU

- ESM / ESMFold, FAISS at scale, RadicalPy / QuTiP / PySCF (Python), and all
  design models (RFdiffusion / LigandMPNN / ProteinMPNN / Boltz) — GPU
  recommended. See `requirements-research.txt` (optional, commented).

## Deliberately out of scope for the Sunday demo

- Any live GPU model run in the critical demo path.
- Any private ranking, calibration, partner data, or wet-lab feedback.
- Any claim that embeddings, structure prediction, or design output determine
  spin/magnetic response or that a construct is a validated sensor.

## Why embeddings are analog search, not spin prediction

Protein language models capture sequence/evolutionary statistics. They are useful
to find **public analogs** ("what known public scaffolds resemble this query?")
for measurement triage. They do **not** encode the spin physics that governs a
magnetic/RF response, so Discover never uses them to predict spin behaviour.

## Why RFdiffusion / LigandMPNN / ProteinMPNN are handoffs, not the engine

Discover's job is to decide **what deserves measurement first** and to produce a
public construct hypothesis. Design models come *after* that decision, to explore
how a hypothesis *could* be built. Treating them as the engine would imply the
generated artifact is a validated sensor — which it is not.
