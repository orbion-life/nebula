# Phase 3.5 — Discovery Frontier (verified decisions)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`

Nebula is a quantum-biology discovery engine. Phase 3.5 turns the closed
5-route vocabulary into a composable **MechanismGraph** and splits results into
two strictly-separate lanes, with real product logic (not visuals).

## What was built

- **MechanismGraph** (`contracts/mechanism.py`): typed primitives (energy input →
  spin-forming event → spin-bearing state → quantum evolution → biological
  transduction → readout → context) with per-step KnowledgeState (known/assumed/
  unknown) and UnknownParameters. Known LOV/cryptochrome/FP-triplet/redox routes
  are retained as VALIDATED TEMPLATES, not the limits of the search.
- **CapabilityVector** (`discovery/capability.py`): what a real protein offers,
  from public evidence only (cofactors, metals, flavin/chromophore/redox flags,
  domains, binding-site residues, structure confidence, readouts, evidence conf).
- **Constraint-relaxation ladder L0–L4** (`discovery/ladder.py`): each level
  lowers the claim ceiling and exposes more assumptions; novelty rises with level.
- **Discovery math** (`discovery/scoring.py`): seven separate dimensions
  P/M/D/N/U/IG/C, Pareto ranking per lane, quality-diversity ordering for
  mechanism-space coverage. Hard rules ENFORCED and tested: novelty and
  uncertainty never raise P/M/D or performance; unparameterizable candidates
  never enter a computed lane.
- **Two lanes** (`discovery/lanes.py`): evidence (max P·M·D, L0 known family) vs
  frontier (max IG·N·coverage, out-of-family, subject to floors on P, M,
  control-completeness). Each frontier result carries its out-of-family reason,
  remaining assumptions, the cheapest discriminating experiment, and a falsifier.
- **RunState** now stores `evidence_shortlist` and `frontier_experiments`
  separately; the orchestrator completes the run through the two lanes.

## Honesty corrections (as the prompt required)

- The current flavin eligibility is **NOT candidate-specific**: `QmClusterPlan`
  now carries `candidate_specific=False` + `geometry_source="canonical isoalloxazine
  core (generic template)"`, and the reason states every flavin protein gets the
  same plan until Phase 4 extracts its real geometry. Not described otherwise.
- The 5 known routes are the **known-route lane**, not the complete space.

## Infra fixes

- Run identity fingerprint now folds in **component versions** (config,
  radical-pair artifact hash, ESM-2 model id, provider-API versions).
- **Real SSE** at `GET /api/runs/{id}/events` (text/event-stream); the JSON list
  moved to `/events.json`.
- Assembler selects the **best cofactor-bound PDB** (has the required cofactor,
  then lowest resolution) instead of the first xref; records a degradation when
  the chosen structure doesn't resolve the cofactor.

## Verified

- **27/27 backend pytest** incl. the 8 required invariants: known LOV/cryptochrome
  recover on the evidence lane; a family-distant (redox) candidate enters ONLY the
  frontier lane; novelty cannot raise P/M/D; unparameterizable (heme, no flavin)
  excluded from both lanes; model disagreement raises IG (not plausibility);
  changing the instrument changes measurability + selection (triplet-FP frontier-
  eligible only with RF); same inputs+versions+seed → same fingerprint; every
  frontier hypothesis has a falsifier + measurement plan.
- `tsc` + regenerated `src/contracts/api.ts` clean; frontend vitest green; prod
  `npm audit` 0.
- **LIVE two-lane run** (real UniProt search, no seeds): evidence lane = phototropin
  Q8LPD9 (P=0.72, selected) + cryptochromes Q16526/Q49AN0/Q32Q86; frontier lane =
  out-of-family flavoproteins (flavodoxin–NADP reductases P28861/Q9L6V3,
  hydroxysteroid dehydrogenase P32370). Lanes disjoint; each frontier item has a
  falsifier. Live UniProt fetch confirmed (Q16526, mode=live).

## Next

Phase 4: candidate-specific PySCF (subprocess-isolated per the OpenMP gotcha) that
extracts THIS protein's isoalloxazine geometry/charge/multiplicity into the calc,
upgrading `qm_cluster_assumption` → truly `candidate_specific`. Then the quantum-
biology web experience (UI phase).
