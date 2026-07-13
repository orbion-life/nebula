# Nebula

**Decide what deserves measurement next.**

[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)
&nbsp;·&nbsp; Built with Claude: Life Sciences
&nbsp;·&nbsp; [Open in your browser ↗](https://nebula-discover.greenforest-ed82ac43.westeurope.azurecontainerapps.io)

> ### 🔗 Try it now — no install
> **https://nebula-discover.greenforest-ed82ac43.westeurope.azurecontainerapps.io**

Nebula turns a **sensing objective** into a public-protein search across several sensing
modalities, and hands back the single experiment worth taking to a bench: a public accession, a
route-compatible instrument, its controls, its uncertainty, and the result that would prove it
wrong.

**It helps you decide what to measure next. It never claims a protein is a working sensor** — every
physics assumption is shown, and a built-in claim firewall keeps unvalidated results from being
dressed up as validated ones.

---

## What it does

```text
sensing target
  → an editable objective (beginner Mission Bench or expert contract)
  → mechanism-specific UniProt / InterPro / RCSB / AlphaFold search
  → annotation-checked protein + route hypotheses (no relabeling)
  → physics-eligibility gate  →  per-protein spin diagnostic on a real structure
  → separate "evidence" and "exploration" lanes
  → one decisive measurement: instrument · controls · uncertainty · falsifier
```

Five supported sensing targets, each routed to distinct readouts: **magnetic field**, **radio-frequency
field**, **redox potential**, **light history**, and **optical spin contrast** (ODMR-like).

---

## Quickstart

### 🐳 One command (Docker)

The whole app (React UI + FastAPI + physics) runs from a single container:

```bash
docker compose up --build
# → open http://localhost:8000
```

Add `NEBULA_OFFLINE=1 docker compose up --build` for a deterministic, no-network run (seed `1337`,
served from committed public fixtures — great for reproducible demos or CI).

### 🛠 Dev mode (hot reload, two terminals)

```bash
npm ci
python3 -m pip install -e './backend[dev,physics]'

# terminal 1 — API + live public-database retrieval
cd backend && python3 -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000
#   (prefix with NEBULA_OFFLINE=1 for the deterministic fixture replay)

# terminal 2 — Vite dev server
npm run dev
```

Open **http://127.0.0.1:5173**.

> The `physics` extra pulls PySCF/RadicalPy (needs a C toolchain). They're **optional** — both
> degrade gracefully, and the offline/fixture path doesn't need them. Drop `,physics` to skip.

---

## Bring your own GPU — real RFdiffusion backbones (optional)

Out of the box, the "generate a new backbone" lane produces **deterministic, clearly-labelled design
briefs** — no GPU, no credentials, no account. If you want **real de novo RFdiffusion coordinates**,
plug in **your own** Modal GPU. Nebula never holds your credentials and never runs it for you.

**1. Deploy the recipe to your Modal account:**

```bash
pip install modal
modal token new                                                   # sign in to YOUR Modal account
modal secret create nebula-rfdiffusion RFDIFFUSION_TOKEN=$(openssl rand -hex 24)
modal deploy infra/modal/rfdiffusion_modal.py
#   → prints your endpoint, e.g. https://<you>--nebula-rfdiffusion-generate.modal.run
```

**2. Point Nebula at your endpoint (keep these in an untracked `.env` — never commit them):**

```bash
export NEBULA_DESIGN_ADAPTER=modal
export NEBULA_MODAL_RFDIFFUSION_URL="https://<you>--nebula-rfdiffusion-generate.modal.run"
export NEBULA_MODAL_RFDIFFUSION_TOKEN="<the RFDIFFUSION_TOKEN from step 1>"
```

That's it — the generative frontier now shows real RFdiffusion backbones. Unset either variable and
it falls straight back to the deterministic preview.

**Your compute stays yours.** Nothing is baked into the image or committed; your endpoint is
token-gated so the URL alone can't spend your budget; and any error, timeout, or misconfiguration
degrades safely to the preview — a design step never breaks a run and never borrows someone else's
GPU. RFdiffusion (RosettaCommons, BSD-licensed) runs under your account and your acceptance of its
license. Full details, including per-protein motif conditioning: **[`docs/DESIGN_ADAPTERS.md`](./docs/DESIGN_ADAPTERS.md)**.

---

## Host it yourself

Nebula is a **single container** — FastAPI serves both the built React SPA (same origin, no CORS) and
the `/api` routes. Deploy that image anywhere containers run:

```bash
docker build -t nebula .
docker run -p 8000:8000 nebula
# → http://localhost:8000
```

**Configuration (all optional env vars):**

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEBULA_OFFLINE` | `0` | `0` = live public APIs; `1` = deterministic committed fixtures |
| `NEBULA_CORS_ORIGINS` | `""` | comma-separated allowed origins (same-origin needs none) |
| `NEBULA_STATIC_DIR` | `/app/dist` | where the built SPA is served from |
| `NEBULA_DESIGN_ADAPTER` + Modal vars | unset | opt-in real RFdiffusion (see above) |

- **Reference deployment:** the live app runs on **Azure Container Apps** via
  [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) (OIDC — no long-lived secrets in
  the repo). The same image runs on Cloud Run, Fly.io, Render, a VM, or your laptop.
- **Live quantum chemistry on arbitrary accessions:** the default image keeps QM cache-only (fast,
  slim). Build [`Dockerfile.physics`](./Dockerfile.physics) instead to compute it live.

---

## Scientific boundary

- Retrieved accessions/annotations are **public evidence, not validation**.
- A protein is assigned to a route **only** when its public family + cofactor annotations support it.
- The RadicalPy MARY curve is a versioned model-flavin **assumption sweep** for a mechanism class —
  not a candidate response prediction. The per-protein magnetic-field-effect number is a **coarse
  estimate under stated assumptions**, not a validated prediction.
- Triage axes (plausibility, measurability, novelty, uncertainty, information gain) are **uncalibrated
  heuristics**, not probabilities or predicted performance.
- The output is a **route-compatible measurement scenario**, not an equipment recommendation or proof
  of detectability.

See [`IP_BOUNDARY.md`](./IP_BOUNDARY.md) and [`docs/DATA_CONTRACTS.md`](./docs/DATA_CONTRACTS.md).

---

## How it's built

| Layer | Source |
| --- | --- |
| Objective contract + compiler | `backend/app/contracts/objective.py`, `backend/app/objective/compile.py` |
| Route planning + strict assembly | `backend/app/retrieval/` |
| Physics eligibility + spin diagnostics | `backend/app/physics/` |
| Mechanism graph + triage lanes | `backend/app/discovery/` |
| Run identity, storage, orchestration | `backend/app/jobs/` |
| FastAPI + generated TypeScript contract | `backend/app/api/main.py`, `src/contracts/api.ts` |
| Cinematic React experience | `src/ui/discover/` |

**Verify locally:**

```bash
npm test && npm run build          # TypeScript unit tests + production build
cd backend && python3 -m pytest -q # backend tests
cd .. && npm run e2e               # Playwright end-to-end (real browser)
```

**Built with Claude Code** as a visible, auditable panel — the project's agents, skills, commands, and
dated decision artifacts are in [`.claude/`](./.claude), [`CLAUDE_USE.md`](./CLAUDE_USE.md), and
[`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md). Claude never runs inside the product or produces
experimental evidence.

---

## Nebula's first user

**Aniruddh Goteti, founder of [Orbion](https://www.orbion.life), is Nebula's first user.** Orbion has
no in-house wet lab; before asking a quantum-sensing physicist to spend scarce measurement time, he
needs one supported public-protein hypothesis, the observable to measure, and the result that would
reject it. Nebula turns that live job into a measurement-scoping brief — not a claim of external
adoption or bench validation. First-use record:
[`artifacts/first-use/ANIRUDDH_FIRST_USE.md`](./artifacts/first-use/ANIRUDDH_FIRST_USE.md).

---

## License & contact

**[MIT](./LICENSE)** — free to use, fork, and build on.

Questions or collaboration: **Aniruddh Goteti** · [aniruddh.goteti@orbion.life](mailto:aniruddh.goteti@orbion.life) · [www.orbion.life](https://www.orbion.life)
