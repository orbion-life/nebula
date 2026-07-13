"""Coarse per-protein magnetic-field-effect (MFE) estimate via RadicalPy (Tier 0.5).

Given the per-protein dipolar coupling D (geometry-derived, Tier 0), run a small RadicalPy singlet-yield
sweep vs magnetic field for a flavin + tryptophan model radical pair and report the magnitude of the
field effect (max |MFE%| over 0-5 mT) and the field where it peaks. This is a COARSE MODEL ESTIMATE
under stated assumptions, NOT a validated prediction and NOT a claim the protein works as a sensor:
  * hyperfine couplings are class-level (RadicalPy's flavin N5 + tryptophan Hbeta1 database values,
    one dominant nucleus per radical) -- not computed on this protein (that is Tier 1);
  * the exchange coupling J is taken negligible (the standard weak-coupling assumption; the tunnelling
    J estimate is unreliable at these separations);
  * recombination/relaxation rates are generic order-of-magnitude values;
  * the biology->optics transduction is not modelled.
Only D enters per protein. RadicalPy is imported lazily so a build without it simply returns None
(the honest "no estimate" path, same pattern as the PySCF QM).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

_CACHE = Path(__file__).resolve().parent / "radical_pair_cache"
_WORKER_VERSION = "mfe.v1"  # bump to invalidate cached estimates when this code changes
_KS = _KT = _KR = 1.0e6      # generic Haberkorn recombination + random-field relaxation rates (1/s)
_FIELD_MAX_MT = 20.0
_N_FIELD = 41


def _cache_key(d_mT: float, j_mT: float) -> str:
    blob = json.dumps({"d": round(d_mT, 4), "j": round(j_mT, 4), "ks": _KS, "kt": _KT, "kr": _KR,
                       "fmax": _FIELD_MAX_MT, "n": _N_FIELD, "v": _WORKER_VERSION}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def estimate_mfe(d_mT: float, j_mT: float = 0.0) -> dict | None:
    """Return {"mfe_amplitude_percent", "mfe_peak_field_mT"} or None if it cannot be computed.

    Content-addressed cached so an offline build/CI never recomputes (and a build without RadicalPy
    serves any committed cache entry, else returns None)."""
    key = _cache_key(d_mT, j_mT)
    cached = _CACHE / f"{key}.json"
    if cached.exists():
        try:
            return json.loads(cached.read_text())
        except Exception:
            pass
    try:
        import numpy as np
        from radicalpy import kinetics, relaxation
        from radicalpy.data import Molecule
        from radicalpy.simulation import LiouvilleSimulation, State

        flavin = Molecule.fromdb("flavin_anion", nuclei=["N5"])
        trp = Molecule.fromdb("tryptophan_cation", nuclei=["Hbeta1"])  # class-level partner hyperfine
        sim = LiouvilleSimulation([flavin, trp])
        fields = np.linspace(0.0, _FIELD_MAX_MT, _N_FIELD)
        h0 = sim.total_hamiltonian(B0=0.0, D=d_mT, J=j_mT)
        rho0 = np.asarray(sim.initial_density_matrix(State.SINGLET, h0)).reshape(-1)
        ps = np.asarray(sim.projection_operator(State.SINGLET)).reshape(-1)
        phi = np.zeros(_N_FIELD)
        for i, b in enumerate(fields):
            L = sim.total_hamiltonian(B0=float(b), D=d_mT, J=j_mT)
            sim.apply_liouville_hamiltonian_modifiers(L, [
                kinetics.Haberkorn(_KS, State.SINGLET),
                kinetics.Haberkorn(_KT, State.TRIPLET),
                relaxation.RandomFields(_KR),
            ])
            phi[i] = _KS * float(np.real(ps @ np.linalg.solve(np.asarray(L), -rho0)))
        if phi[0] == 0:
            return None
        mfe = 100.0 * (phi - phi[0]) / phi[0]
        # the truncated model rises monotonically, so report the amplitude (max |MFE|) over the swept
        # range as an honest "up to ~X%" figure rather than a spurious grid-edge "peak field".
        out = {"mfe_amplitude_percent": round(float(np.max(np.abs(mfe))), 2), "field_range_mT": _FIELD_MAX_MT}
    except Exception:
        return None
    try:
        _CACHE.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(out))
    except Exception:
        pass
    return out
