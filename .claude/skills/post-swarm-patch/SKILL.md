---
name: post-swarm-patch
description: Fix mandatory swarm blockers from arbiter requiredPatches and re-verify.
---

# Post-Swarm Patch

When `swarmReview.verdict === "fail"`.

## Procedure

1. Read `result.swarmReview.arbiter.requiredPatches`.
2. Group by lens id (prefix in brackets).
3. Patch code/docs; never weaken claim firewall to force pass.
4. Re-run `npm test tests/swarm.test.ts`.
5. Re-run UI with same seed; confirm verdict improves.

## Escalations

If warnings escalated to blockers (2+ committee lenses, same theme), fix root cause
— do not silence lenses.

## Done when

Verdict is `pass` or accepted `warn` with documented triage in demo script.
