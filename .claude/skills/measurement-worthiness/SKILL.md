---
name: measurement-worthiness
description: Rank construct hypotheses by measurement-worthiness with open weights, never predicted performance.
---

# Measurement Worthiness

Reference: `src/core/experimentScore.ts`. Ranks the *next experiment* by expected
information gain, using the pre-computed `SimulationEvidence` and the chosen
instrument — simulation runs before ranking.

## Components (open weights, eight, no display offset)

expectedInformationGain, expectedObservabilitySNR, instrumentCompatibility,
mechanismDiscrimination, uncertaintyReduction, controlCompleteness, minus
executionBurden and nuisanceConfounderRisk.

## Rules

- Deterministic ordering: score desc, then hypothesis id asc.
- Label `ranked_for_experiment_value_not_predicted_performance`.
- No display offset, no private Nebula/Astra score, no hidden weights, no
  implied validation, no predicted sensor performance.
