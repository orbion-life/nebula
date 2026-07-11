# Claude transparency report

Nebula Discover is a **Built with Claude: Life Sciences** project. This report maps the
visible Claude project system to the current shipped architecture.

## Division of work

| Deterministic runtime | Claude project workflow |
| --- | --- |
| Pydantic and OpenAPI contracts | Objective and contract review |
| Public provider retrieval and normalization | Evidence and citation critique |
| Route matching and physics eligibility | Mechanism and scientific red-team |
| Bounded cluster calculation and reference artifacts | Assumption and claim review |
| Triage lanes, controls, and falsifiers | Product, visual, demo, and accessibility review |
| Claim-boundary tests and export checks | Submission and judge-facing audit |

Claude roles do not execute inside the public web app. They are repository-visible build
and review tools under `.claude/`, with dated artifacts under `artifacts/claude/`.

## Agent to current artifact map

| Agent | Current source or proof |
| --- | --- |
| objective-compiler | `backend/app/objective/compile.py`, `backend/tests/test_phase1.py` |
| construct-architect | public hypothesis contracts in `backend/app/contracts/candidate.py` |
| mechanism-router | `backend/app/retrieval/plan.py`, `backend/app/discovery/mechanism.py` |
| physics-data-simulator | `backend/app/physics/`, `src/data/generated/`, `backend/tests/test_phase4.py` |
| measurement-worthiness-ranker | `backend/app/discovery/scoring.py`, `backend/app/discovery/lanes.py` |
| rationale-explainer | candidate rationale and measurement contracts under `backend/app/` |
| scientific-skeptic | dated reviews in `artifacts/claude/`, hardening tests |
| claim-boundary-auditor | `tests/exportBoundary.test.ts`, `tests/boundary.test.ts`, `IP_BOUNDARY.md` |
| visual-system-director | `src/ui/discover/`, Playwright viewport and fallback tests |
| demo-director | `DEMO_SCRIPT.md`, `e2e/discovery.spec.ts` |
| code-quality-reviewer | frontend, backend, E2E, build, audit, and deploy gates |

## Commands

`build-discover` · `swarm-review` · `skeptic-pass` · `demo-script` · `audit-submit`
· `judge-qa` · `stress-test` · `submission-pack` · `transparency-report`

## Boundary

Claude is never cited as experimental validation. The repository does not claim that a
Claude agent measured a protein, ran in the deployed application, or established a
working sensor. See [`IP_BOUNDARY.md`](./IP_BOUNDARY.md).
