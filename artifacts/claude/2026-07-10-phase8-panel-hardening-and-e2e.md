# Phase 8 — Expert-panel hardening + Playwright E2E (verified)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`
**Commits:** `f054f03` (offline index), `70f7b28` (panel hardening), `5957a6f` (E2E).

An adversarial expert panel (5 lenses + chair, run as a background workflow: scientific
skeptic, claim-boundary/IP, code quality, verification strategy, visual system) reviewed
the backend-connected UI. Every finding below was **verified directly in the code** before
acting (per the standing rule — subagent claims are not trusted on their word).

## Findings fixed (all verified real, then fixed)

Scientific integrity:
- **Fabricated proxy amplitudes** (`scoring.py` `_PROXY_SIGNATURE` 0.016/0.35/0.45, no
  provenance, yet drove frontier IG magnitude) → removed; proxy routes now get a coarse
  binary observability gate. The only magnitude-bearing signal is the provenance-tagged
  radical-pair artifact. Guard test: two proxy routes get identical M; `_PROXY_SIGNATURE`
  no longer exists.
- **+0.08 plausibility bump for converged QM** → removed. Convergence of a truncated
  single-point UHF is parameterizability, not evidence of a functional radical pair. Guard
  test: candidate-specific QM leaves P unchanged.

Claim boundary:
- Shipped export was unguarded by the claim firewall (only the retired src/core export was).
  Extracted `dossierExport.ts`; added a boundary test running it through
  `exportAffirmativeViolations` + the leak scan (worst case: computed spin +
  `partner_ready_dossier`). Export QM line now carries the "high uncertainty · NOT a
  performance/response prediction" caveat; `claim_ceiling` humanized (never the raw token).

UI correctness/honesty:
- Cancel/failed navigation dead-end → reset control on any terminal state.
- MARY reference trace gated to spin-dynamics-eligible candidates (no radical-pair curve on
  redox/proxy routes).
- Exploratory-only banner when evidence lane empty; N/U render as neutral markers, not
  growth bars; candidate computed spin added as a Tufte small-multiple interval.
- WebGL context released on StructureViewer teardown; offline auto-seeds curated accessions
  (no default abstention); `--d-faint` lightened to WCAG AA.

Backend/offline:
- Idempotency no longer caches failed/cancelled runs. QM cache: `use_cache=False` no longer
  persists (stale-entry churn fixed); key includes the worker hash; stale 5DKL entry removed.
- Offline index records coords for every demo candidate's best structure. Tests pin the QM
  cache key to the committed `coords_1N9O.cif` and assert offline-run determinism.

## Verification (Playwright — closes the gap the in-app browser couldn't)

The in-app browser extension dropped mid-session, so live re-capture there was impossible.
Playwright drives its own browsers against the offline backend instead:
- Two projects: **chrome** (channel, real GPU) + **chromium-swiftshader** (software WebGL,
  the GPU-less CI case).
- `e2e/discovery.spec.ts` (8/8 pass in both projects): offline run → **real accession
  Q8LPD9** → candidate-specific-QM badge → **NON-BLANK 3Dmol canvas** (pixel-threshold vs
  the 0x0b0f17 background) → zero horizontal overflow at 390/768/1280/1920 → completes under
  prefers-reduced-motion → keyboard-operable → no unvalidated-sensor copy.
- Captured the live workspace: 1N9O structure with FMN highlighted; candidate-specific QM
  (spin 1.0706, converged); reference MARY + the candidate-spin small-multiple; humanized
  claim ceiling; falsification plan.

## Gates (committed state)

TS 98 tests (20 files) · backend 41 tests · Playwright 8/8 (×2 projects) · `tsc` + vite
build clean · full `npm audit` 0 · boundary/leak scan clean.

## Not done (honest)

- Full orbyt-grade GSAP/R3F scroll-scrubbed cinematic scenes (motion remains CSS-level +
  spatial candidate field, reduced-motion safe).
- In-workspace instrument re-simulation (instrument is a pre-run constraint today).
- Design adapters (RFdiffusion/LigandMPNN/ProteinMPNN) surfaced in the UI.
- `_find_dossier` is an O(N) scan (fine at demo scale; noted for indexing later).
