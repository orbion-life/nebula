#!/usr/bin/env python3
"""Build the small, reproducible offline demo index.

Runs the REAL retrieval + enrichment + coordinate fetch for a curated set of real
public accessions with providers in `record=True` mode, so every response is
persisted as a committed offline fixture, and warms the content-addressed QM cache
so the candidate-specific quantum-chemistry path is instant offline. After this,
`NEBULA_OFFLINE=1` reproduces a full run — including a flavin candidate with an
experimental cofactor-bound structure and candidate-specific QM — with no network.

Usage (from backend/):  python3 ../scripts/index/build_offline_index.py
Requires network. Idempotent: re-running just refreshes fixtures.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.contracts.enums import ReadoutMode  # noqa: E402
from app.contracts.objective import ObjectiveSpec  # noqa: E402
from app.jobs.orchestrator import _best_flavin_pdb  # noqa: E402
from app.physics.candidate_specific import run_candidate_qm  # noqa: E402
from app.providers.rcsb import RcsbProvider  # noqa: E402
from app.retrieval.assemble import assemble_candidates  # noqa: E402
from app.retrieval.plan import plan_queries  # noqa: E402

# Curated real accessions. Q8LPD9 (Arabidopsis phototropin-2 LOV) carries an
# experimental FMN-bound structure (1N9O) → candidate-specific QM. Q43125
# (cryptochrome-1) is a second real accession on the evidence lane.
SEEDS = ["Q8LPD9", "Q43125"]


def main() -> int:
    obj = ObjectiveSpec(
        objective_id="offline_index",
        objective_text="public flavin protein sensor for a weak magnetic field with optical readout",
        desired_modalities=[ReadoutMode.rf_magnetic, ReadoutMode.fluorescence],
        seed_accessions=SEEDS,
    )
    plans = plan_queries(obj)
    print(f"recording provider fixtures for {len(SEEDS)} seed accession(s) across {len(plans)} plan(s)…")
    cands = assemble_candidates(plans, offline=False, per_route=6, record=True)
    print(f"  assembled {len(cands)} candidate(s); uniprot/interpro/rcsb/alphafold fixtures recorded")

    rc = RcsbProvider(offline=False, record=True)
    warmed = 0
    for c in cands:
        pdb = _best_flavin_pdb(c)
        if not pdb:
            continue
        acc = c.uniprot.primary_accession if c.uniprot else "?"
        cif, _prov = rc.coordinates(pdb)  # records coords_{pdb}.cif
        qm = run_candidate_qm(pdb, cif, basis="6-31g", timeout=300)
        if qm is not None:
            warmed += 1
            print(f"  {acc} → {pdb}: coords recorded, QM cached (converged={qm.converged}, max_spin={qm.max_abs_spin})")
        if warmed >= 2:  # bound the expensive QM the same way the orchestrator does
            break

    print(f"done. {warmed} candidate-specific QM result(s) cached. Offline demo is reproducible with NEBULA_OFFLINE=1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
