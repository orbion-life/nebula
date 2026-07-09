---
name: physics-data-simulation
description: Generate synthetic physics parameter spaces and deterministic multimodal traces from mechanism assumptions.
---

# Physics Data Simulation

Reference: `src/core/physics.ts` and `src/core/simulator.ts`.

## Parameter spaces

spin/radical lifetime proxy, radical-pair yield, field half-saturation, RF gain,
photobleach rate, oxygen quench, temperature drift, acquisition noise.

## Traces

F/F0(t), ΔF/F(B), RF off/on contrast, lifetime shift, redox response,
material-state response, photobleaching control, oxygen nuisance.

## Simple deterministic proxies (Sunday)

```text
response(B) = amplitude * B / (B + Bhalf)
rf_effect   = response(B) * rf_gain
bleach(t)   = exp(-k_bleach * t)
observed    = baseline + response * bleach - nuisance
```

## Rules

- Label every output `synthetic assumption sweep, not prediction`.
- Deterministic for a fixed seed (seeded PRNG in `src/core/rng.ts`).
- Include nuisance/control traces. Never claim validation. Never infer real spin
  constants from sequence/AlphaFold/ESM. Optional RadicalPy/QuTiP appendix must
  not be a demo dependency.
