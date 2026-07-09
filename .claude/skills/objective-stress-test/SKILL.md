---
name: objective-stress-test
description: Stress-test Discover with diverse objectives beyond the demo script.
---

# Objective Stress Test

## Presets (in repo)

- Demo: `DEMO_OBJECTIVE` seed 1337 — expect swarm pass.
- Stress: `STRESS_OBJECTIVE` seed 4242 — expect swarm warnings (vague input, predict language).

## Additional objectives to run manually

1. Wearable film, RF-only readout, mammalian cells.
2. Soluble GFP triplet route, no material context.
3. Empty / malformed objective (robust fallback).
4. Hydrogel + magnetic + confidential sequence mention (should stay public-safe).

## Record per run

| Objective | Top hypothesis | Swarm verdict | Blockers | Notes |

## Commands

```bash
npm test
npm run dev
# UI: Load stress-test objective
```

## Output

Markdown table of 4–5 runs; patch if any crash or affirmative unsafe export.
