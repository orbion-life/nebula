# Phase 8 (start) — Verified baseline + dependency security

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`

Re-entry audit before the end-to-end frontend build. Everything below was run and
read directly by me, not relayed from a subagent.

## Verified baseline (before this phase)

- `git status --short`: clean; HEAD `ac2f021` (Phase 4).
- Backend: FastAPI app imports; routes present: `/api/health`, `/api/routes`,
  `/api/instruments`, `POST /api/objectives/compile`, `POST /api/runs`,
  `GET /api/runs/{id}`, `/events` (real SSE), `/events.json`, `/cancel`.
  Missing vs prompt §4: `GET /api/candidates/{id}` + `/structure` + `/dossier`.
- Backend suite: 33 passing. TS suite: 89 passing. `npm run build`: clean.
- **Central gap (verified):** the React app's `App.tsx` runs the *old in-browser*
  `runDiscover` (template `constructGenerator`), NOT the Python backend. The
  generated contracts (`src/contracts/api.ts`) exist but nothing consumes them.
  So the live app still returns scaffold families, not real accessions — exactly
  what definition-of-done #1 forbids. This is the primary target of this build.

## Dependency security (§3.8, §15: no high/critical)

- Full `npm audit` before: `{moderate:3, high:1, critical:1}` — all dev-only
  (esbuild → vite → vitest chain). Prod-only audit was already 0.
- Upgraded: `vite ^5.4.11 → ^7`, `vitest ^2.1.8 → ^3`,
  `@vitejs/plugin-react ^4.3.4 → ^5`. Node 22.20; inline vitest config in
  `vite.config.ts` unchanged and still honored.
- Full `npm audit` after: **0 / 0 / 0 / 0 / 0**.
- `npm test`: 89 passing. `npm run build`: clean. No code changes required.

## Plan for the remainder (implementing, not just planning)

1. Backend candidate/structure/dossier endpoints + candidate index (+ tests).
2. Launch config + Vite dev proxy so both servers run under the preview tools.
3. Typed frontend API client over the generated contracts (compile, run, SSE,
   cancel, dossier, structure, health).
4. Objective interface: novice free-text + expert structured controls → one
   editable ObjectiveSpec sheet before the run.
5. Run experience: explicit submit, run id, streamed stages, cancel; results
   workspace with real accessions, Mol* structure, Tufte traces + uncertainty,
   measurement plan + falsifier, downloadable dossier.
6. Motion/scene layer (GSAP + R3F), reduced-motion safe.
7. Wire `App.tsx` to the backend; keep the old pipeline only as an offline smoke
   fixture. Live-verify in the preview browser; commit green phases.

Honest scope note: full orbyt-grade cinematic polish, the complete Playwright
visual-regression matrix, and the optional design adapters are staged; whatever
is not finished and verified this pass is reported as remaining, never claimed.
