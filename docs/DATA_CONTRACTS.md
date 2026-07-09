# Data Contracts

The authoritative, type-checked schema is [`src/core/types.ts`](../src/core/types.ts).
This document is a human-readable summary. If the two disagree, `types.ts` wins
(it is enforced by `tsc` and the tests).

## Pipeline — simulation happens BEFORE ranking

```text
RawObjective
  → ObjectiveInput          objectiveCompiler.ts   (+ Zod schema.ts; invalid input throws ObjectiveValidationError)
  → EvidenceBundle          evidenceBundle.ts
  → ConstructHypothesis[]   constructGenerator.ts
  → MechanismRoute[]        mechanismRouter.ts, fixtures/routes.ts
  → ParameterEnsemble[]     parameterEnsemble.ts
  → SimulationEvidence[]    simulationEvidence.ts  (EVERY candidate, under an InstrumentProfile)
  → ExperimentScore[]       experimentScore.ts     (ranked; 8 components; NO offset)
  → MeasurementPlan         measurementPlan.ts
  → BenchmarkComparison[]   benchmark.ts
  → DiscoverResult + export pipeline.ts, discoverCore.ts, export.ts
```

## Objective, evidence, construct, route

- **ObjectiveInput** — `desiredReadouts`, `materialContext`, `expressionHost`,
  `excitationAllowed`, `constraints`, `confidentialSequenceProvided: false`,
  `missingInformation`, `forbiddenAssumptions`.
- **EvidenceBundle** — `cards: EvidenceCard[]`, `benchmarks: BenchmarkRef[]`,
  `analogs: PublicAnalog[]` (retrieval only, never a spin prediction).
- **EvidenceCard + Citation** — `provenance: "public_literature" | "demo_assumption"`
  and `citations: {authors, year, title, venue, doi}[]` (real, checkable). Demo
  assumptions carry no citation and say so.
- **ConstructHypothesis** — claim-safety is in the type:
  `status: "public_hypothesis_not_validated"` and `privateCandidate: false` are
  literal types. Carries scaffold/architecture/cofactor/readouts/route id and
  `whyItMightWork`/`whyItMightFail`/`requiredControls`/`allowedNextStep`.
- **MechanismRoute** — `causalSteps` (each `public_anchor | assumption | unknown`),
  `simulatorPlugin`, `controlRequirements`, `confounders`, `maxClaimLevel`,
  `publicAnchors`.

## Provenance, ensembles, instrument, simulation

- **ParameterProvenance** — the contract for every numeric parameter: `name`,
  `value`, `unit`, `range`, `uncertainty`, `sourceType`
  (`database | literature | assumption | instrument | user_constraint`),
  `citationOrAssumption`, `applicabilityLimits`.
- **ParameterEnsemble** — seeded draws over provenance parameters; radical-pair
  routes reuse the generator's 12-member ensemble.
- **InstrumentProfile** — an INPUT: `minDetectableDeltaFOverF` (noise floor),
  `staticFieldRange_mT`, `rfAvailable`, `rfFreqRange_MHz`, readout modes, and
  environmental controls. Changing it changes observability and the ranking.
- **SimulationEvidence** (per candidate) — `source`
  (`generated_artifact | analytic_proxy`), `signatureMetric`/`signatureUnit`,
  `expectedSNR`, `observable`, `ensembleStd`, `mechanismDiscrimination`,
  `controlCompleteness`, `nuisanceRisk`, `traces`, and `seriesProvenance`
  (`public_measurement | simulation | assumption` per trace). No trace is
  measured data; public/measured signatures appear only, qualitatively, in the
  benchmark comparison.

The generated radical-pair artifact (`src/data/generated/radical_pair_mary.v1.json`,
validated by `src/core/generated/radicalPair.ts`) carries `B0_mT`,
`singletYield`, `mfePercent`, `dFF_assumptionDerived`, an `ensemble`,
counterfactual `controls`, an `rf` block (`rfResponseNormalized` — normalized to
unit peak; only resonance positions are physical), a `parameters` provenance
table, and a `contentHash` over all claim-bearing fields.

## Ranking, plan, benchmark

- **ExperimentScore** — components: `expectedInformationGain`,
  `expectedObservabilitySNR`, `instrumentCompatibility`, `mechanismDiscrimination`,
  `uncertaintyReduction`, `controlCompleteness`, minus `executionBurden` and
  `nuisanceConfounderRisk`. Weights are open (`EXPERIMENT_WEIGHTS`); there is **no
  display offset**. Carries `evidenceSource` and
  `label: "ranked_for_experiment_value_not_predicted_performance"`.
- **MeasurementPlan** — the decisive next experiment: `whatToMeasure`,
  `expectedSignature`, `expectedUncertainty`, `nullExpectation`,
  `positiveControls`, `negativeControls`, `competingExplanations`,
  `killCriterion`, `informationGained`, `instrumentId`.
- **BenchmarkComparison** — retrospective, qualitative only:
  `measuredQualitative` (no fabricated numbers), `simulatedFeature` (derived from
  the artifact), `agreementKind`, `mechanismClassConsistent` (never "matches"),
  `residualUncertainty`, `disclaimer`.

## Claim safety

`claimFirewall.ts` blocks affirmative/proprietary claims and returns a claim-safe
rewrite. `tests/boundary.test.ts` asserts generated exports never contain
affirmative validation/discovery claims or private strings.
