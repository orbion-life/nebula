---
name: objective-to-constraints
description: Convert a messy sensor/material objective into the structured Nebula ObjectiveInput.
---

# Objective To Constraints

Use when parsing a natural-language sensor goal into `ObjectiveInput`.
Reference implementation: `src/core/objectiveCompiler.ts`.

## Steps

1. Extract readout modes (subset of the six supported readouts).
2. Extract material context and expression host.
3. Extract excitation constraints.
4. Set `confidentialSequenceProvided: false`.
5. List `missingInformation` and `forbiddenAssumptions`.

## Guardrails

- Never infer private sequence details.
- Never assume validation data.
- Translate "quantum" into concrete candidate readouts; record the ambiguity.
- If unclear, use `unknown`.
