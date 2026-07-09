# Data Contracts

The authoritative, type-checked schema is [`src/core/types.ts`](../src/core/types.ts).
This document is a human-readable summary. If the two ever disagree, `types.ts`
wins (it is enforced by `tsc` and the tests).

## Pipeline

```text
RawObjective
  → ObjectiveInput           (objectiveCompiler.ts)
  → ConstructHypothesis[]    (constructGenerator.ts)
  → MechanismRoute           (mechanismRouter.ts, fixtures/routes.ts)
  → PhysicsParameterSpace    (physics.ts)
  → SimulationOutput         (simulator.ts)
  → RationaleCard[]          (rationale.ts)
  → MeasurementWorthiness[]  (ranking.ts)
  → DiscoverResult + export  (pipeline.ts, export.ts)
```

## Core types

### ObjectiveInput
Structured constraints compiled from messy text. Key fields: `desiredReadouts`
(subset of `fluorescence | lifetime | RF_magnetic | ODMR_like |
redox_electrochemical | material_state`), `materialContext`, `expressionHost`,
`excitationAllowed`, `constraints`, `confidentialSequenceProvided: false`,
`missingInformation`, `forbiddenAssumptions`.

### ConstructHypothesis
A public hypothesis. Claim-safety is encoded in the type:
`status: "public_hypothesis_not_validated"` and `privateCandidate: false` are
literal types (the compiler rejects any other value). Carries `scaffoldFamily`,
`architectureKind`, `cofactorOrChromophore`, `readoutModes`, `mechanismRouteId`,
`whyItMightWork`, `whyItMightFail`, `requiredControls`, `evidenceCardIds`,
`allowedNextStep`.

### EvidenceCard + Citation
Each card has `provenance: "public_literature" | "demo_assumption"` and a
`citations: Citation[]` array. A `Citation` is
`{ authors, year, title, venue, doi }` — a real, checkable reference. Cards marked
`demo_assumption` intentionally carry no citation and say so.

### MechanismRoute
`routeClass`, `requiredCofactors`, `supportedReadouts`, `causalSteps` (each step
labeled `public_anchor | assumption | unknown`), `simulatorPlugin`,
`controlRequirements`, `confounders`, `maxClaimLevel`
(`diagnostic_only | measurement_triage | partner_ready_dossier`), `publicAnchors`.

### PhysicsParameterSpace / SimulationOutput
Parameters carry `valueRange`, `unit`, `source`
(`public_anchor | demo_assumption | user_constraint`), `uncertainty`, and
`canBeInterpretedAsValidation: false`. `SimulationOutput.label` is the literal
`"synthetic assumption sweep, not prediction"`, and each `Trace` carries a
`requiredControl`, `isControl`, and `isNuisance` flag.

### MeasurementWorthiness
Open, deterministic scoring. `components` are `routeSupport`,
`readoutCompatibility`, `constructExecutability`, `cofactorFeasibility`,
`controlQuality`, minus `nuisanceRiskPenalty` and `uncertaintyPenalty`. The
display offset is documented in `ranking.ts` and does not change rank order.
`label: "ranked_for_measurement_triage_not_performance"`.

## Claim safety

`claimFirewall.ts` blocks affirmative/proprietary claims and returns a claim-safe
rewrite. `tests/boundary.test.ts` asserts that generated exports never contain
affirmative validation/discovery claims or private strings.
