# Nebula Discover

**Built with Claude: Life Sciences** · Decide what deserves measurement first.

> 3-minute demo: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) · Submission pack: [`SUBMISSION.md`](./SUBMISSION.md) · Claude map: [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md)

**Decide what deserves measurement first.**

Nebula Discover is a public, open-source discovery-module concept for Nebula. It
turns a messy protein-sensor / biomaterials objective into public **construct
hypotheses**, transparent **mechanism routes**, **synthetic multimodal
measurement signatures**, rationale + uncertainty, a **measurement-worthiness**
ranking, and a claim-safe **measurement handoff**.

It is a small scientific instrument for asking:

> If this mechanism route were true, what would the experiment look like, what
> controls would be required, and what claim are we allowed to make?

## What it does

```text
sensing objective
  -> structured constraints
  -> public construct hypotheses
  -> mechanism routes
  -> physics data generation
  -> multimodal signal simulation
  -> rationale + uncertainty
  -> measurement-worthiness ranking
  -> measurement handoff
  -> mandatory adversarial swarm review
  -> falsification criteria + collaborator handoff
```

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
npm run dev      # open the local app
npm test         # run the deterministic + boundary test suite
npm run build    # typecheck + production build
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

| Module | File |
| --- | --- |
| Objective compiler | `src/core/objectiveCompiler.ts` |
| Public evidence cards (real, DOI-cited) | `src/core/fixtures/evidenceCards.ts` |
| Construct hypothesis generator | `src/core/constructGenerator.ts` |
| Mechanism router + route registry | `src/core/mechanismRouter.ts`, `src/core/fixtures/routes.ts` |
| Physics data generation | `src/core/physics.ts` |
| Multimodal simulator (deterministic) | `src/core/simulator.ts`, `src/core/rng.ts` |
| Rationale + evidence | `src/core/rationale.ts` |
| Measurement-worthiness ranking | `src/core/ranking.ts` |
| Design adapter (stub/precomputed) | `src/core/designAdapter.ts` |
| Claim firewall | `src/core/claimFirewall.ts` |
| Mandatory adversarial swarm | `src/core/swarm/` (see `docs/SWARM_ARCHITECTURE.md`) |
| Export (measurement handoff) | `src/core/export.ts` |
| Pipeline orchestrator | `src/core/pipeline.ts` |
| Tufte-style UI | `src/ui/` |

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
construct-hypothesis and measurement-worthiness *workflow*. Different parts of the
question are answered by different tools:

- **Public evidence sources** (UniProt, RCSB, AlphaFold DB, FPbase) ground a
  hypothesis in citable public data.
- **Embeddings / retrieval** (ESM, FAISS) find **public analogs** — never predict
  spin response.
- **Spin-dynamics & electronic-structure** tools (RadicalPy, QuTiP, PySCF) would
  deepen the *synthetic* mechanism sweep.
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
