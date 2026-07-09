# Build Nebula Discover

Build or continue the end-to-end Nebula Discover app while honoring `IP_BOUNDARY.md`.

Pipeline to keep working end to end:

1. objective compiler (`src/core/objectiveCompiler.ts`)
2. public evidence layer (`src/core/fixtures/evidenceCards.ts`)
3. construct hypothesis generator (`src/core/constructGenerator.ts`)
4. mechanism router (`src/core/mechanismRouter.ts`, `fixtures/routes.ts`)
5. physics data generation (`src/core/physics.ts`)
6. multimodal simulation (`src/core/simulator.ts`)
7. rationale/evidence cards (`src/core/rationale.ts`)
8. measurement-worthiness ranking (`src/core/ranking.ts`)
9. design adapter panel (`src/core/designAdapter.ts`)
10. claim-boundary audit (`src/core/claimFirewall.ts`)
11. export (`src/core/export.ts`)
12. **mandatory adversarial swarm** (`src/core/swarm.ts` → `swarmReview` on every result)
13. tests (`tests/`)

Keep it deterministic for a fixed seed. Do not spend time on live
RFdiffusion/LigandMPNN unless the core app already builds, tests pass, and the
demo runs offline.

After the pipeline builds, always run `/swarm-review` before calling the app done.
