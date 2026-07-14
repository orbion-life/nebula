# Script index

Operational helpers are grouped by purpose. Run commands from the repository root unless a row says otherwise.

| Purpose | Script | Notes |
| --- | --- | --- |
| README media | [`capture_screenshots.mjs`](./capture_screenshots.mjs) | Captures the six consistent 1280×720 product-tour frames from a running deployment. Review every frame before committing. |
| Frontend budget | [`check_bundle_budget.mjs`](./check_bundle_budget.mjs) | Checks the built initial JavaScript chunk in `dist/assets` against the raw and gzip budgets. |
| Release smoke test | [`container_smoke.py`](./container_smoke.py) | Checks a running SPA/API; full mode also submits and polls a deterministic fixture-backed discovery run. |
| Offline demo data | [`index/build_offline_index.py`](./index/build_offline_index.py) | Records the curated public-data fixtures and warms the candidate-specific physics cache. Requires network access; run from `backend/`. |
| Physics reference artifact | [`physics/radical_pair_mary.py`](./physics/radical_pair_mary.py) | Generates the versioned RadicalPy reference artifact with assumptions and provenance attached. |
| Optional numerical cross-check | [`solve_ivp_crosscheck.py`](./solve_ivp_crosscheck.py) | Compares the TypeScript photokinetic proxy with SciPy `solve_ivp`; not part of the normal build. |

Generated `__pycache__` content is local build debris and is excluded from version control.
