#!/usr/bin/env python3
"""Isolated PySCF worker — MUST run in a subprocess.

torch/ESM and PySCF/NumPy cannot share one process on this platform (OpenMP
`Error #15`, SIGABRT — see the recon artifact), so all PySCF work runs here,
launched via subprocess from candidate_specific.py.

stdin  JSON: {atoms:[[symbol,[x,y,z]],...], charge, spin, basis, max_cycle}
stdout JSON: {converged, energy, wall_seconds, natm, basis, method,
              atom_spin:{ao_atom_idx:val}, max_abs_spin, n_spin_sites}

HONEST: the `converged` flag is reported truthfully; a non-converged SCF is
labelled as such and never presented as a result.
"""
from __future__ import annotations

import json
import sys
import time


def main() -> None:
    req = json.load(sys.stdin)
    t0 = time.time()
    import numpy as np
    from pyscf import gto, scf

    mol = gto.M(
        atom=[[a[0], tuple(a[1])] for a in req["atoms"]],
        charge=int(req.get("charge", 0)),
        spin=int(req.get("spin", 1)),
        basis=req.get("basis", "6-31g"),
        verbose=0,
    )
    mf = scf.UHF(mol)
    mf.max_cycle = int(req.get("max_cycle", 200))
    mf.level_shift = 0.2
    mf.conv_tol = 1e-7
    energy = float(mf.kernel())
    if not mf.converged:
        try:  # second-order fallback for stubborn open-shell SCF
            mf2 = mf.newton()
            energy = float(mf2.kernel())
            mf = mf2
        except Exception:
            pass

    dm = mf.make_rdm1()
    spin_dm = dm[0] - dm[1]
    ovlp = mf.get_ovlp()
    ao_pop = np.einsum("ij,ji->i", spin_dm, ovlp)
    labels = mol.ao_labels(fmt=None)
    atom_spin: dict[int, float] = {}
    for p, lab in zip(ao_pop, labels):
        aid = int(lab[0])
        atom_spin[aid] = atom_spin.get(aid, 0.0) + float(p)

    out = {
        "converged": bool(mf.converged),
        "energy": energy,
        "wall_seconds": round(time.time() - t0, 2),
        "natm": int(mol.natm),
        "basis": req.get("basis", "6-31g"),
        "method": "UHF",
        "atom_spin": {str(k): round(v, 4) for k, v in atom_spin.items()},
        "max_abs_spin": round(max((abs(v) for v in atom_spin.values()), default=0.0), 4),
        "n_spin_sites": int(sum(1 for v in atom_spin.values() if abs(v) > 0.05)),
    }
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
