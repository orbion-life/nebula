---
name: claude-transparency-report
description: Generate or refresh the verifiable Claude agent→artifact transparency map for judges.
---

# Claude Transparency Report

Run before submission. Output lives in `CLAUDE_TRANSPARENCY.md`.

## Procedure

1. List every file in `.claude/agents/` and `.claude/skills/`.
2. For each agent, map to: core module(s), test file(s), UI screen (if any).
3. Confirm deterministic ownership: schemas, simulator, ranking, firewall, swarm.
4. Update `CLAUDE_TRANSPARENCY.md` if any mapping is stale.
5. Verify footer in UI lists agents matching `CLAUDE_USE.md`.

## Judge line

"Every Claude role maps to a file or test you can open in under 60 seconds."
