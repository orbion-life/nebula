# Phase 6+7 — Real backend-connected discovery UI (verified)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`
**Commits:** `97e4a90` (security), `969ecec` (candidate/structure/dossier
endpoints), `0bb9432` (backend-connected UI).

## What changed (the central gap, closed)

Before: the React app ran the *old in-browser* template pipeline
(`constructGenerator`, scaffold families). The FastAPI backend was real but the
UI never called it. After: the app drives the discovery service and returns
**real public accessions**.

- `src/api/client.ts` — typed client over the generated OpenAPI contracts
  (compile, createRun, getRun, SSE `streamRun` + polling fallback, cancel,
  getDossier, getStructure, health). Cannot drift from the server.
- `src/ui/discover/` — ObjectivePanel (novice free-text → server-compiled,
  editable ObjectiveSpec; expert structured controls into the same spec),
  RunProgress (real SSE stages + candidate field + cancel), Workspace (two
  strictly-separate lanes; real UniProt links; 3Dmol structure viewer with
  cofactor highlight; Tufte MARY trace + ±1σ band, labelled *reference*, not a
  prediction; transparent P/M/D/N/U/IG/C rationale; why-work/why-fail;
  measurement plan + falsifier; JSON/Markdown export; provenance).
- Backend: added `GET /api/candidates/{id}` + `/dossier` + `/structure`
  (structure serves inline mmCIF for offline; prefers experimental cofactor-bound
  PDB, falls back to AlphaFold) + `RunStore.all_runs()`.
- Security: vite 5→7, vitest 2→3, plugin-react 4→5. Full `npm audit` 5 issues
  (1 critical + 1 high, dev-only) → **0**.
- `vite.config.ts` proxies `/api` → `:8000`; `main.tsx` → `DiscoverApp`. Explicit
  submit (no run on keystroke), reduced-motion safe, responsive grid.

## Verified in the live browser (screenshots captured)

- Novice compile: free text → real ObjectiveSpec `obj_…`, sensed="magnetic
  field", modality chips, `missing_information` surfaced as "needs clarification".
- Expert mode: temperature / field / RF ranges, seed accessions, unreviewed
  toggle, seed.
- Offline seeded run (Q43125): completed → workspace with **real accession
  Q43125** (Cryptochrome-1, *A. thaliana*), evidence lane P=0.62 M=0.94 D=0.71,
  empty frontier lane, UniProt link, honest "generic template physics" badge,
  Tufte MARY trace with the "synthetic assumption sweep … not a prediction of
  Q43125" caption, why-work/why-fail/confounders, measurement plan, export.

## Verified live at the data layer (backend live mode; all 5 providers reachable)

- Live run of a phototropin/LOV objective → **6 real accessions** (Q8LPD9,
  Q2QYY8, Q9ST27, O48963, Q2RBR1, P93025), completed in ~180 s.
- **Q8LPD9 candidate-specific QM = True**, max Mulliken spin 1.0706, from its real
  experimental structure.
- `GET /api/candidates/cand_Q8LPD9…/structure` → experimental PDB **1N9O**, X-ray
  2.8 Å, 149 KB inline mmCIF containing FMN — exactly what the 3Dmol viewer
  consumes. `/dossier` → `candidate_specific: True`, disclaimers present.

Honest limitation this pass: the live **pixel render** of the 3Dmol structure in
the browser was not re-captured — the browser-extension bridge dropped mid-session
after the offline screenshots. The viewer code, its data path (real inline mmCIF),
and the build are all verified; the visual render at all target viewports + the
full Playwright/visual-regression matrix remain to finish (see below).

## Gates

TS: 93 tests (19 files) incl. boundary/leak scan over the new UI + client tests.
`tsc` + `vite build` clean (3Dmol code-split, lazy). Backend: 36 tests. Full
`npm audit`: 0. Contract regen: no drift.

## Remaining (honestly not done this pass)

- Full orbyt-grade GSAP/R3F cinematic scenes (current motion is CSS-level +
  spatial candidate field, reduced-motion safe — authored but not the full
  scroll-scrubbed 3D narrative).
- Playwright E2E + visual-regression + canvas pixel checks at 390/768/1280/1920.
- Optional design adapters (RFdiffusion/LigandMPNN/ProteinMPNN) surfaced in the UI.
- Larger curated offline demo index (only Q43125 + 5DKL coords fixtured today).
