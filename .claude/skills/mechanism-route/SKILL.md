---
name: mechanism-route
description: Map a public construct hypothesis to a mechanism route and causal chain.
---

# Mechanism Route

Map a construct hypothesis to a mechanism route. Reference:
`src/core/fixtures/routes.ts` and `src/core/mechanismRouter.ts`.

## Output

route id; causal steps (each labeled public_anchor / assumption / unknown);
required controls; confounders; maxClaimLevel.

## Causal chain template

cofactor/chromophore -> excitation/state change -> spin/redox/material event ->
readout -> measurement

## Guardrails

- Cofactor presence is not proof.
- A route without a readout path is unsupported.
- Metal/cofactor needs an explicit optical/electrical transduction path before
  exceeding diagnostic_only.
