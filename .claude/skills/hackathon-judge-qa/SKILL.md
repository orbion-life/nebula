---
name: hackathon-judge-qa
description: Rehearse hard hackathon judge Q&A with claim-safe answers and on-screen proof points.
---

# Hackathon Judge Q&A

## Hard questions + answers

**Did you validate the sensor?**
No. Status is `diagnostic_only_not_validated`. Point to the "diagnostic only" label + claim firewall on the Measure next screen.

**Why not just use AlphaFold/ESM?**
Those are optional retrieval adapters for public analogs — never spin prediction. Point to `docs/LIBRARY_ROADMAP.md` (analog search, not spin prediction) + `IP_BOUNDARY.md`.

**How is Claude used?**
Visible agents/skills; code owns simulator/firewall/swarm. Point to `CLAUDE_TRANSPARENCY.md` + footer.

**What would falsify the top hypothesis?**
Point to the falsification kill criterion on the Measure next screen + export section.

**Is this a chat wrapper?**
No — pipeline with deterministic stages. Point to `src/core/pipeline.ts` + `npm test`.

**What does the swarm do?**
Deterministic 10-lens release audit every run. Point to the Release audit disclosure (Measure next) + `docs/SWARM_ARCHITECTURE.md`.

## Forbidden answers

Never say: validated, working sensor, predicts magnetic response, discovered a biosensor.

## Output

15 rehearsed Q&A pairs with on-screen proof points (screen names).
