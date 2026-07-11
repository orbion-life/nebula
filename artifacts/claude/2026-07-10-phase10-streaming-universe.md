# Phase 10 — Streaming "search the universe" beat (verified)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery` · **Commit:** `edde241`.

Turns the run phase into the brief's "search the protein universe" chapter: real
accessions stream into the 3D universe as they are retrieved, sit as a pending cloud
during ranking, then reorganize into evidence/frontier lane columns on completion.

## Backend — incremental retrieval

- `assemble_candidates(..., on_candidate=cb)`: `cb` fires per candidate as it is built.
- Orchestrator streams each accession into the run + store during `retrieving_evidence`,
  with a `retrieved <accession> (<route>)` event, instead of one atomic batch. Final
  results are unchanged (offline determinism test still green).

## Frontend

- `CandidateUniverse`: a `pending` lane (loose spherical cloud) the nodes fly out of into
  the lane columns once ranking lands; scale-in entrance so each arriving node pops in
  (reduced-motion snaps).
- `UniverseHero`: `buildNodes(run, settled)`; until settled every candidate is pending;
  legend reads "searching the protein universe — N retrieved".
- `DiscoverApp`: mounts the universe in the running phase and polls full run state during
  the run (SSE carries only stage events, not the growing candidate list).

## Verified

- Live cold run captured mid-retrieval: universe shows the pending cloud filling as real
  accessions arrive (Q16526, Q49AN0), stage tracker on "search protein universe", run card
  narrating "retrieved Q49AN0 (cryptochrome_FAD_radical_pair)".
- On completion the same field reorganizes into lane columns (workspace universe).
- TS 98 · backend 42 · Playwright 8/8 (chrome + swiftshader) · build clean · audit 0.

## Still open (honest)

- The pinned, scroll-scrubbed multi-chapter GSAP/ScrollTrigger narrative (the universe now
  streams + reorganizes, and one GSAP reveal exists; the full scroll story does not).
- In-workspace instrument re-simulation; UI design adapters; `_find_dossier` indexing.
