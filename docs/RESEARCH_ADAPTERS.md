# Research Adapters

Each research tool is an **optional adapter** under `src/adapters/`. Adapters are
never required by the core demo. When not configured, an adapter returns an
`AdapterResult` with `available: false` and a safe demo fixture fallback.

## Adapter contract

See [`src/adapters/types.ts`](../src/adapters/types.ts):

```ts
interface AdapterResult<T> {
  adapter: string;
  available: boolean;           // false in the Sunday-safe default
  status: "unavailable" | "fixture_fallback" | "ran";
  wouldDo: string;              // what a configured adapter would do
  requiredSetup: string;        // what you must install/configure
  claimBoundary: string;        // the claim it is/ isn't allowed to make
  fixtureFallback: T;           // safe demo output used offline
  note: string;
}
```

Configure via an `AdapterConfig` (`{ enabled, endpoint, binaryPath }`). Absent
config → graceful fallback. The public repo intentionally does not wire live
network/subprocess calls.

## Adapters

| File | Adapter | Layer | Fallback |
| --- | --- | --- | --- |
| `publicData/uniprot.ts` | UniProt API | public_data | demo record (not fetched) |
| `publicData/rcsb.ts` | RCSB PDB | public_data | demo record |
| `publicData/alphafold.ts` | AlphaFold DB | public_data | demo record (geometry only) |
| `publicData/fpbase.ts` | FPbase | public_data | demo record |
| `retrieval/esm.ts` | ESM-2 / ESM-C | retrieval | deterministic hybrid vector index (`analogIndex.ts`) |
| `retrieval/faiss.ts` | FAISS / hnswlib | retrieval | deterministic hybrid vector index (`analogIndex.ts`) |
| `physics/radicalpy.ts` | RadicalPy | physics | deterministic TS radical-pair proxy |
| `physics/qutip.ts` | QuTiP | physics | deterministic TS triplet proxy |
| `physics/pyscf.ts` | PySCF | physics | documented assumptions (no compute) |
| `design/rfdiffusion.ts` | RFdiffusion | design_adapter | `PUBLIC-DEMO-STUB` backbone |
| `design/ligandmpnn.ts` | LigandMPNN | design_adapter | `PUBLIC-DEMO-STUB` sequence |
| `design/proteinmpnn.ts` | ProteinMPNN | design_adapter | `PUBLIC-DEMO-STUB` sequence |
| `design/boltz.ts` | Boltz | design_adapter | `PUBLIC-DEMO-STUB` structure check |

## Claim boundaries per layer

- **public_data** — retrieval of public records only. An annotation, structure,
  or spectrum informs a hypothesis; it is never a sensing claim. A **predicted**
  structure (AlphaFold) informs geometry only and does not determine spin response.
- **retrieval** — embeddings/indices perform **public analog search only**. They
  never predict spin, magnetic, or sensing properties. `Analog != prediction`.
- **physics** — outputs are **synthetic assumption sweeps** unless explicitly
  anchored to real measured data. A configured RadicalPy/QuTiP run is still a
  simulation under stated assumptions, not experimental validation.
- **design_adapter** — outputs are **public demo handoffs**. Never a private
  mutation list, never an orderable/ready-to-test sequence, never an Orbion
  candidate, never a validated sensor.

## Live wiring (implemented, opt-in)

Three adapters have **real** live paths that run when configured and degrade
gracefully otherwise:

- `esmAnalogSearchLive(query, { enabled, endpoint })` — real HTTP `POST` to an
  ESM embedding service; on any failure falls back to the offline vector index.
- `faissSearchLive(query, { enabled, endpoint })` — real HTTP `POST` to a
  FAISS/hnswlib service; falls back to the offline vector index.
- `radicalPyRunLive(params, { enabled, binaryPath })` — real Node subprocess
  spawn of a Python RadicalPy runner (Node only; browser / non-Node falls back to
  the deterministic proxy).

The offline default for retrieval is a **real deterministic vector index**
(`src/core/analogIndex.ts`): hashed-trigram embeddings + cosine kNN over a curated
public corpus, blended with a Fuse.js keyword score. It is a genuine embedding
index, not keyword-only search — the FAISS/hnswlib adapters are the scale-out
production path.

The photokinetic proxy is cross-checked against an in-repo RK4 integrator
(`src/core/ode.ts`, always-on test) and an optional scipy reference
(`scripts/solve_ivp_crosscheck.py`).

## How to enable one (locally, not in the demo path)

```ts
import { esmAnalogSearch } from "./src/adapters/retrieval/esm";

// Unconfigured → Fuse.js fallback:
const offline = esmAnalogSearch("blue-light flavin sensor");

// Configured (you provide the service; live call is intentionally not wired here):
const configured = esmAnalogSearch("blue-light flavin sensor", {
  enabled: true,
  endpoint: "http://localhost:8000/embed",
});
```

Python-side optional dependencies are listed in
[`requirements-research.txt`](../requirements-research.txt) (all commented /
optional; nothing there is needed for `npm test` or `npm run build`).
