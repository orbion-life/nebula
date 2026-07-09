# Nebula Discover — Hackathon Submission Pack

**Built with Claude: Life Sciences** · Public open-source discovery module

## One-line pitch

Turn a messy protein-sensor objective into ranked public construct hypotheses,
synthetic assumption sweeps, falsification criteria, and a claim-safe measurement
handoff — with a deterministic 10-lens release audit gating every run.

## Problem

Protein sensor teams generate ideas faster than they can measure them. Nebula
Discover shows **what deserves measurement first**, with controls, confounders,
and explicit kill rules — without claiming validation.

## Claude use (verifiable)

| Layer | Owner | Proof in repo |
| --- | --- | --- |
| Schemas, simulator, ranking, firewall, swarm | Deterministic TypeScript | `src/core/`, `tests/` |
| Objective parsing, rationale prose, red-teaming | Claude agents/skills | `.claude/agents/`, `.claude/skills/` |
| Mandatory swarm architecture | Code + Claude mirror | `src/core/swarm/`, `docs/SWARM_ARCHITECTURE.md` |

See [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md) for the full agent→artifact map.

## Demo

- **Script:** [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
- **Run locally:** `npm install && npm run dev`
- **Seed:** `1337` (demo) · `4242` (stress-test objective)

## Verify before submit

```bash
npm test
npm run build
```

Run `/audit-submit` or `.claude/skills/audit-submit/SKILL.md`.

## What we do NOT claim

- No validated sensor · no magnetic-response prediction · no private Nebula data
- All traces: **synthetic assumption sweep, not prediction**

See [`IP_BOUNDARY.md`](./IP_BOUNDARY.md).

## Submission form fields (draft)

**Title:** Nebula Discover — Decide What Deserves Measurement First

**Description:** A public discovery workflow for protein-sensor teams: objective →
construct hypotheses → mechanism routes → synthetic traces (every candidate) →
experiment-value ranking → falsification criteria → claim-safe handoff.
Deterministic hierarchical map-reduce release audit on every result.
Deterministic, offline, fully tested.

**Claude:** A bounded, transparent set of 13 agents and 25+ skills as Claude's
working method; deterministic code owns schemas, simulator, firewall, and swarm;
Claude parses objectives and authors rationale under structured constraints.

**Try it:** Clone repo → `npm test` → `npm run dev` → paste demo objective → Run Discover.
