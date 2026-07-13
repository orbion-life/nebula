# Nebula: hackathon submission pack

**Built with Claude: Life Sciences — Builder track**

## One-line pitch

Turn a quantum-sensing objective into one public protein lead and a measurement brief
with a predeclared stop rule for the stated construct, assay, and conditions.

## Named user

**Aniruddh Goteti, founder of Orbion, is Nebula's first internal user.** Orbion has no
in-house wet lab. Before a planned measurement-scoping discussion with a physicist, he
needs to turn public protein evidence and model assumptions into a lead, an observable,
and a predeclared stop rule for the stated construct, assay, and conditions. This is a
concrete workflow need, not external adoption or bench validation.

## Final form description — 183 words

Nebula's named first user is Aniruddh Goteti, founder of Orbion. Orbion has no wet lab.
Before a planned measurement-scoping discussion, Aniruddh needs to turn a sensing
objective into one public protein lead, a bounded mechanism rationale, and a measurement
with a predeclared stop rule for the stated conditions.

Nebula is open-source software for that job. An objective compiles into
mechanism-specific UniProt, InterPro, and RCSB retrieval. Family and cofactor evidence
gate each route; structure-associated diagnostics and versioned spin-dynamics scenario
sweeps expose assumptions rather than predict performance. The output is a
measurement-scoping brief with an observable, instrument class, controls, repeat plan,
provisional advance rule, stop rule, missing information, and provenance. The workflow
is built around a planned measurement-scoping discussion; this is workflow evidence,
not bench validation.

Claude's repository-visible scientific review system contains:
thirteen agents, twenty-seven skills, and nine commands shaped contracts, challenged
claims, corrected science, hardened accessibility, and built backend-connected tests.
Fixed-input ranking and diagnostics are inspectable; live public-data retrieval can
change. Claude is not presented as experimental evidence.

Nebula performs measurement triage. It does not claim a validated sensor, predicted
response, or assay protocol.

## Live artifacts

- **App:** https://nebula-discover.greenforest-ed82ac43.westeurope.azurecontainerapps.io
- **Demo video:** add the final uploaded URL after recording
- **Script:** [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
- **Claude transparency:** [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md)
- **First-use record:** [`artifacts/first-use/ANIRUDDH_FIRST_USE.md`](./artifacts/first-use/ANIRUDDH_FIRST_USE.md)

## What the demo proves

- Mission Bench selections compile into the backend `ObjectiveSpec`; the result states
  which fields affected the decision and which remain handoff context.
- The sensed quantity drives mechanism-specific public-protein retrieval.
- Public family and cofactor annotations gate route assignment.
- Candidate-associated diagnostics, route-level references, and model assumptions
  remain visibly separate.
- A five-section result journey leads with the decision and ends with a print-ready
  measurement-scoping brief.
- The brief carries a primary observable, instrument class, outcomes, controls, repeat
  plan, provisional advance rule, stop rule, missing information, and provenance.

## Evidence status and boundary

This submission demonstrates an implemented and tested decision-support workflow for
a named internal user and a planned measurement-scoping need. It includes no external
user adoption, bench-validation evidence, calibrated probability of success,
candidate detectability claim, or arbitrary sequence-to-spin-response prediction.

## Claude leverage

Claude's role is visible and reviewable in the repository:

1. Scientific-skeptic reviews identified overclaims and drove claim-boundary tests.
2. Interface agents helped migrate the concept into the current backend-connected,
   five-section browser journey.
3. Accessibility and test agents hardened frontend, FastAPI, browser-to-backend, and
   deployment paths with dated artifacts and deterministic verification.

Fixed-input ranking is inspectable Python and TypeScript; live public records can change.
Claude is not presented as having measured a protein or established experimental evidence.

## Final verification

```bash
npm test
npm run build
cd backend && python3 -m pytest -q
cd .. && npm run e2e
npm audit --omit=dev
```

Run `/audit-submit`, `/skeptic-pass`, and `/judge-qa` in Claude Code after the final
video URL is added.
