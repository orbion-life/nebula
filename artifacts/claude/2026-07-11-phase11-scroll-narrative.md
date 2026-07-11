# Phase 11 — GSAP/ScrollTrigger scroll narrative (verified)

**Date:** 2026-07-11 · **Branch:** `claude/live-protein-discovery` · **Commit:** `408f3ef`.

The last outstanding brief item (§12 cinematic chapters): a scroll-scrubbed narrative
that replays a completed run. It is **data-driven** — every chapter reads the real run,
no canned copy.

## What it is

`narrative/NarrativeReplay.tsx` — seven full-viewport chapters:
1. **Objective** — the objective text + compiled constraint chips.
2. **Search the protein universe** — count + grid of the real accessions retrieved.
3. **Mechanism routes** — the route-class mix as bars.
4. **Structure gate** — the top candidate's real 3Dmol structure (cofactor highlighted).
5. **Compute** — candidate-specific QM stat + the Tufte MARY trace (captioned "not a
   prediction").
6. **Rank** — the two lanes via the R3F universe + the P/M/D/IG rationale.
7. **Measure next** — instrument, humanized claim ceiling, falsifier, disclaimer, CTA.

GSAP `ScrollTrigger` scrubs each chapter's reveal to scroll position with a progress
rail. Reduced-motion: ScrollTrigger is not registered — the chapters render as a normal,
fully-visible tall scroll page (no motion-only meaning). Lazy-loaded (50 kB chunk incl.
ScrollTrigger), so the initial bundle is unaffected (main ~250 kB).

The **workspace stays the calm repeat-use surface** (per the brief); a "▶ discovery
story" control enters the narrative, and its final CTA returns to the workspace.

## Honesty carried through

The story cannot become an overclaim: the MARY trace is the reference caption ("not a
prediction of <accession>"), the computed-spin caveat and humanized claim ceiling travel
from `dossierExport`, abstention renders as abstention, and the top candidate's *actual*
(sometimes generic) physics is shown — not cherry-picked to the QM one.

## Verified

- E2E narrative test (both projects): workspace → "▶ discovery story" → objective chapter
  with the real objective → real-accession chapter → measure-next falsifier → back to the
  workspace. 10/10 Playwright.
- TS 98 · backend 42 · `tsc` + vite build clean · full `npm audit` 0.
- Captured chapters 01 (objective hero) and 05 (compute, Tufte MARY trace).

## Brief status

The full cinematic arc is now in: authored objective → streaming "search the universe" →
lane reorganization → structure/compute/rank/measure — available both as the live run
flow AND as the scroll-scrubbed replay, with the calm workspace for repeat use. Remaining
non-cinematic items (unchanged): in-workspace instrument re-simulation, UI design
adapters, `_find_dossier` indexing.
