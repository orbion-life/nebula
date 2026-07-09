# Build Nebula Discover

Build or continue the end-to-end Nebula Discover app while honoring `IP_BOUNDARY.md`.

Pipeline to keep working end to end:

1. objective compiler (`src/core/objectiveCompiler.ts`)
2. public evidence layer (`src/core/fixtures/evidenceCards.ts`)
3. construct hypothesis generator (`src/core/constructGenerator.ts`)
4. mechanism router (`src/core/mechanismRouter.ts`, `fixtures/routes.ts`)
5. physics data generation (`src/core/physics.ts`)
6. multimodal simulation (`src/core/simulator.ts`)
7. simulation evidence for every candidate, under an instrument (`src/core/simulationEvidence.ts`)
8. experiment-value ranking, after simulation (`src/core/experimentScore.ts`)
9. rationale/evidence cards + measurement plan (`src/core/rationale.ts`, `src/core/measurementPlan.ts`)
10. design adapter, optional handoff (`src/core/designAdapter.ts`)
11. claim-boundary audit + export (`src/core/claimFirewall.ts`, `src/core/export.ts`)
12. **mandatory deterministic release audit** (`src/core/swarm/` → `swarmReview` on every result)
13. tests (`tests/`)

Keep it deterministic for a fixed seed. Do not spend time on live
RFdiffusion/LigandMPNN unless the core app already builds, tests pass, and the
demo runs offline.

After the pipeline builds, always run `/swarm-review` before calling the app done.
