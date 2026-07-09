---
name: not-a-model-wrapper
description: Articulate why Nebula Discover is a pipeline workflow, not a single-model wrapper.
---

# Not a Model Wrapper

## Narrative (30 seconds)

Nebula Discover is a **measurement-worthiness workflow**: objective → public
hypotheses → mechanism routes → synthetic sweeps → falsification → ranking →
handoff → mandatory swarm. AlphaFold, ESM, RFdiffusion are **optional adapters**
in `src/adapters/` — not the discovery engine.

## Proof points

- `src/core/libraryRegistry.ts` — adapter map
- UI §09 — pipeline diagram
- `tests/` — 70+ deterministic tests
- No network required for core demo

## vs chat wrapper

| Wrapper | Discover |
| --- | --- |
| One LLM call | 9 UI stages + swarm |
| No claim firewall | Live downgrade §06 |
| No falsification | Kill rules §05 |
| No tests | Full test suite |
