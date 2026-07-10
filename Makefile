# Nebula Discover — Phase 2 quickstart
.PHONY: help install api ui test test-api test-ui build contracts health

help:
	@echo "make install     - npm install + backend deps note"
	@echo "make api         - run the discovery API (uvicorn) on :8000"
	@echo "make ui          - run the Vite UI on :5173"
	@echo "make contracts   - regenerate TS contracts from the FastAPI OpenAPI"
	@echo "make test        - run backend (pytest) + frontend (vitest) suites"
	@echo "make build       - tsc --noEmit + vite build"

install:
	npm install
	@echo "Backend deps (already present in this env): fastapi pydantic httpx tenacity uvicorn biopython gemmi rdkit numpy scipy radicalpy; optional: pyscf, torch+fair-esm (isolated subprocesses)"

api:
	cd backend && python3 -m uvicorn app.api.main:app --reload --port 8000

ui:
	npm run dev

contracts:
	npm run gen:contracts

test-api:
	cd backend && python3 -m pytest -q

test-ui:
	npm test

test: test-api test-ui

build:
	npm run build

health:
	curl -s http://localhost:8000/api/health | python3 -m json.tool
