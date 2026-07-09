# Audit Submit

Run the final submission audit.

```bash
npm test
npm run build
# Claim-safety + generic private-path scan. Private specifics (company domain,
# retired project names, memory-vault names) live in the gitignored
# .leak-terms.local.json — see IP_BOUNDARY.md for the two-layer scan.
rg -n "validated sensor|predicts magnetic|discovered a (working )?(quantum )?biosensor|/Users/" .
```

See `IP_BOUNDARY.md` for the complete leak-scan command.

Check: no private data; no private paths; no unsupported claims; all traces
labeled synthetic; design adapters optional; generated artifacts are not
presented as candidates; Claude agents/skills visible; app works in the demo path.

Expected: the leak scan returns no hits outside `IP_BOUNDARY.md` and the boundary
test. Return PASS / FIX BEFORE SUBMISSION / DO NOT SUBMIT.
