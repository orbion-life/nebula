/**
 * ODE cross-check for the photokinetic proxy.
 *
 * The photokinetic trace in the simulator uses an analytic solution of a simple
 * first-order photokinetic ODE:
 *
 *   lit  (t < lightOffAt):  dF/dt = (baseline + gain - F) / tauOn
 *   dark (t >= lightOffAt):  dF/dt = -(F - baseline) / tauOff
 *
 * This module provides both the analytic proxy and an independent RK4 numerical
 * integrator so a test can confirm they agree. An optional Python reference using
 * scipy.integrate.solve_ivp is in scripts/solve_ivp_crosscheck.py.
 *
 * Output is a synthetic assumption sweep, not a prediction.
 */

export interface PhotokineticParams {
  baseline: number; // resting F/F0 (1)
  gain: number; // charged amplitude above baseline
  tauOn: number; // charging time constant (s)
  tauOff: number; // dark recovery time constant (s)
  lightOffAt: number; // time light turns off (s)
}

export const DEFAULT_PHOTOKINETIC: PhotokineticParams = {
  baseline: 1,
  gain: 0.35,
  tauOn: 15,
  tauOff: 32.5,
  lightOffAt: 60,
};

/** dF/dt for the photokinetic model. */
export function photokineticDerivative(
  t: number,
  F: number,
  p: PhotokineticParams,
): number {
  if (t < p.lightOffAt) return (p.baseline + p.gain - F) / p.tauOn;
  return -(F - p.baseline) / p.tauOff;
}

/** Analytic (closed-form) solution, the form the simulator proxy uses. */
export function photokineticAnalytic(t: number, p: PhotokineticParams): number {
  if (t < p.lightOffAt) {
    return p.baseline + p.gain * (1 - Math.exp(-t / p.tauOn));
  }
  const f60 = p.gain * (1 - Math.exp(-p.lightOffAt / p.tauOn));
  return p.baseline + f60 * Math.exp(-(t - p.lightOffAt) / p.tauOff);
}

/** Classic RK4 fixed-step integration of a scalar ODE. */
export function integrateRK4(
  deriv: (t: number, y: number) => number,
  y0: number,
  t0: number,
  t1: number,
  steps: number,
): Array<{ t: number; y: number }> {
  const h = (t1 - t0) / steps;
  const out: Array<{ t: number; y: number }> = [{ t: t0, y: y0 }];
  let y = y0;
  let t = t0;
  for (let i = 0; i < steps; i++) {
    const k1 = deriv(t, y);
    const k2 = deriv(t + h / 2, y + (h / 2) * k1);
    const k3 = deriv(t + h / 2, y + (h / 2) * k2);
    const k4 = deriv(t + h, y + h * k3);
    y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t = t + h;
    out.push({ t, y });
  }
  return out;
}

/** Integrate the photokinetic model numerically and sample at `times`. */
export function integratePhotokinetic(
  p: PhotokineticParams,
  tEnd: number,
  steps = 4000,
): (times: number[]) => number[] {
  const traj = integrateRK4(
    (t, y) => photokineticDerivative(t, y, p),
    p.baseline,
    0,
    tEnd,
    steps,
  );
  return (times: number[]) =>
    times.map((tq) => {
      // nearest-sample lookup on the fine grid
      let best = traj[0];
      let bestD = Infinity;
      for (const pt of traj) {
        const d = Math.abs(pt.t - tq);
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
      return best.y;
    });
}
