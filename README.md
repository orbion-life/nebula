# Nebula Discover

**Built with Claude: Life Sciences** · Decide what deserves measurement first.

> Operating guide: [`CLAUDE.md`](./CLAUDE.md) · 3-minute demo: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) · Submission pack: [`SUBMISSION.md`](./SUBMISSION.md) · Claude map: [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md)

**Decide what deserves measurement first.**

Nebula Discover is a public, open-source **counterfactual measurement studio**.
Given a public protein scaffold, a sensing objective, an environment, and an
**instrument**, it grounds the objective in public evidence, **simulates the
physics of every candidate mechanism route**, ranks them by **experiment value**,
and returns the one measurement worth running next — with the result that would
falsify it.

It is a small scientific instrument for asking:

> Given this scaffold, objective, environment, and instrument, which mechanism
> and measurement should we test next — and what would falsify it?

## What it does — simulation happens BEFORE ranking

```text
sensing objective + instrument
  -> structured constraints (Zod-validated)
  -> public evidence bundle (real DOIs)
  -> public construct hypotheses
  -> mechanism routes (anchored / assumed / unknown steps)
  -> parameter ensembles (provenance on every value)
  -> SIMULATION EVIDENCE for every candidate, under the instrument
  -> experiment-value ranking (8 open components, no offset)
  -> one decisive measurement plan + kill criterion
  -> retrospective public-benchmark comparison
  -> claim audit + collaborator handoff
```

The radical-pair route is **real spin dynamics** (RadicalPy): a versioned,
provenance-tagged artifact is generated offline and consumed only after Zod
validation. Changing the physics or the instrument changes the ranking.

## What it does NOT do

- It does not discover or validate a working sensor.
- It does not predict magnetic/RF fluorescence response for arbitrary proteins.
- It does not claim sequence, AlphaFold, or ESM determine spin response.
- It contains no private ranking, no proprietary scoring, and no partner or
  wet-lab data.
- Generated design-adapter artifacts are **public demo stubs**, never commercial
  candidates.

Every simulated trace is labeled **"synthetic assumption sweep, not
prediction."** See [`IP_BOUNDARY.md`](./IP_BOUNDARY.md).

## Quick start

```bash
npm install
npm run dev            # open the local studio
npm test               # deterministic + boundary + acceptance suite (vitest)
npm run build          # typecheck + production build
npm audit --omit=dev   # production dependency audit (expect 0)

# OPTIONAL, offline — regenerate the radical-pair physics artifact:
python3 scripts/physics/radical_pair_mary.py
```

## Demo objective

```text
We want a genetically encoded multimodal protein sensor for an optically active
hydrogel film. Optical fluorescence readout. Possible magnetic or RF-linked
response. Bacterial expression first. Blue-light excitation acceptable. No
confidential sequences. Open-source/public/synthetic evidence only. Output what
deserves measurement first, with controls and failure modes.
```

The app compiles this into constraints, generates ranked public construct
hypotheses (LOV/flavin, cryptochrome/FAD, triplet FP, RFP/flavin, redox,
material-composite, metal-confounder), simulates multimodal traces with mandatory
photobleaching/oxygen controls, explains the top route, downgrades an unsafe
claim live, and exports a measurement handoff (Markdown/JSON).

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for the full operating guide and boundaries.

