"""Radical-pair magnetic-field-effect sensitivity via RadicalPy (Tier 0.5).

Given the per-protein dipolar coupling D (geometry-derived, Tier 0), run a small RadicalPy singlet-yield
sweep vs magnetic field for a flavin + tryptophan model radical pair and report the magnitude of the
field effect (max |MFE%| over 0-20 mT). The result is an envelope across explicit generic kinetic
scenarios, NOT a validated response prediction and NOT a claim the protein works as a sensor:
  * hyperfine couplings are class-level (RadicalPy's flavin N5 + tryptophan Hbeta1 database values,
    one dominant nucleus per radical) -- not computed on this protein (that is Tier 1);
  * exchange J is the candidate geometry's order-of-magnitude tunnelling estimate;
  * recombination/relaxation rates are generic and deliberately varied;
  * the biology->optics transduction is not modelled.
Candidate-associated D and the uncertain distance-decay J estimate enter the sweep. RadicalPy is
imported lazily so a build without it simply returns None (the explicit "not computed" path, the
same behavior as the optional PySCF QM worker).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

_CACHE = Path(__file__).resolve().parent / "radical_pair_cache"
_WORKER_VERSION = "mfe.v4-j-rate-curves"
_FIELD_MAX_MT = 20.0
_N_FIELD = 41
_SCENARIOS = (
    # name, singlet recombination, triplet recombination, random-field relaxation (all s^-1)
    ("long_lived", 3.0e5, 3.0e5, 1.0e5),
    ("baseline", 1.0e6, 1.0e6, 1.0e6),
    ("fast_recombination", 3.0e6, 3.0e6, 1.0e6),
    ("relaxation_dominated", 1.0e6, 1.0e6, 3.0e6),
    ("singlet_biased", 3.0e6, 3.0e5, 1.0e6),
)


def _cache_key(d_mT: float, j_mT: float) -> str:
    blob = json.dumps({"d": round(d_mT, 4), "j": round(j_mT, 4), "scenarios": _SCENARIOS,
                       "fmax": _FIELD_MAX_MT, "n": _N_FIELD, "v": _WORKER_VERSION}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def estimate_mfe(d_mT: float, j_mT: float = 0.0) -> dict | None:
    """Return a named kinetic-sensitivity envelope or None if it cannot be computed.

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
        scenario_results = []
        scenario_curves = []
        coupling_scenarios = []
        for name, value in (
            ("geometry_j", float(j_mT)),
            ("capped_weak_j", min(abs(float(j_mT)), 1.0)),
            ("negligible_j", 0.0),
        ):
            if not any(abs(value - existing[1]) < 1e-9 for existing in coupling_scenarios):
                coupling_scenarios.append((name, value))
        for j_name, scenario_j in coupling_scenarios:
            for name, ks, kt, kr in _SCENARIOS:
                phi = np.zeros(_N_FIELD)
                for i, b in enumerate(fields):
                    L = sim.total_hamiltonian(B0=float(b), D=d_mT, J=scenario_j)
                    sim.apply_liouville_hamiltonian_modifiers(L, [
                        kinetics.Haberkorn(ks, State.SINGLET),
                        kinetics.Haberkorn(kt, State.TRIPLET),
                        relaxation.RandomFields(kr),
                    ])
                    phi[i] = ks * float(np.real(ps @ np.linalg.solve(np.asarray(L), -rho0)))
                if phi[0] == 0:
                    continue
                mfe = 100.0 * (phi - phi[0]) / phi[0]
                curve = [round(float(value), 4) for value in mfe]
                scenario_results.append({
                    "name": f"{j_name}__{name}",
                    "singlet_recombination_s": ks,
                    "triplet_recombination_s": kt,
                    "relaxation_s": kr,
                    "exchange_j_mT": round(scenario_j, 6),
                    "amplitude_percent": round(float(np.max(np.abs(mfe))), 2),
                })
                scenario_curves.append(curve)
        if not scenario_results:
            return None
        amplitudes = [row["amplitude_percent"] for row in scenario_results]
        baseline_index = next(
            (i for i, row in enumerate(scenario_results) if row["name"] == "geometry_j__baseline"),
            0,
        )
        baseline = scenario_results[baseline_index]["amplitude_percent"]
        curve_matrix = np.asarray(scenario_curves, dtype=float)
        out = {
            "mfe_amplitude_percent": baseline,
            "field_range_mT": _FIELD_MAX_MT,
            "lower_percent": min(amplitudes),
            "upper_percent": max(amplitudes),
            "scenarios": scenario_results,
            "fields_mT": [round(float(value), 3) for value in fields],
            "lower_curve_percent": [round(float(value), 4) for value in np.min(curve_matrix, axis=0)],
            "baseline_curve_percent": scenario_curves[baseline_index],
            "upper_curve_percent": [round(float(value), 4) for value in np.max(curve_matrix, axis=0)],
        }
    except Exception:
        return None
    try:
        _CACHE.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(out))
    except Exception:
        pass
    return out
