# CLAUDE.md: operating guide for Nebula Discover

Nebula Discover is the public, open-source discovery module for deciding which
public protein and mechanism hypotheses deserve measurement next. It retrieves and
enriches public protein records, applies explicit mechanism and physics-eligibility
gates, separates evidence from exploration, and produces a measurement handoff with
controls and falsifiers.

It does not discover or validate working sensors, predict arbitrary protein magnetic
responses, or claim that sequence or structure determines spin behavior.

## Shipped execution path

```text
Mission Bench or expert objective
  -> backend ObjectiveSpec compiler
  -> sensed-quantity route planner
  -> UniProt retrieval
  -> InterPro + RCSB + AlphaFold enrichment
  -> family/cofactor route check
  -> physics eligibility
  -> optional bounded candidate cluster UHF diagnostic
  -> route-level measurement compatibility
  -> evidence and exploration lanes
  -> measurement handoff
```

Authoritative shipped modules:

- contracts: `backend/app/contracts/`
- objective compiler: `backend/app/objective/compile.py`
- route planning and assembly: `backend/app/retrieval/`
- physics gate and cluster calculation: `backend/app/physics/`
- mechanism and triage logic: `backend/app/discovery/`
- run identity, persistence, and orchestration: `backend/app/jobs/`
- API: `backend/app/api/main.py`
- generated browser contract: `src/contracts/api.ts`
- browser journey: `src/ui/discover/`

The deterministic TypeScript modules under `src/core/` remain tested public reference
code. They do not power the current browser journey. Do not describe them as live UI.

## Hard scientific rules

- A seed accession may enter only a route supported by its public family and cofactor
  annotations. Never replay every seed through every mechanism.
- Mission Bench targets must map to implemented route planning. Unsupported targets
  must fail explicitly.
- Product form, temperature, oxygen, expression host, and immobilization are handoff
  context until a tested decision rule consumes them. Never imply they move ranking.
- The RadicalPy MARY artifact is a shared model-flavin assumption sweep, not a
  candidate-specific biological response.
- The candidate UHF calculation is an isolated neutral-doublet isoalloxazine cluster
  diagnostic. Mulliken spin populations are basis dependent and are neither
  probabilities nor response predictions. Non-converged calculations are discarded.
- P, M, D, novelty, uncertainty, and information-gain values are uncalibrated triage
  dimensions. Never call them probabilities, confidence, or performance.
- A route-compatible instrument scenario is not a hardware recommendation or claim of
  detectability.
- Evidence and exploration lanes are separate. Novelty and uncertainty cannot increase
  plausibility or predicted performance.
- Outputs are unvalidated public-protein hypotheses requiring measurement.

## Runtime and reliability rules

- Identical active or completed inputs are idempotent.
- Failed and cancelled retries receive a new attempt ID.
- Terminal run states are immutable; stale workers cannot overwrite them.
- Run fingerprints include decision-bearing source hashes and the versioned physics
  artifact.
- User input, seed counts, concurrent runs, and run creation rate are bounded.
- The UI must remain usable without WebGL, under reduced motion, and from the keyboard.
- No progress counter may imply completion after failure or cancellation.

## Commands

```bash
npm ci
python3 -m pip install -e './backend[dev,physics]'

(cd backend && NEBULA_OFFLINE=1 python3 -m uvicorn app.api.main:app --port 8000)
npm run dev

npm test
npm run build
(cd backend && python3 -m pytest -q)
npm run e2e
npm audit --omit=dev
npm run gen:contracts
```

Do not weaken tests to obtain a pass. Regenerate the TypeScript OpenAPI contract after
changing Pydantic models.

## Claude workflow

Specialist agents and skills under `.claude/` are review and build tools, not product
features. Any factual or scientific claim raised by an agent must be verified against
source, tests, or a cited public reference before it enters product copy. Record
substantive Claude decisions in `artifacts/claude/` without exposing private data.

The project is a Built with Claude submission. Preserve truthful Claude attribution and
the public audit trail. Do not fabricate authorship, agent execution, validation, or
bench evidence.
