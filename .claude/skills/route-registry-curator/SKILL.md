---
name: route-registry-curator
description: Add or update mechanism routes in the public route registry with evidence and claim ceilings.
---

# Route Registry Curator

Files: `src/core/fixtures/routes.ts`, `src/core/mechanismRouter.ts`, `evidenceCards.ts`

## Adding a route

1. Define `MechanismRoute` with causal steps + support tags (public_anchor / assumption / unknown).
2. Set `maxClaimLevel` — never above `measurement_triage` for demo routes.
3. Link `publicAnchors` to evidence cards with real DOIs or `demo_assumption`.
4. Add simulator plugin or reuse existing.
5. Add swarm-relevant controls (photobleach, oxygen, temperature).
6. Run `npm test`.

## Claim ceiling

New routes must include controls + confounders + falsification path in rationale.
