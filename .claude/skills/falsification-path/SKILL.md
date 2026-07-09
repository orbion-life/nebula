---
name: falsification-path
description: Produce explicit falsification kill criteria for the top-ranked construct hypothesis.
---

# Falsification Path

Implementation: `src/core/falsification.ts` → rationale card `falsification_criteria`.

## Procedure

1. Read top hypothesis + mechanism route from latest `runDiscover` result.
2. Confirm 3 kill-rule bullets exist (field flat, control failure, cofactor/oxygen falsifier).
3. Ensure export includes falsification section (`exportMarkdown`).
4. Verify evidence card `ev_field_effect_falsified` uses `relation: falsified_by`.

## Template bullets

- If primary readout flat under controls → abandon route.
- If RF contrast tracks photobleach only → confounded; downgrade.
- If oxygen/deoxygenation breaks spin-linked interpretation → falsify radical-pair route.

## Claim boundary

Kill rules are **measurement triage**, not proof the sensor works.
