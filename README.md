# Nebula Discover

**Built with Claude: Life Sciences**

Nebula Discover turns a supported sensing objective into a public protein search
across multiple sensing modalities, returning mechanism hypotheses, explicit physics
assumptions, and a measurement handoff.
It helps decide what deserves measurement next. It does not claim that any protein
is a working sensor.

## Current public build

```text
sensing target
  -> ObjectiveSpec with active and handoff-only fields
  -> mechanism-specific UniProt query plans
  -> UniProt + InterPro + RCSB + AlphaFold enrichment
  -> annotation-checked protein / route hypotheses
  -> physics eligibility gate
  -> optional UHF cluster diagnostic on one structure-extracted flavin core
  -> route-level measurement compatibility
  -> separate evidence and exploration lanes
  -> controls, falsifier, uncertainty, and measurement handoff
```

The beginner Mission Bench supports four sensing targets in this build, each routing
to distinct readout modalities:

- magnetic field (magnetic and fluorescence readouts)
- radio frequency field (magnetic and fluorescence readouts)
- redox potential (electrochemical and fluorescence readouts)
- light history (fluorescence and lifetime readouts)

Product form, temperature, oxygen, host, and immobilization are retained for the
experiment handoff. The interface states when a field does not affect retrieval or
ranking. Unsupported sensing targets are rejected explicitly instead of being
silently mapped onto a familiar mechanism.

## Scientific boundary

- Retrieved accessions and annotations are public evidence, not validation.
- A protein is assigned to a route only when its public family and cofactor
  annotations support that route.
- The RadicalPy MARY curve is a versioned model-flavin assumption sweep shared by a
  mechanism class. It is not a candidate response prediction.
- Candidate-specific quantum chemistry is an isolated neutral-doublet
  isoalloxazine-cluster UHF diagnostic. Its Mulliken populations are basis dependent;
  the protein environment, radical partner, protonation alternatives, and dynamics
  are omitted.
- P, M, D, novelty, uncertainty, and information-gain values are uncalibrated triage
  axes, not probabilities or predicted performance.
- The final instrument is a route-compatible measurement scenario, not an equipment
  recommendation or proof of detectability.

See [`IP_BOUNDARY.md`](./IP_BOUNDARY.md) and
[`docs/DATA_CONTRACTS.md`](./docs/DATA_CONTRACTS.md).

## Run locally

```bash
npm ci
python3 -m pip install -e './backend[dev,physics]'

# terminal 1: deterministic public fixtures
cd backend
NEBULA_OFFLINE=1 python3 -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000

# terminal 2
npm run dev
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
npm test
npm run build
cd backend && python3 -m pytest -q
cd .. && npm run e2e
npm audit --omit=dev
```

The run store prevents a cancelled or failed worker from reviving a terminal run.
Retries get a separate attempt ID, and the input fingerprint includes the source hash
of decision-bearing pipeline code so stale results are not replayed after code changes.

## Shipped architecture

| Layer | Source |
| --- | --- |
| Objective contract and compiler | `backend/app/contracts/objective.py`, `backend/app/objective/compile.py` |
| Route planning and strict assembly | `backend/app/retrieval/plan.py`, `backend/app/retrieval/assemble.py` |
| Physics eligibility and cluster diagnostic | `backend/app/physics/` |
| Mechanism graph and triage lanes | `backend/app/discovery/` |
| Run identity, storage, orchestration | `backend/app/jobs/` |
| FastAPI and generated TypeScript contract | `backend/app/api/main.py`, `src/contracts/api.ts` |
| Cinematic React experience | `src/ui/discover/` |
| Public model-flavin reference artifact | `src/data/generated/radical_pair_mary.v1.json` |

The older deterministic TypeScript research modules under `src/core/` remain tested
as reusable public reference code. They do not power the current browser journey.

## Claude use

Claude's project agents, skills, commands, audit trail, and submission documentation are
visible in `.claude/`, [`CLAUDE_USE.md`](./CLAUDE_USE.md), and
[`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md).

## License

MIT. See [`LICENSE`](./LICENSE).
