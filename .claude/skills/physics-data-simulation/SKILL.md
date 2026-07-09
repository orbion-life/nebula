---
name: physics-data-simulation
description: Generate synthetic physics parameter spaces and deterministic multimodal traces from mechanism assumptions.
---

# Physics Data Simulation

Reference: `src/core/physics.ts` and `src/core/simulator.ts` for the proxy routes.
The radical-pair route uses **real** RadicalPy spin dynamics instead — an offline,
Zod-validated artifact (`scripts/physics/radical_pair_mary.py` →
`src/data/generated/radical_pair_mary.v1.json`).

## Parameter spaces (proxy routes)

spin/radical lifetime proxy, radical-pair yield, field-response shape,
photobleach rate, oxygen quench, temperature drift, acquisition noise.

## Traces

F/F0(t), ΔF/F(B), RF off/on contrast, lifetime shift, redox response,
material-state response, photobleaching control, oxygen nuisance.

## Simple deterministic proxies (non-radical-pair routes)

```text
signal(x) = amplitude * response_shape(x)   # x = stimulus axis
bleach(t) = exp(-k_bleach * t)
observed  = baseline + signal * bleach - nuisance
```

The radical-pair route does NOT use this proxy: its MARY curve and RF response come
from the RadicalPy artifact. RF there is a **frequency-resolved resonance** from the
spin Hamiltonian's eigen-gaps (with a flat B1=0 control), not a scalar `rf_gain`.

## Rules

- Label every output `synthetic assumption sweep, not prediction`.
- Deterministic for a fixed seed (seeded PRNG in `src/core/rng.ts`).
- Include nuisance/control traces. Never claim validation. Never infer real spin
  constants from sequence/AlphaFold/ESM. Heavy Python stays offline — the
  RadicalPy artifact is precomputed, so `npm test`/`npm run build` never run it.
