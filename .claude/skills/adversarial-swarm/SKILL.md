---
name: adversarial-swarm
description: Mandatory hierarchical map-reduce adversarial swarm for every Nebula run.
---

# Adversarial Swarm (mandatory)

Run this skill **after every** `runDiscover` / `/build-discover` completion.

Architecture: **Hierarchical Map-Reduce + Producer-Reviewer** —
see `docs/SWARM_ARCHITECTURE.md`.

## Four stages

1. **ORCHESTRATE** — freeze producer artifact
2. **MAP** — 10 parallel lenses (4 sentry + 6 committee)
3. **REDUCE** — severity-weighted consensus + theme escalation
4. **SYNTHESIZE** — arbiter + verification manifest

## When to run

- After implementing or changing any core pipeline module
- Before recording the demo video
- Before `/audit-submit`
- Whenever `/skeptic-pass` is invoked (swarm is the first step)

## Procedure

1. Run `npm test tests/swarm.test.ts` — all architecture tests must pass.
2. Run the demo objective with seed `1337`; open the **Release audit** disclosure on the Measure next screen.
3. Confirm `swarmReview.architecture === hierarchical-map-reduce-producer-reviewer`.
4. If verdict is `fail`, patch `arbiter.requiredPatches` and re-run.
5. Document accepted warnings in the demo script.

## Implementation

- Orchestrator: `src/core/swarm/index.ts`
- Lenses: `src/core/swarm/lenses.ts`
- Docs: `docs/SWARM_ARCHITECTURE.md`

## Claim boundary

The swarm **reviews** public outputs; it does not validate biology or predict
sensor performance.
