# Claude Use

Nebula was built for the **Built with Claude: Life Sciences** hackathon.
Claude use is designed to be verifiable directly from this repository.

See also: [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md)

## How Claude is used

Claude Code provides a **visible, bounded panel of roles** around deterministic,
reviewable Python and TypeScript. The shipped browser journey uses the FastAPI
objective, retrieval, mechanism, physics-eligibility, and run-orchestration path;
the older TypeScript research pipeline remains a tested reference implementation.
Claude works within the repository's contracts and scientific boundaries.

## Highest-leverage interventions

The value is not the inventory of agent files; it is the review-to-change loop:

1. **Scientific correction.** Scientific-skeptic and claim-boundary passes identified
   response-prediction language, unsupported route assignments, and missing caveats.
   Accepted changes are enforced by boundary tests and candidate-specific eligibility
   checks.
2. **Product integration.** Interface and backend agents replaced an earlier
   presentation-only prototype with the current FastAPI-connected, five-section result
   journey and a print-ready measurement handoff.
3. **Release hardening.** Accessibility, browser, backend, and deployment reviews added
   backend-connected E2E coverage, reduced-motion behavior, structure fallbacks, and
   post-deploy smoke checks. Dated review artifacts live under `artifacts/claude/`.

## Agents (13)

Listed in `.claude/agents/` — see transparency report for code mappings.

## Skills (27)

**Pipeline:** objective-to-constraints, construct-hypothesis, mechanism-route,
physics-data-simulation, measurement-worthiness, design-adapter, rationale-evidence,
claim-boundary, adversarial-swarm, visual-system

**Hackathon / judge-facing:** claude-transparency-report, hackathon-judge-qa,
falsification-path, objective-stress-test, github-submission-pack,
evidence-citation-audit, measurement-collaborator-handoff, not-a-model-wrapper,
demo-recording-qa, life-sciences-impact-narrator, competitive-landscape,
accessibility-demo-pass

**Maintenance:** route-registry-curator, post-swarm-patch, demo-video,
audit-submit, external-skill-curator

## Commands (9)

`build-discover` · `swarm-review` · `skeptic-pass` · `demo-script` · `audit-submit`
· `transparency-report` · `judge-qa` · `stress-test` · `submission-pack`

## Deterministic reference swarm

The older TypeScript `runDiscover` reference path includes `swarmReview`. It remains a
tested research artifact but does not power the shipped FastAPI browser runtime. See
[`docs/SWARM_ARCHITECTURE.md`](./docs/SWARM_ARCHITECTURE.md).

## Scientific boundary

Claude is never used to claim validation. See `IP_BOUNDARY.md`.
