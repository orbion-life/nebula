# Nebula documentation

The shipped product is the React → FastAPI runtime documented in the root [README](../README.md#shipped-web-architecture). The TypeScript core under `src/core` remains a tested reference implementation; it is not the browser's execution path.

## Current shipped runtime

- [Design adapters](./DESIGN_ADAPTERS.md) — preview and bring-your-own-compute RFdiffusion boundaries.
- [README media](./media/readme/) — homogeneous 16:9 frames used by the repository tour.

## Reference implementation notes

- [Data contracts](./DATA_CONTRACTS.md) — deterministic TypeScript reference schemas and pipeline.
- [Library roadmap](./LIBRARY_ROADMAP.md) — original reference-core dependency and adapter plan.
- [Research adapters](./RESEARCH_ADAPTERS.md) — TypeScript reference adapter interfaces.
- [Swarm architecture](./SWARM_ARCHITECTURE.md) — deterministic ten-lens review used by the reference pipeline.

Reference documents are retained because they explain tested design ideas and provenance. Their headings explicitly mark the runtime boundary so they cannot be mistaken for the deployed architecture.

## Capture media

Run `node scripts/capture_screenshots.mjs` against a local or deployed instance to refresh the 1280×720 README frames. The script writes a fixed sequence and consistent viewport; review every frame before committing because live public records and WebGL timing can change.
