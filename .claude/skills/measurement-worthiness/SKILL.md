---
name: measurement-worthiness
description: Rank construct hypotheses by measurement-worthiness with open weights, never predicted performance.
---

# Measurement Worthiness

Reference: `src/core/ranking.ts`.

## Components (open weights)

routeSupport, readoutCompatibility, constructExecutability, cofactorFeasibility,
controlQuality, minus nuisanceRiskPenalty and uncertaintyPenalty.

## Rules

- Deterministic ordering: score desc, then hypothesis id asc.
- Label `ranked_for_measurement_triage_not_performance`.
- No private Nebula/Astra score, no hidden weights, no implied validation.
