---
name: evidence-citation-audit
description: Audit public evidence cards for real DOIs, correct metadata, and claim-safe relations.
---

# Evidence Citation Audit

Target: `src/core/fixtures/evidenceCards.ts`

## Procedure

1. For each card with `provenance: public_literature`, verify DOI format.
2. Confirm `demo_assumption` cards have zero citations and are labeled in UI.
3. Check relations: supports, requires, assumes, confounded_by, falsified_by, capsClaimAt.
4. Run `npm test tests/evidence.test.ts`.
5. Explain screen: every route anchor links to `https://doi.org/...` when cited.
6. Also verify the four public-benchmark DOIs in `src/core/benchmark.ts` (real 2025/2026 papers).

## Fail if

- Literature card with empty citations.
- Card implies validated sensor.
- Missing `falsified_by` kill anchor for field-sensitive routes.
