---
name: not-a-model-wrapper
description: Articulate why Nebula is a pipeline workflow, not a single-model wrapper.
---

# Not a Model Wrapper

## Narrative (30 seconds)

Nebula is an **experiment-value workflow**: objective → public
hypotheses → mechanism routes → simulated sweeps (every candidate) →
experiment-value ranking → measurement plan + falsification → handoff →
deterministic release audit. AlphaFold, ESM, RFdiffusion are **optional adapters**
in `src/adapters/` — not the discovery engine.

## Proof points

- `src/core/libraryRegistry.ts` — adapter map
- `src/core/pipeline.ts` — multi-stage pipeline (not one model call)
- `tests/` — 70+ deterministic tests
- No network required for core demo

## vs chat wrapper

| Wrapper | Discover |
| --- | --- |
| One LLM call | Multi-stage pipeline + release audit |
| No claim firewall | Live claim firewall (Measure next) |
| No falsification | Kill criterion (Measure next) |
| No tests | Full test suite |
