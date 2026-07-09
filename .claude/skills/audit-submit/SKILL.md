---
name: audit-submit
description: Run the final pre-submission audit for Nebula Discover.
---

# Audit Submit

Use before recording or submitting.

## Checks

app builds; tests pass (72+); demo path works offline; exports match UI selection;
falsification in rationale + export; release audit (swarm) covered in demo script;
all traces labeled synthetic; no private strings; no unsafe claims;
CLAUDE_TRANSPARENCY.md current; SUBMISSION.md ready; CI workflow passes.

## Commands

```bash
npm test
npm run build
# Private specifics live in the gitignored .leak-terms.local.json (see IP_BOUNDARY.md).
rg -n "validated sensor|predicts magnetic|discovered a (working )?(quantum )?biosensor|/Users/" .
```

## Verdict

Return PASS / FIX BEFORE SUBMISSION / DO NOT SUBMIT.
