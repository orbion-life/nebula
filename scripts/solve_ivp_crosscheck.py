#!/usr/bin/env python3
"""
OPTIONAL scipy.integrate.solve_ivp cross-check of the TS photokinetic proxy.

This is a reference check only. It is NOT part of `npm test` / `npm run build`
and requires scipy (`pip install scipy`). It reproduces the same first-order
photokinetic model used by src/core/ode.ts and src/core/simulator.ts and reports
the max deviation between the numerical solution and the analytic proxy.

Output is a synthetic assumption sweep, not a prediction.

Run:
    python scripts/solve_ivp_crosscheck.py
"""
import json
import math

try:
    import numpy as np
    from scipy.integrate import solve_ivp
except ImportError:  # keep this script optional
    raise SystemExit(
        "scipy/numpy not installed. This cross-check is optional: `pip install scipy numpy`."
    )

# Must match DEFAULT_PHOTOKINETIC in src/core/ode.ts
P = dict(baseline=1.0, gain=0.35, tau_on=15.0, tau_off=32.5, light_off_at=60.0)
T_END = 120.0


def deriv(t, y):
    F = y[0]
    if t < P["light_off_at"]:
        return [(P["baseline"] + P["gain"] - F) / P["tau_on"]]
    return [-(F - P["baseline"]) / P["tau_off"]]


def analytic(t):
    if t < P["light_off_at"]:
        return P["baseline"] + P["gain"] * (1 - math.exp(-t / P["tau_on"]))
    f60 = P["gain"] * (1 - math.exp(-P["light_off_at"] / P["tau_on"]))
    return P["baseline"] + f60 * math.exp(-(t - P["light_off_at"]) / P["tau_off"])


def main():
    times = np.linspace(0, T_END, 25)
    sol = solve_ivp(deriv, [0, T_END], [P["baseline"]], t_eval=times, rtol=1e-9, atol=1e-12)
    numeric = sol.y[0]
    max_err = max(abs(numeric[i] - analytic(t)) for i, t in enumerate(times))
    print(
        json.dumps(
            {
                "label": "synthetic assumption sweep, not prediction",
                "max_abs_error_numeric_vs_analytic": max_err,
                "agrees_within_2e-3": bool(max_err < 2e-3),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
