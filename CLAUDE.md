# CLAUDE.md — operating guide for Nebula Discover

Nebula Discover is a **public, open-source counterfactual measurement studio**.
Given a public protein scaffold, a sensing objective, an environment, and an
instrument, it answers: *which mechanism and measurement should we test next, and
what result would falsify it?* It does **not** discover sensors, validate
sensors, or predict magnetic/RF response for arbitrary proteins.

## Architecture (authoritative)

Pipeline (`src/core/`), simulation happens **before** ranking:

```
RawObjective
  → ObjectiveInput            objectiveCompiler.ts  (+ Zod: schema.ts; invalid input throws)
  → EvidenceBundle            evidenceBundle.ts     (public cards + benchmarks + analogs)
  → ConstructHypothesis[]     constructGenerator.ts
  → MechanismRoute[]          fixtures/routes.ts, mechanismRouter.ts
  → ParameterEnsemble[]       parameterEnsemble.ts
  → SimulationEvidence[]      simulationEvidence.ts (EVERY candidate, under an InstrumentProfile)
  → ExperimentScore[]         experimentScore.ts    (8 transparent components, NO offset)
  → MeasurementPlan           measurementPlan.ts    (the decisive next experiment)
  → BenchmarkComparison[]     benchmark.ts          (retrospective, qualitative)
  → claim audit               claimFirewall.ts
  → handoff export            export.ts
```

- **Physics:** the radical-pair route is real spin dynamics. `scripts/physics/
  radical_pair_mary.py` (RadicalPy) computes a Zeeman + hyperfine + Haberkorn +
  relaxation MARY curve, an uncertainty ensemble, counterfactual controls, and an
  eigenspectrum-derived RF response, and writes a versioned, content-hashed,
  provenance-tagged artifact to `src/data/generated/radical_pair_mary.v1.json`.
  The TS app consumes it only after Zod validation (`src/core/generated/
  radicalPair.ts`). Heavy Python stays offline; `npm test`/`npm run build` never
  touch it.
- **Ranking:** `experimentScore.ts` ranks the *next experiment* by expected
  information gain, observability/SNR, instrument compatibility, mechanism
  discrimination, uncertainty reduction, control completeness, minus execution
  burden and nuisance risk. Weights are open; there is **no display offset** and
  no predicted sensor performance. (The old heuristic `ranking.ts` is deleted.)
- **UI:** four cinematic screens in `src/ui/screens/` — Ask, Explain, Simulate,
  Measure next — over a small state machine in `src/ui/App.tsx`. There is no
  section-numbered dashboard, no architecture board, no library registry, no
  swarm panel, and no 3D viewer in the primary journey. Provenance and technical
  detail live in progressive disclosure. Charts are Tufte-style
  (`src/ui/components/`).
- **Swarm** (`src/core/swarm/`, note: a directory, not `swarm.ts`): a
  **deterministic in-code release audit** that runs on every result as a CI gate.
  It is NOT a product feature and NOT "live Claude agents" — never describe its
  synchronous checks that way. It is surfaced only in progressive disclosure.

## Scientific boundaries (hard rules)

- Never claim a validated sensor, sensor discovery, or magnetic/RF response
  prediction for an arbitrary protein. Never claim sequence/AlphaFold/ESM
  determine spin response.
- Every simulated trace is a *synthetic assumption sweep*, labelled as such and
  distinguished from *public/measured* (qualitative only) and *assumption-derived*.
- Every numeric parameter carries provenance: source type, citation/assumption,
  range, unit, uncertainty, applicability limits (`ParameterProvenance`).
- No private Orbion/Nebula/Astra data, no partner data, no mutation lists, no
  orderable sequences. See `IP_BOUNDARY.md`; enforced by `tests/boundary.test.ts`.

## Source-of-truth files

- Contracts: `src/core/types.ts` (authoritative schema).
- Route registry: `src/core/fixtures/routes.ts`. Evidence: `fixtures/evidenceCards.ts`.
  Instruments: `fixtures/instruments.ts`. Benchmarks: `benchmark.ts`.
- Generated physics: `src/data/generated/radical_pair_mary.v1.json` (+ its generator).
- Claude review artifacts: `artifacts/claude/` (dated decisions + verification).

## Live discovery service (primary journey)

The shipped app is a **real public-protein discovery application**: a FastAPI
service under `backend/` (retrieve → enrich → physics-eligibility gate → simulate
→ two-lane rank → plan) with a React front end under `src/ui/discover/` that
drives it over generated OpenAPI contracts (`src/contracts/api.ts`). Normal runs
return **real UniProt accessions** (not template families), stream stages over
SSE, are cancellable, and are content-addressed/reproducible by fingerprint. One
route (flavin radical-pair) runs **candidate-specific quantum chemistry** on the
protein's real cofactor coordinates (PySCF UHF, subprocess-isolated). The legacy
in-browser `src/core` pipeline is retained only as the offline vitest smoke
fixture; it no longer powers the shipped UI. `3Dmol.js` is the shipped structure
viewer (the Mol* target's stand-in). Outputs are **unvalidated public-protein
candidate hypotheses** — computation is not validation.

## Commands

```bash
npm install
# --- run the app (two servers) ---
(cd backend && python3 -m uvicorn app.api.main:app --port 8000)   # discovery API (NEBULA_OFFLINE=1 for fixtures)
npm run dev             # React app on :5173, proxies /api → :8000
# --- verify ---
npm test                # TS: deterministic + boundary + client + acceptance (vitest)
npm run build           # tsc --noEmit + vite build
npm audit               # FULL audit must be 0 high/critical (currently 0 total)
npm run gen:contracts   # regenerate src/contracts/api.ts from the FastAPI OpenAPI
(cd backend && python3 -m pytest)   # backend: providers, endpoints, physics, discovery
python3 scripts/physics/radical_pair_mary.py   # OPTIONAL: regenerate the reference artifact
```

## Verification requirements (do not weaken to get a pass)

Before committing a change, `npm test` and `npm run build` must pass, and:
physics/instrument changes must still move the ranking; ≥1 public benchmark has a
reproducible comparison; every trace distinguishes public vs simulation vs
assumption; every numeric parameter has provenance; the same seed yields
identical results; invalid objectives surface Zod errors; the boundary scan is
clean; mobile has zero horizontal overflow; the app works without optional
adapters; the downloaded handoff matches the selected result.

## Agent workflow

Specialist agents in `.claude/agents/` are used in **five review groups**, not as
a product feature: **evidence** (evidence-citation, construct anchors),
**physics** (physics-data-simulator, mechanism-router, scientific-skeptic),
**experiment/ranking** (measurement-worthiness-ranker, rationale-explainer),
**safety** (claim-boundary-auditor, code-quality-reviewer), **product/demo**
(visual-system-director, demo-director). After a phase, the relevant group
reviews; any factual claim a subagent surfaces is verified directly before it is
relayed or acted on; the verified decision is recorded under `artifacts/claude/`.
Do not add agents/skills unless a demonstrated capability is missing, and do not
market agent/skill counts as the product's scientific value.
