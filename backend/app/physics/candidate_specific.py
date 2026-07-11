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

import hashlib
import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

from ..contracts.enums import ParameterSourceType, Uncertainty
from ..contracts.provenance import ParameterProvenance
from .cluster import extract_isoalloxazine

_WORKER = Path(__file__).resolve().parent / "qm_worker.py"
# Content-addressed cache of UHF results. The isoalloxazine geometry is extracted
# deterministically from a fixed structure, so (atoms, charge, spin, basis) fully
# determines the result — cache it so an offline demo (and CI) never pays the ~2 min
# 6-31G compute twice. Committed entries make the offline candidate-QM path instant.
_QM_CACHE = Path(__file__).resolve().parent / "qm_cache"


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
            unit="Mulliken spin population (basis dependent)",
            range=None,
            uncertainty=Uncertainty.high,
            source_type=ParameterSourceType.computed,
            citation_or_assumption=f"UHF/{self.basis} on an isolated neutral-doublet isoalloxazine cluster extracted from {self.pdb_id} {self.ligand} (chain {self.chain}); converged={self.converged}",
            applicability_limits=(
                f"{self.note} Mulliken populations are basis and partitioning dependent; the protein environment, "
                "radical partner, protonation alternatives and dynamics are omitted. This value is neither a probability "
                "nor a magnetic-response prediction."
            ),
        )


def _worker_hash() -> str:
    try:
        return hashlib.sha256(_WORKER.read_bytes()).hexdigest()[:12]
    except Exception:
        return "noworker"


def _cache_key(req: dict) -> str:
    # include the worker code hash so any change to the QM code invalidates cached
    # results (the cache can never mask a computation regression).
    blob = json.dumps({**req, "_worker": _worker_hash()}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def _cache_load(key: str) -> CandidateQm | None:
    p = _QM_CACHE / f"{key}.json"
    if not p.exists():
        return None
    try:
        cached = CandidateQm(**json.loads(p.read_text()))
        return cached if cached.converged else None
    except Exception:
        return None


def _cache_store(key: str, qm: CandidateQm) -> None:
    try:
        _QM_CACHE.mkdir(parents=True, exist_ok=True)
        (_QM_CACHE / f"{key}.json").write_text(json.dumps(asdict(qm), indent=1))
    except Exception:
        pass  # cache is best-effort; a write failure never breaks the run


def run_candidate_qm(
    pdb_id: str,
    cif_text: str,
    *,
    basis: str = "6-31g",
    timeout: float = 150.0,
    use_cache: bool = True,
    cancel_check: Callable[[], bool] | None = None,
) -> CandidateQm | None:
    extracted = extract_isoalloxazine(cif_text)
    if extracted is None:
        return None
    atoms, charge, spin, note, ligand, chain = extracted
    n_heavy = sum(1 for a in atoms if a[0] != "H")
    req = {"atoms": atoms, "charge": charge, "spin": spin, "basis": basis, "max_cycle": 200}

    # content-addressed cache: identical geometry+basis+worker → identical result, instantly
    key = _cache_key({**req, "pdb_id": pdb_id})
    if use_cache:
        cached = _cache_load(key)
        if cached is not None:
            return cached

    env = {
        **os.environ,
        "OMP_NUM_THREADS": "2",
        "KMP_DUPLICATE_LIB_OK": "TRUE",  # isolate the OpenMP conflict in this child only
    }
    try:
        proc = subprocess.Popen(
            [sys.executable, str(_WORKER)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,  # drop verbose child stderr so a full pipe buffer cannot stall the poll loop
            text=True,
            env=env,
        )
        assert proc.stdin is not None
        proc.stdin.write(json.dumps(req))
        proc.stdin.close()
        proc.stdin = None
        deadline = time.monotonic() + timeout
        while proc.poll() is None:
            if cancel_check is not None and cancel_check():
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
                return None
            if time.monotonic() >= deadline:
                proc.kill()
                proc.wait()
                return None
            time.sleep(0.1)
        stdout, _stderr = proc.communicate()
        if proc.returncode != 0 or not stdout.strip():
            return None
        out = json.loads(stdout)
    except Exception:
        return None
    if not out.get("converged", False):
        return None
    qm = CandidateQm(
        pdb_id=pdb_id, ligand=ligand, chain=chain, n_atoms=out["natm"], n_heavy=n_heavy,
        converged=out["converged"], energy_hartree=out["energy"],
        max_abs_spin=out["max_abs_spin"], n_spin_sites=out["n_spin_sites"],
        basis=out["basis"], wall_seconds=out["wall_seconds"], note=note,
    )
    if use_cache:  # a cache-bypassing test computation must not persist (avoids stale/churn entries)
        _cache_store(key, qm)
    return qm
