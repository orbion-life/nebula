# Phase 4 — Candidate-specific quantum chemistry (verified decisions)

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`

Phase 3.5 left flavin radical-pair candidates on a **generic** isoalloxazine QM
template (`candidate_specific=False`): every flavin protein got the same plan.
Phase 4 makes the physics genuinely candidate-specific — THIS protein's real
isoalloxazine coordinates enter a real quantum-chemistry calculation — and flips
`candidate_specific=True` **only** when that actually happens.

## What was built

- **`physics/qm_worker.py`** — isolated subprocess PySCF UHF worker. Runs in its
  own process because torch/ESM and PySCF/NumPy cannot share one process on this
  platform (OpenMP `Error #15`, SIGABRT — see the recon artifact). `max_cycle=200`,
  `level_shift=0.2`, Newton second-order fallback for stubborn open-shell SCF.
  Reports the `converged` flag **truthfully**; a non-converged SCF is never
  presented as a result.
- **`physics/cluster.py`** — `extract_isoalloxazine(cif_text)` selects the
  redox-active ring atoms from a bound FAD/FMN by canonical PDB atom names,
  truncates the ribityl/adenine tail, and H-caps N10 toward the removed ribityl
  C1′ (standard QM-cluster truncation). Uses gemmi. Neutral doublet radical
  (charge 0, spin 1) is a **stated assumption**, not a claim.
- **`physics/candidate_specific.py`** — `run_candidate_qm(pdb_id, cif_text)` ties
  extraction + subprocess QM together and returns a `CandidateQm` with a
  `ParameterProvenance(source_type=computed)`. Returns `None` (→ generic template
  stands) when there is no bound flavin, or SCF/timeout fails.
- **`providers/rcsb.py`** `coordinates(pdb_id)` + `providers/base.py`
  `get_text`/`record_text_fixture` — pull the mmCIF coordinate file through the
  same live/cache/fixture + Provenance path as every other fetch.
- **`physics/eligibility.py`** `upgrade_with_candidate_qm(elig, qm)` — flips
  `qm_cluster_plan.candidate_specific=True`, sets the true heavy-atom count and
  measured wall time, records the geometry source, and appends the `computed`
  provenance. Only reachable via a successful real-coordinate QM.
- **Orchestrator wiring** (`jobs/orchestrator.py`) — in `assessing_physics`, the
  single best-resolution flavin-bound experimental structure across all candidates
  gets a real QM (`_MAX_CANDIDATE_QM=1`, `6-31g`, 200 s budget); best-effort, so
  any failure leaves the honest generic label. An interim event announces the run.
- **Discovery math** (`discovery/scoring.py`) — a converged candidate-specific QM
  adds a small **plausibility** credit (+0.08). This is mechanistic grounding, NOT
  novelty/uncertainty (which the hard rules bar from P/M/D), and the computed spin
  value itself never enters P.

## Verified live (not fixtures)

- Extracted **1N9O**'s FMN isoalloxazine (17 heavy + 1 H-cap) from the real mmCIF
  and ran **UHF/6-31G** in a subprocess: **converged**, max Mulliken spin **1.07**
  (physical), ~112 s.
- Full live run (phototropin/LOV objective, `offline=False`): Q8LPD9 → **candidate
  specific** from 1N9O; the other three LOV candidates (no flavin-bound
  experimental PDB) correctly stayed **generic**. Event: "1 with candidate-specific
  QM on real coordinates". P rose 0.72 → 0.80; evidence lane; run completed.
- **Geometry dependence proven**: stretching one C–H of a methyl radical changes
  the computed energy (test), so coordinates genuinely drive the calculation.
- **Basis choice**: 6-31g gives physical spin (1.07); sto-3g overshoots via
  Mulliken (1.82). 6-31g is the in-run basis; sto-3g is used only for fast tests.

## Honesty ledger

- `candidate_specific=True` iff real coordinates entered a converged QM — never
  from sequence, AlphaFold, or the template.
- The computed spin carries `source_type=computed`, `uncertainty=high`, and the
  cluster/charge/spin assumptions in `applicability_limits`.
- Computation ≠ validation: outputs remain unvalidated public-protein hypotheses.
- Offline runs stay generic unless a coordinate fixture exists (only 5DKL committed).

## Tests (`tests/test_phase4.py`, 6; suite 33 passing)

worker converges an open-shell radical · energy depends on geometry · real 5DKL
extraction · candidate QM on real coords is candidate-specific with a `computed`
provenance · no flavin → `None` · `upgrade` flips the flag only with real coords.

TS suite (89) + `tsc`/vite build + contract regen (no drift) + `npm audit
--omit=dev` (0) all clean.
