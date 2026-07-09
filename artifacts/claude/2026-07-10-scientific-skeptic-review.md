# Claude review artifact — scientific skeptic pass on the physics + ranking core

- **Date:** 2026-07-10
- **Reviewer:** `scientific-skeptic` agent (29 tool calls; re-ran the generator and
  cross-checked Crossref), with lead verification by Claude Opus (this session).
- **Scope reviewed:** `scripts/physics/radical_pair_mary.py`,
  `src/data/generated/radical_pair_mary.v1.json`, `src/core/simulationEvidence.ts`,
  `src/core/experimentScore.ts`, `src/core/benchmark.ts`, `src/core/measurementPlan.ts`.
- **Commit reviewed:** `8f26103` (Phase 2/5) + `74ee520` (Phase 3 physics).

## Independently verified as solid (not merely asserted)

- Spin-dynamics physics is correct: the Liouvillian-inverse yield agrees with an
  independent time-domain integration to ~1e-6 relative (docstring claims <0.3%).
- Determinism holds: the generator re-runs byte-identically; `contentHash` matches.
- All four benchmark DOIs are real and Crossref-accurate; no fabricated citations.
- No fabricated measured numbers; every simulated feature is derived from the artifact.
- Claim-boundary language is strong; counterfactual controls behave correctly
  (`no_hyperfine` → exactly 0 MFE; `relaxation_dominated` collapses the effect).

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| B1 | blocker | Uncited proxy magnitudes (0.30–0.45) outrank the real-physics route (~0.02), and every score was stamped `simulationDriven: true`. | **Fixed.** `ExperimentScore.simulationDriven` replaced by `evidenceSource: "generated_artifact" \| "analytic_proxy"`; proxy magnitudes documented as uncited/illustrative; UI ranking tables now tag each route `physics` vs `proxy`. |
| W1 | warning | `rf.deltaYieldFraction = -1.0` is a normalized unit-peak lineshape, not a yield fraction (B1 divided out). | **Fixed.** Renamed to `rf.rfResponseNormalized` across generator, Zod schema, consumers, UI, tests; added `units` note; regenerated (hash changed by design). |
| W2 | warning | `signatureUnit: "ΔF/F (fractional)"` mislabels an F0-normalized absolute yield difference. | **Fixed.** Relabelled `"ΔF/F (assumption-derived, F₀-normalized)"`. |
| W3 | warning | O₂ and temperature not forced as controls for radical-pair routes. | **Fixed.** Both forced as mandatory controls for RP plans, independent of the route list. |
| W4 | warning | Nominal signature presented while ensemble mean diverges >2×. | **Fixed.** Measurement plan now surfaces the ensemble range alongside the nominal signature. |
| W5 | warning | Content hash covered only `data`, excluding claim-bearing prose; TS never recomputed it. | **Partially fixed.** Hash now covers `label`+`model`+`seriesLabels`+`parameters`+`data` (all claims). TS-side recompute intentionally **deferred**: cross-language float canonicalization is fragile; TS relies on Zod + structural integrity checks. Documented honestly. |
| W6 | warning | `triplet_FP` benchmark claimed a "simulated trace" no artifact backs. | **Fixed.** Reworded to `no_comparison` / `mechanismClassConsistent: false`; states no triplet artifact is generated. |
| W7 | warning | `matches: true` could render as a validated green check. | **Fixed.** Renamed field to `mechanismClassConsistent`. |
| N1 | nit | `ensembleStd` used the global-max std, not the std at the peak field. | **Fixed.** Uses the std at the in-range peak-field index. |
| N2 | nit | "SNR" is signal / min-detectable, not shot-noise SNR. | **Accepted / documented** in the ranking rationale wording; not renamed. |
| N3 | nit | The <0.3% cross-check has no committed test. | **Deferred / tracked.** The physics is covered by `tests/generated.test.ts` and the determinism check; the cross-check remains a build-time, documented property. |
| N4 | nit | The one real-physics route is keyed `radical_pair_response_proxy`. | **Deferred.** Renaming the plugin id touches the route registry, schema, and fixtures for cosmetic gain; the `evidenceSource` tag already distinguishes it. |

## Disagreements / judgement calls

- I did **not** force the radical-pair route to rank first. The honest,
  physics-driven outcome is that large-signal, well-controlled readouts
  (photokinetic ~35%, material ~30%) outrank a ~2% magnetofluorescence signal —
  and that is the correct anti-overclaim message. The radical-pair route is a
  lower-ranked, higher-information, higher-risk experiment, and the app says so.
- The `code-quality-reviewer` agent spawned alongside this pass returned no usable
  output (0 tool calls); its result was disregarded, and a self code-review was
  substituted. This is recorded rather than hidden.

## Verification outcomes after fixes

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 89/89 tests pass (incl. ranking-sensitivity and benchmark).
- Generator re-run: deterministic; expanded `contentHash` stable across runs.
- Zod loader validates the regenerated artifact; corrupted-artifact test still rejects.
