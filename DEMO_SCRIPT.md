# Nebula Discover — 3-Minute Demo Script

**Built with Claude: Life Sciences.** One scientific reveal: objective → public
benchmark → mechanism → a virtual counterfactual experiment whose *physics and
instrument change the ranking* → "measure this next" → the falsification rule.

Run `npm run dev`. The studio has four states: **Ask · Explain · Simulate ·
Measure next**. Keep the demo objective loaded.

---

**0:00–0:20 — Ask (the problem)**

> "Protein-sensor teams generate mechanism ideas faster than they can measure
> them. Nebula Discover decides what deserves measurement first — and what result
> would falsify it. It does not claim any sensor works."

On screen: the Ask state — objective compiled to constraints; the honest status
line ("synthetic assumption sweeps, not measured data"); the instrument picker.
Note the instrument gates what is observable. Click **Explain the mechanisms**.

**0:20–0:55 — Explain (evidence → mechanism)**

> "Public evidence, then the mechanism it can and can't support. Each causal step
> is tagged anchored, assumed, or unknown — the honest gap is visible before any
> measurement. Anchors link to real DOIs."

Point out the ranked routes (each tagged **physics** or **proxy**). Click the
**LOV / flavin** radical-pair route to inspect the deep path.

**0:55–1:45 — Simulate (the reveal)**

> "This trace is simulation from a real radical-pair spin-dynamics model —
> RadicalPy: Zeeman, hyperfine, Haberkorn recombination, relaxation. The low-field
> dip and high-field rise are the radical-pair signature, with an ensemble
> uncertainty band and the instrument's noise floor drawn in."

Now demonstrate that the physics and instrument drive the answer:
- Switch the instrument to **plate reader** → the same signal sinks toward the
  red noise floor and the route loses rank (watch the live ranking table move).
- Switch to **confocal ODMR** → the RF resonance appears (frequency-resolved from
  the Hamiltonian eigen-gaps; the RF-off control is flat — not a scalar gain).
- Toggle **counterfactual: fast spin relaxation** → the field effect collapses
  below the floor.

> "Change the physics or the instrument and the ranking changes — because we
> simulate every route before we rank. Beside the trace, the public benchmark is
> quoted qualitatively: we reproduce the *mechanism class*, not measured numbers."

**1:45–2:40 — Measure next (the decision)**

> "One decisive experiment: what to measure, the expected signature and
> uncertainty, the null expectation, the required positive and negative controls
> — including mandatory oxygen and temperature for a radical pair — the competing
> explanations, and the exact kill criterion."

Show the live **claim firewall** downgrading an unsafe claim. Click **Download
handoff** — the brief matches the selected hypothesis, ready for a measurement
collaborator (Orbion has no wet lab; validation comes from a partner or public
data).

**2:40–3:00 — Close**

> "A pipeline, not a model wrapper. Deterministic code owns the physics, ranking,
> and claim firewall; Claude's contribution is in the review artifacts and commit
> history, not an in-product claim that agents ran. Nebula Discover doesn't say
> the sensor works — it says what is worth measuring first, and what would prove
> it wrong."

**Closing line:** *"Decide what deserves measurement first."*
