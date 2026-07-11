# Claude Use

Nebula Discover was built for the **Built with Claude: Life Sciences** hackathon.
Claude use is designed to be verifiable directly from this repository.

See also: [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md) · [`SUBMISSION.md`](./SUBMISSION.md)

## How Claude is used

Claude acts as a **visible, bounded panel of roles** around deterministic,
reviewable Python and TypeScript. The shipped browser journey uses the FastAPI
objective, retrieval, mechanism, physics-eligibility, and run-orchestration path;
the older TypeScript research pipeline remains a tested reference implementation.
Claude works within the repository's contracts and scientific boundaries.

## Agents (13)

Listed in `.claude/agents/` — see transparency report for code mappings.

## Skills (25)

**Pipeline:** objective-to-constraints, construct-hypothesis, mechanism-route,
physics-data-simulation, measurement-worthiness, design-adapter, rationale-evidence,
claim-boundary, adversarial-swarm, visual-system

**Hackathon / judge-facing:** claude-transparency-report, hackathon-judge-qa,
falsification-path, objective-stress-test, github-submission-pack,
evidence-citation-audit, measurement-collaborator-handoff, not-a-model-wrapper,
demo-recording-qa, life-sciences-impact-narrator, competitive-landscape,
accessibility-demo-pass

**Maintenance:** route-registry-curator, post-swarm-patch, demo-video, audit-submit

## Commands (9)

`build-discover` · `swarm-review` · `skeptic-pass` · `demo-script` · `audit-submit`
· `transparency-report` · `judge-qa` · `stress-test` · `submission-pack`

## Mandatory swarm

Every `runDiscover` result includes `swarmReview`. See [`docs/SWARM_ARCHITECTURE.md`](./docs/SWARM_ARCHITECTURE.md).

## Scientific boundary

Claude is never used to claim validation. See `IP_BOUNDARY.md`.
