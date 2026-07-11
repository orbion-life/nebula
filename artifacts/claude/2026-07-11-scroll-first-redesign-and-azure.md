# Scroll-first cinematic redesign + Azure deploy (verified)

**Date:** 2026-07-11 · **Branch:** `claude/live-protein-discovery`
**Commits:** `fe57642` (P0) · `d9779fb` (P1) · `28a9dc1` (P2) · `fd2664f` (P3) · `bdcdcdb` (P4).
Plan: `~/.claude/plans/serialized-questing-stardust.md` (approved).

Re-presented the working discovery tool as a fully scroll-first cinematic experience in
the spirit of quantumstretch.com, and made it deployable to Azure. Same product, same
honest science; new skin + a container deploy. User directions honoured: fully
scroll-first · progressive-disclosure honesty · real-data WebGL (+ curated stills
deferred) · navy+gold · ambient audio · %-counter preloader · Lenis smooth-scroll.

## What shipped, by phase
- **P0 — Palette.** `render/palette.ts` as the single source of navy+gold across CSS and
  WebGL (universe, traces, 3Dmol, e2e BG). Values-only; no class churn.
- **P1 — Feel cues.** Lenis smooth-scroll (GSAP-ticker wired, reduced-motion off), the
  signature gold-ring 0→100 preloader ("entering the quantum within", honestly gated),
  and a PROCEDURAL Web-Audio ambient drone (no audio file; muted by default; gesture-gated).
- **P2 — Acts (run drives the scroll).** `CinematicShell` maps the state machine to
  Act I Objective → Act II Search (the ring counter bound to the REAL RunEvent.progress,
  tweened; universe streams; self-advancing) → **Act III Result = the scroll-scrubbed
  narrative, the default landing**. The calm Workspace is the expert surface behind a
  header toggle. `useRunScroll` keeps scroll sane across Acts.
- **P3 — Rendering.** Selective bloom (rides the emissive gold nodes) + vignette via
  `@react-three/postprocessing@^2.19`, and a data-driven navy→gold `QuantumField` shader
  (uProgress = real run fraction) — both inside the existing universe canvas (≤2 GL
  contexts). Bloom disabled on software-GL/reduced-motion/mobile so the non-blank
  guarantee holds. Curated real-PDB stills deferred (live 3Dmol + universe already are
  the real-data graphics).
- **P4 — Azure.** One multi-stage `Dockerfile` (node build → python serves `dist/` +
  `/api`, no pyscf), FastAPI static-SPA fallback + env-driven CORS, `.github/workflows/
  deploy.yml` (OIDC → ACR → Container Apps). `Dockerfile.physics` adds live QM.

## Honesty preserved (progressive disclosure)
Every boundary intact: the MARY trace stays a labelled reference; the computed-spin
caveat + humanized claim ceiling travel through; evidence/frontier lanes stay separate;
abstention is a first-class ending; the persistent footer + firewall/leak tests are
untouched and green.

## Verification (each phase gated)
- vitest 98 · backend pytest 43 (+ new test_deploy: SPA fallback + env CORS) · Playwright
  12/12 across chrome (real GPU, bloom) + chromium-swiftshader (software GL, no bloom) —
  real accession, candidate-specific QM, non-blank universe + 3Dmol, reduced-motion,
  keyboard, audio-muted-by-default, zero horizontal overflow at 390/768/1280/1920.
- `tsc` + vite build clean · full `npm audit` 0.
- Captured: gold-ring preloader; Act I objective hero; Act II ring-counter descent;
  Act III narrative; glowing bloom universe + quantum field.
- Azure runtime verified WITHOUT Docker (daemon unavailable here) by running the image's
  exact uvicorn command locally with NEBULA_STATIC_DIR: `/` serves the SPA, deep links →
  index.html, `/api/health` JSON, hashed assets serve, unknown `/api` → 404.

## What the user must do for Azure (assistant can't create cloud resources/credentials)
Own a subscription; `az` create RG + ACR + Container Apps env; Entra app + GitHub-OIDC
federated credential (AcrPush + Contributor); set repo secrets AZURE_CLIENT_ID/
TENANT_ID/SUBSCRIPTION_ID + vars ACR_NAME/RESOURCE_GROUP/CONTAINER_APP_NAME/ENV; run the
workflow. Keep min=max=1 replica (local SQLite store; `_find_dossier` scans it).

## Deferred (honest)
Curated offline-rendered PDB stills; extending CI to run pytest + Playwright + a docker
build; raising the ACA ingress timeout for a fully-cold 165s uncached QM (mitigated by
the committed QM cache + SSE→poll fallback).
