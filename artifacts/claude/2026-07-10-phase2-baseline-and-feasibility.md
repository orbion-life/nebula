# Phase 2 — verified baseline + environment feasibility

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery` (off `master` @ `91a128d`)
**Verified directly** (not assumed) by running the commands/probes below.

## Baseline (before any Phase 2 change)

- `git status` clean on the new branch.
- `npx vitest run` → **89 tests pass** (18 files).
- `npm run build` → `tsc --noEmit` + `vite build` clean.
- `npm audit --omit=dev` → **0 vulnerabilities** (production).
- Full `npm audit` → 5 (3 moderate, 1 high, 1 critical) — all in the **dev-only**
  vite/vitest/esbuild chain. Prompt §3.8 requires patching Vite/Vitest → **Phase 8**.

## Feasibility — probed live (2026-07-10)

**Public providers — ALL reachable from a shell process:**

| Provider | Result |
|---|---|
| UniProt REST (`rest.uniprot.org`) | OK, 0.2 s, real accession returned |
| InterPro (`ebi.ac.uk/interpro/api`) | OK 200 |
| RCSB data + search (`data.rcsb.org`, `search.rcsb.org`) | OK 200 |
| AlphaFold DB (`alphafold.ebi.ac.uk/api`) | OK 200 |
| FPbase (`fpbase.org/api`) | OK 200 (1.1 s) |

→ **Real retrieval is feasible**; providers must still ship with recorded real
fixtures + explicit offline mode + provenance (prompt §6).

**Python libraries present:** fastapi, pydantic (v2), httpx, tenacity, uvicorn,
sqlite3, numpy, scipy, **radicalpy**, **pyscf**, Biopython (`Bio`), gemmi, rdkit,
**torch**, **esm**, scikit-learn, matplotlib.

**Absent → substitutions (design decisions):**

| Wanted | Absent | Substitute (no capability loss for the demo) |
|---|---|---|
| DuckDB | ✗ | **SQLite** artifact/cache store |
| QuTiP | ✗ | **RadicalPy + SciPy** spin dynamics (already validated this repo) |
| FAISS | ✗ | **scikit-learn / torch** exact NN over ESM-2 embeddings (small index) |
| biotite | ✗ | **gemmi + Biopython** structure/cofactor parsing |
| OpenMM | ✗ | geometry sanity via **gemmi/NumPy** only; no MD/energies claimed |
| Foldseek | ✗ | structural search out of scope; **MMseqs2** (present) for sequence |

**Binaries:** `mmseqs` ✓ (`/opt/homebrew/bin`), `docker` ✓, `foldseek` ✗.

**Heavy-model note:** ESM-2 weights download on first use (network ok); default to a
small ESM-2 variant and cache, or degrade to MMseqs2-only retrieval when weights
are unavailable. PySCF clusters must be kept small (few heavy atoms) to stay
laptop-runnable; record method/basis/convergence/timeouts.

## Architecture decisions locked from feasibility

1. Python **FastAPI** discovery service under `services/discovery-api/` (heavy bio/
   quantum stays out of the browser bundle) + generated TS contracts.
2. **SQLite** content-addressed run/artifact store; immutable runs keyed by
   objective + provider versions + config + seed.
3. Real providers with `tenacity` retry/backoff, on-disk cache, recorded real
   fixtures, and explicit `unavailable` states + full provenance.
4. Candidate-specific physics: PySCF (open-shell cluster parameterization) →
   RadicalPy/SciPy (spin dynamics). Fixed proxy amplitudes removed from ranking.
5. Retrieval: mechanism-route query plans → UniProt (reviewed first); MMseqs2 +
   ESM-2/sklearn-NN for similarity expansion (opt-in).

## Honest scope statement

The environment genuinely supports live retrieval and candidate-specific physics,
so this is not a fixture-only concept demo. But the full §14 program (service +
generated contracts + cinematic R3F/GSAP/Mol* UI + full Playwright visual-
regression at 4 viewports + all §15 tests) is large; it is built and committed
**phase by phase, each verified green**, and progress/limitations are reported
honestly. Computation is not experimental validation — outputs are ranked
**unvalidated public-protein candidate hypotheses**.
