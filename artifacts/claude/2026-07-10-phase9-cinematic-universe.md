# Phase 9 — Cinematic candidate universe + store fix (verified)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`
**Commits:** `bbc7428` (store fix), `28489b0` (cinematic layer).

The panel's deferred item — the orbyt-grade cinematic layer — built as a **data-driven**
3D scene (not decoration), plus a latent backend bug the E2E surfaced.

## Candidate universe (R3F / three / drei, lazy-loaded)

- `universe/CandidateUniverse.tsx`: each node is a retrieved protein. Lane
  (evidence/frontier/excluded) selects its column, rank sets height, score sets size,
  candidate-specific QM adds an amber ring. On mount nodes reorganize from a cloud into
  the lane columns — a literal picture of the ranking (the brief's "physically reorder").
  Clicking a node selects it (syncs the rail); the selected node lifts toward the camera
  with a floating accession label. DPR capped [1,1.5], auto-rotate only when motion is
  allowed, render paused when the tab is hidden, GL disposed on unmount.
- `universe/UniverseHero.tsx`: lazy-loads the heavy three/drei chunk (269 kB gzip, out of
  the 177 kB initial bundle); an error boundary falls back to an accessible DOM node-list
  if WebGL is unavailable; respects `prefers-reduced-motion`.
- `ObjectivePanel`: GSAP (`@gsap/react` `useGSAP`) resolves the compiled constraints into
  place on parse — purposeful, and skipped under reduced-motion (`gsap.from` leaves
  content visible if interrupted).

Honesty preserved: the universe encodes lane/rank/score only — no fabricated magnitude,
no novelty-as-quality. It is an overview + navigator, not a claim.

## Backend fix (surfaced by the E2E)

`RunStore` created the `runs` table only in `__init__`, so a deleted/rotated
`artifacts/runs.sqlite` (or a fresh process on a schemaless file) made every run 500 with
`no such table: runs` — shown as a "failed" run in the UI. Moved the idempotent CREATE
TABLE into `_connect()`; a regression test deletes the DB mid-life and asserts get/put
still work. (This is why running the E2E after `rm`-ing the DB failed — a real robustness
bug, not the new UI.)

## Verification

- 8/8 Playwright across **chrome** (real GPU) + **chromium-swiftshader** (GPU-less):
  offline run → real accession → candidate-specific QM badge → **non-blank 3Dmol canvas**
  → **universe canvas mounted + sized** → zero horizontal overflow at
  390/768/1280/1920 → reduced-motion → keyboard.
- Captured the live workspace: the 3D universe with lane columns and the gold selected
  node, above the 1N9O structure (FMN highlighted) and the reference-MARY +
  candidate-spin small-multiple.
- TS 98 · backend 42 · `tsc` + vite build clean · full `npm audit` 0.

## Still honestly open

- Full scroll-scrubbed GSAP/ScrollTrigger chapter narrative (the universe + one GSAP
  reveal are in; the pinned multi-chapter scroll story is not).
- The universe currently appears in the workspace; wiring it into the live run stream as
  the "search the universe" beat (nodes arriving over SSE) is a natural next step.
- In-workspace instrument re-simulation; UI design adapters; `_find_dossier` indexing.
