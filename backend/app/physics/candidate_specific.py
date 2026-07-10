"""Candidate-specific quantum chemistry.

Extracts THIS protein's isoalloxazine geometry from its real cofactor-bound
structure and runs PySCF (UHF) in an isolated subprocess to compute a
candidate-specific spin-density observable. Only when this succeeds does a
candidate become `candidate_specific=True` — a different protein's coordinates
give a different result, so geometry genuinely affects the calculation (the
honesty bar the prompt sets). If no cofactor-bound structure exists (e.g. an
AlphaFold model with no ligand), this returns None and the generic template
label stands.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from ..contracts.enums import ParameterSourceType, Uncertainty
from ..contracts.provenance import ParameterProvenance
from .cluster import extract_isoalloxazine

_WORKER = Path(__file__).resolve().parent / "qm_worker.py"


@dataclass(frozen=True)
class CandidateQm:
    pdb_id: str
    ligand: str
    chain: str
    n_atoms: int
    n_heavy: int
    converged: bool
    energy_hartree: float
    max_abs_spin: float
    n_spin_sites: int
    basis: str
    wall_seconds: float
    note: str

    def provenance(self) -> ParameterProvenance:
        return ParameterProvenance(
            name="candidate_isoalloxazine_max_spin_density",
            value=self.max_abs_spin,
            unit="electron spin (Mulliken)",
            range=(0.0, 1.0),
            uncertainty=Uncertainty.high,
            source_type=ParameterSourceType.computed,
            citation_or_assumption=f"UHF/{self.basis} on the isoalloxazine core extracted from {self.pdb_id} {self.ligand} (chain {self.chain}); converged={self.converged}",
            applicability_limits=self.note,
        )


def run_candidate_qm(pdb_id: str, cif_text: str, *, basis: str = "6-31g", timeout: float = 150.0) -> CandidateQm | None:
    extracted = extract_isoalloxazine(cif_text)
    if extracted is None:
        return None
    atoms, charge, spin, note, ligand, chain = extracted
    n_heavy = sum(1 for a in atoms if a[0] != "H")
    req = {"atoms": atoms, "charge": charge, "spin": spin, "basis": basis, "max_cycle": 200}
    env = {
        **os.environ,
        "OMP_NUM_THREADS": "2",
        "KMP_DUPLICATE_LIB_OK": "TRUE",  # isolate the OpenMP conflict in this child only
    }
    try:
        proc = subprocess.run(
            [sys.executable, str(_WORKER)],
            input=json.dumps(req),
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        out = json.loads(proc.stdout)
    except Exception:
        return None
    return CandidateQm(
        pdb_id=pdb_id, ligand=ligand, chain=chain, n_atoms=out["natm"], n_heavy=n_heavy,
        converged=out["converged"], energy_hartree=out["energy"],
        max_abs_spin=out["max_abs_spin"], n_spin_sites=out["n_spin_sites"],
        basis=out["basis"], wall_seconds=out["wall_seconds"], note=note,
    )
