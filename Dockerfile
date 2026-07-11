# syntax=docker/dockerfile:1
# Single-container image for Azure Container Apps: the FastAPI service serves BOTH the
# built React SPA (same origin → no CORS) and the /api routes. SSE runs fine on ACA.
#
# pyscf is intentionally NOT installed — the committed content-addressed QM cache makes
# the demo flavin candidate's candidate-specific QM instant, and a novel accession
# degrades honestly to generic physics. For live QM on arbitrary accessions, build
# Dockerfile.physics instead.

# ---------- stage 1: build the React SPA ----------
FROM node:22-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build            # → /web/dist (tsc --noEmit + vite build)

# ---------- stage 2: python runtime (serves SPA + /api) ----------
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
# libgomp1: OpenMP runtime some numpy/gemmi wheels link against
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# backend source + install (fastapi/pydantic/httpx/tenacity/uvicorn/biopython/gemmi/
# numpy/scipy/radicalpy — NO pyscf). The QM cache + fixtures ship as package data.
COPY backend/ /app/backend/
RUN pip install ./backend
# versioned radical-pair reference artifact (scoring.py resolves it at /app/src/data/…)
COPY src/data/generated/ /app/src/data/generated/
# built SPA from stage 1
COPY --from=web /web/dist /app/dist
ENV NEBULA_STATIC_DIR=/app/dist \
    NEBULA_OFFLINE=0 \
    NEBULA_CORS_ORIGINS=""
EXPOSE 8000
# run from the source tree so `app` (with its qm_cache/fixtures) is imported, cwd-first
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
