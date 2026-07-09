---
name: construct-hypothesis
description: Generate public scaffold/cofactor/readout/material construct hypotheses without producing private candidates.
---

# Construct Hypothesis

Create public construct hypotheses. Reference: `src/core/constructGenerator.ts`.

## Process

1. Select scaffold families triggered by the objective.
2. Attach cofactors/chromophores and readout modes.
3. Attach material/expression constraints.
4. Write whyItMightWork and whyItMightFail.
5. Attach required controls from the route.
6. Cap claims: `status: public_hypothesis_not_validated`, `privateCandidate: false`.

## Prohibited

mutation lists; orderable sequences; private Orbion candidates; "optimized" or
"validated" wording. Keep `metal_cofactor` as a confounder annotation, last.
