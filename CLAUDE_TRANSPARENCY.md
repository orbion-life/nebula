# Claude Transparency Report

Verifiable map of Claude roles → repository artifacts. **Deterministic TypeScript
owns execution**; Claude owns bounded authoring and review under constraints.

## Division of labor

| Deterministic (code + tests) | Claude (agents + skills) |
| --- | --- |
| `objectiveCompiler.ts`, zod schema | Parse messy objectives |
| `constructGenerator.ts`, routes registry | Hypothesis framing |
| `simulator.ts`, `physics.ts`, PRNG | Explain sweeps (not run them) |
| `experimentScore.ts` weights | Rationale prose |
| `claimFirewall.ts` | Red-team wording |
| `src/core/swarm/` orchestrator | Mirror swarm in sessions |
| `export.ts`, falsification rules | Handoff narration |

## Agent → artifact map

| Agent | Skill | Code / test proof |
| --- | --- | --- |
| objective-compiler | objective-to-constraints | `src/core/objectiveCompiler.ts`, `tests/objective.test.ts` |
| construct-architect | construct-hypothesis | `src/core/constructGenerator.ts`, `tests/construct.test.ts` |
| mechanism-router | mechanism-route | `src/core/mechanismRouter.ts`, `fixtures/routes.ts` |
| physics-data-simulator | physics-data-simulation | `src/core/simulator.ts`, `tests/simulator.test.ts` |
| rationale-explainer | rationale-evidence | `src/core/rationale.ts`, `src/core/falsification.ts` |
| measurement-worthiness-ranker | measurement-worthiness | `src/core/experimentScore.ts` |
| design-adapter | design-adapter | `src/core/designAdapter.ts` |
| swarm-orchestrator | adversarial-swarm | `src/core/swarm/`, `tests/swarm.test.ts` (release audit) |
| scientific-skeptic | hackathon-judge-qa, falsification-path | Swarm lenses + skills |
| claim-boundary-auditor | claim-boundary | `src/core/claimFirewall.ts`, `tests/claim.test.ts` |
| visual-system-director | visual-system, accessibility-demo-pass | `src/ui/`, `theme.css` |
| demo-director | demo-video, demo-recording-qa | `DEMO_SCRIPT.md` |
| code-quality-reviewer | audit-submit | `tests/`, `.github/workflows/ci.yml` |

## Hackathon skills (judge-facing)

| Skill | Purpose |
| --- | --- |
| claude-transparency-report | This document |
| hackathon-judge-qa | Q&A rehearsal |
| falsification-path | Kill criteria |
| objective-stress-test | Robustness beyond demo |
| github-submission-pack | README + SUBMISSION polish |
| evidence-citation-audit | DOI verification |
| measurement-collaborator-handoff | Wet-lab brief |
| not-a-model-wrapper | Differentiation narrative |
| demo-recording-qa | Post-record checklist |
| life-sciences-impact-narrator | PI-facing prose |
| route-registry-curator | New mechanism routes |
| post-swarm-patch | Fix swarm blockers |
| competitive-landscape | Honest comparisons |
| accessibility-demo-pass | Video readability |

## Commands

`build-discover` · `swarm-review` · `skeptic-pass` · `demo-script` · `audit-submit`
· `judge-qa` · `stress-test` · `submission-pack` · `transparency-report`

## Regenerate

Run skill `.claude/skills/claude-transparency-report/SKILL.md` after adding agents
or core modules.
