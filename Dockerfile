# syntax=docker/dockerfile:1
# Single-container image for Azure Container Apps: the FastAPI service serves BOTH the
# built React SPA (same origin → no CORS) and the /api routes. SSE runs fine on ACA.
#
# pyscf is intentionally NOT installed — the committed content-addressed QM cache makes
# the demo flavin candidate's candidate-specific QM instant, and a novel accession
# degrades honestly to generic physics. For live QM on arbitrary accessions, build
# Dockerfile.physics instead.

# ---------- stage 1: build the React SPA ----------
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build            # → /web/dist (tsc --noEmit + vite build)

# ---------- stage 2: python runtime (serves SPA + /api) ----------
FROM python:3.11.14-slim-bookworm@sha256:65a93d69fa75478d554f4ad27c85c1e69fa184956261b4301ebaf6dbb0a3543d AS runtime
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
# libgomp1: OpenMP runtime some numpy/gemmi wheels link against
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# backend source + install. RadicalPy (the coarse per-protein MFE estimate) pulls MDAnalysis, which
# may need a compiler; install build tools only for this step and purge them so the runtime image
# stays slim. PySCF is still excluded (QM stays cache-only). estimate_mfe degrades to None if the
# import ever fails, so the app is safe even if radicalpy drops out. The QM cache + fixtures ship as
# package data.
COPY backend/ /app/backend/
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gfortran \
    && pip install ./backend \
    && apt-get purge -y build-essential gfortran && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
# versioned radical-pair reference artifact (scoring.py resolves it at /app/src/data/)
COPY src/data/generated/ /app/src/data/generated/
# built SPA from stage 1
COPY --from=web /web/dist /app/dist
RUN groupadd --gid 10001 nebula \
    && useradd --uid 10001 --gid nebula --create-home --shell /usr/sbin/nologin nebula \
    && chown -R nebula:nebula /app
ENV NEBULA_STATIC_DIR=/app/dist \
    NEBULA_OFFLINE=0 \
    NEBULA_CORS_ORIGINS=""
EXPOSE 8000
# run from the source tree so `app` (with its qm_cache/fixtures) is imported, cwd-first
WORKDIR /app/backend
USER 10001:10001
CMD ["python", "-m", "uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