| Module | File |
| --- | --- |
| Objective compiler (+ Zod validation) | `src/core/objectiveCompiler.ts`, `src/core/schema.ts` |
| Public evidence bundle + cards (real DOIs) | `src/core/evidenceBundle.ts`, `src/core/fixtures/evidenceCards.ts` |
| Public benchmarks + retrospective comparison | `src/core/benchmark.ts` |
| Construct hypothesis generator | `src/core/constructGenerator.ts` |
| Mechanism router + route registry | `src/core/mechanismRouter.ts`, `src/core/fixtures/routes.ts` |
| Instrument profiles | `src/core/fixtures/instruments.ts` |
| Parameter ensembles + provenance | `src/core/parameterEnsemble.ts` |
| Radical-pair physics (RadicalPy) + Zod loader | `scripts/physics/radical_pair_mary.py`, `src/data/generated/`, `src/core/generated/radicalPair.ts` |
| Simulation evidence (per candidate) | `src/core/simulationEvidence.ts`, `src/core/simulator.ts`, `src/core/rng.ts` |
| Experiment-value ranking (8 components, no offset) | `src/core/experimentScore.ts` |
| Measurement plan (decisive next experiment) | `src/core/measurementPlan.ts`, `src/core/falsification.ts` |
| Rationale + evidence | `src/core/rationale.ts` |
| Design adapter (stub/precomputed, optional) | `src/core/designAdapter.ts` |
| Claim firewall | `src/core/claimFirewall.ts` |
| Deterministic release audit (CI gate, not a product feature) | `src/core/swarm/` (see `docs/SWARM_ARCHITECTURE.md`) |
| Export (measurement handoff) | `src/core/export.ts` |
| Pipeline orchestrator | `src/core/pipeline.ts`, `src/core/discoverCore.ts` |
| Cinematic Tufte UI (Ask · Explain · Simulate · Measure next) | `src/ui/App.tsx`, `src/ui/screens/`, `src/ui/components/` |
| Claude review artifacts | `artifacts/claude/` |

## Evidence & citations

Mechanism plausibility is anchored to **real, checkable public citations** (author,
year, venue, DOI) in `src/core/fixtures/evidenceCards.ts` — e.g. Hore & Mouritsen
(Annu. Rev. Biophys. 2016), Maeda et al. (Nature 2008), Salomon et al.
(Biochemistry 2000), Dickson et al. (Nature 1997). Cards that describe sandbox
choices are explicitly flagged `demo_assumption` and carry no citation. A citation
supports the *plausibility of a mechanism route*; it never implies a construct is a
validated sensor. See the schema in [`docs/DATA_CONTRACTS.md`](./docs/DATA_CONTRACTS.md).

## Scientific firewall

The simulator produces **synthetic assumption sweeps**, not biological truth.

- Correct: *Under these transparent assumptions, this route would produce a
  measurable pattern worth testing.*
- Forbidden: *This protein will show magnetic fluorescence.*

The runtime claim firewall (`src/core/claimFirewall.ts`) blocks unsafe claims and
rewrites them; the demo shows this downgrade live while the plots stay visible.

## Why so many adapters?

Nebula Discover is **not a wrapper around one model** — it is a
construct-hypothesis and experiment-value *workflow*. Different parts of the
question are answered by different tools:

- **Public evidence sources** (UniProt, RCSB, AlphaFold DB, FPbase) ground a
  hypothesis in citable public data.
- **Embeddings / retrieval** (ESM, FAISS) find **public analogs** — never predict
  spin response.
- **Spin-dynamics** (RadicalPy) genuinely powers the radical-pair route; QuTiP /
  PySCF would deepen the *synthetic* mechanism sweep further.
- **Protein-design models** (RFdiffusion, LigandMPNN, ProteinMPNN, Boltz) are
  downstream **handoffs**, not the discovery engine.

To keep the demo fast, deterministic, and laptop-runnable, these live as
**optional adapters** (`src/adapters/`) that fail gracefully to safe demo
fixtures. The core never imports them. The full map is in
[`src/core/libraryRegistry.ts`](./src/core/libraryRegistry.ts),
[`docs/LIBRARY_ROADMAP.md`](./docs/LIBRARY_ROADMAP.md), and
[`docs/RESEARCH_ADAPTERS.md`](./docs/RESEARCH_ADAPTERS.md). Optional Python
dependencies are in [`requirements-research.txt`](./requirements-research.txt)
(commented; not needed for `npm test` / `npm run build`).

## Claude use

See [`CLAUDE_USE.md`](./CLAUDE_USE.md) and the visible `.claude/agents/`,
`.claude/skills/`, and `.claude/commands/`.

## License

MIT. See [`LICENSE`](./LICENSE).
