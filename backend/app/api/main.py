"""Nebula Discover discovery API.

Compiles bounded objectives, retrieves public protein records, evaluates supported
mechanism routes, runs explicitly scoped calculations, and persists an immutable
measurement-triage run. A completed run is a hypothesis handoff, not validation.
"""
from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..contracts.candidate import CandidateDossier, CandidateRecord
from ..contracts.enums import TERMINAL_STATUSES, ProviderId, RunStatus
from ..contracts.objective import ObjectiveSpec, RawObjective
from ..contracts.run import RunCreated, RunEvent, RunState
from ..jobs.fingerprint import input_fingerprint, run_id_for
from ..jobs.orchestrator import orchestrate
from ..jobs.store import RunStore
from ..objective.compile import compile_objective
from ..providers.rcsb import RcsbProvider
from ..state.machine import assert_transition, progress_fraction
from .fixtures_static import INSTRUMENTS, ROUTES

OFFLINE = os.environ.get("NEBULA_OFFLINE", "0") == "1"
# Env-driven CORS (single-origin prod serves the SPA same-origin so this is unused there;
# the localhost default keeps dev working). Never ship the hardcoded localhost list.
CORS_ORIGINS = [o.strip() for o in os.environ.get("NEBULA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
# When set (in the container), FastAPI also serves the built React app from this dir.
STATIC_DIR = os.environ.get("NEBULA_STATIC_DIR")

PROVIDER_HEALTH_URLS = {
    ProviderId.uniprot: "https://rest.uniprot.org/uniprotkb/search?query=reviewed:true&size=1&fields=accession&format=json",
    ProviderId.interpro: "https://www.ebi.ac.uk/interpro/api/entry/interpro?page_size=1",
    ProviderId.rcsb: "https://data.rcsb.org/rest/v1/core/entry/5DKL",
    ProviderId.alphafold: "https://alphafold.ebi.ac.uk/api/prediction/P0DP23",
    ProviderId.fpbase: "https://www.fpbase.org/api/proteins/?slug=egfp&format=json",
}

app = FastAPI(
    title="Nebula Discover API",
    version="2.0.0",
    description="Public-protein discovery: retrieve → enrich → gate → simulate → rank. "
    "Outputs are unvalidated public-protein candidate hypotheses, never validated sensors.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORE = RunStore()
_BG_TASKS: set = set()
_MAX_ACTIVE_RUNS = max(1, int(os.environ.get("NEBULA_MAX_ACTIVE_RUNS", "2")))
_RUNS_PER_MINUTE = max(1, int(os.environ.get("NEBULA_RUNS_PER_MINUTE", "20")))
_SUPPORTED_SENSES = {"magnetic field", "radio-frequency field", "redox potential", "light history"}
_RUN_REQUESTS: dict[str, deque[float]] = defaultdict(deque)
_HEALTH_CACHE: tuple[float, bool, "Health"] | None = None
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-eval'; "  # 3Dmol currently uses dynamic function evaluation
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob:; "
    "connect-src 'self' https://rest.uniprot.org https://www.ebi.ac.uk https://data.rcsb.org "
    "https://files.rcsb.org https://alphafold.ebi.ac.uk https://www.fpbase.org; "
    "worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


def _rejection(status: int, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"detail": detail},
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@app.middleware("http")
async def harden_responses(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH"}:
        try:
            if int(request.headers.get("content-length", "0")) > 65_536:
                return _rejection(413, "Request body exceeds 64 KiB.")
        except ValueError:
            return _rejection(400, "Invalid Content-Length header.")
    if request.method == "POST" and request.url.path == "/api/runs":
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = _RUN_REQUESTS[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= _RUNS_PER_MINUTE:
            return _rejection(429, "Run request limit reached. Retry in one minute.")
        window.append(now)
        # bound the limiter dict on a public endpoint: sweep fully-expired keys when it grows
        if len(_RUN_REQUESTS) > 4096:
            for k in [k for k, w in _RUN_REQUESTS.items() if not w or now - w[-1] > 60]:
                _RUN_REQUESTS.pop(k, None)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = _CSP
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Health(BaseModel):
    status: str
    offline: bool
    providers: dict[str, bool]
    version: str


class CompileRequest(BaseModel):
    objective_text: str = Field(min_length=10, max_length=5000)
    user_mode: Literal["novice", "expert"] = "novice"
    instrument_id: str | None = Field(default=None, max_length=100)
    seed: int = Field(default=1337, ge=0, le=2_147_483_647)


class StructureResponse(BaseModel):
    source: str  # "experimental_pdb" | "alphafold_prediction"
    format: str  # "mmcif"
    pdb_id: str | None = None
    provider_url: str
    method: str | None = None
    resolution: float | None = None
    mean_plddt: float | None = None
    inline_cif: str | None = None  # populated for offline; else load provider_url client-side


@app.get("/api/health", response_model=Health)
async def health() -> Health:
    global _HEALTH_CACHE
    now = time.monotonic()
    if _HEALTH_CACHE is not None and _HEALTH_CACHE[1] == OFFLINE and now - _HEALTH_CACHE[0] < 30:
        return _HEALTH_CACHE[2]
    providers: dict[str, bool] = {}
    if OFFLINE:
        providers = {p.value: False for p in ProviderId}
    else:
        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "nebula-discover"}) as client:
            async def probe(pid: ProviderId, url: str) -> tuple[str, bool]:
                try:
                    r = await client.get(url)
                    return pid.value, r.status_code < 500
                except Exception:
                    return pid.value, False
            results = await asyncio.gather(*(probe(p, u) for p, u in PROVIDER_HEALTH_URLS.items()))
            providers = dict(results)
    if OFFLINE:
        status = "offline"
    elif providers and all(providers.values()):
        status = "ok"
    elif any(providers.values()):
        status = "degraded"
    else:
        status = "unavailable"
    result = Health(status=status, offline=OFFLINE, providers=providers, version=app.version)
    _HEALTH_CACHE = (now, OFFLINE, result)
    return result


@app.get("/api/routes")
async def routes() -> dict:
    return {"routes": ROUTES}


@app.get("/api/instruments")
async def instruments() -> dict:
    return {"instruments": INSTRUMENTS}


@app.post("/api/objectives/compile", response_model=ObjectiveSpec)
async def compile_endpoint(req: CompileRequest) -> ObjectiveSpec:
    raw = RawObjective(
        objective_text=req.objective_text,
        user_mode=req.user_mode,  # type: ignore[arg-type]
        instrument_id=req.instrument_id,
        seed=req.seed,
    )
    return compile_objective(raw)


def _new_run(objective: ObjectiveSpec, *, fingerprint: str | None = None, attempt: int = 0) -> RunState:
    fp = fingerprint or input_fingerprint(objective, objective.seed, objective.instrument_id)
    rid = run_id_for(fp, attempt)
    now = _now()
    return RunState(
        run_id=rid,
        input_fingerprint=fp,
        attempt=attempt,
        status=RunStatus.queued,
        seed=objective.seed,
        objective=objective,
        instrument_id=objective.instrument_id,
        current_stage="queued",
        created_at=now,
        updated_at=now,
        offline=OFFLINE,
        events=[RunEvent(at=now, to_status=RunStatus.queued, stage="queued", note="run created", progress=progress_fraction(RunStatus.queued))],
    )


@app.post("/api/runs", response_model=RunCreated, status_code=201)
async def create_run(body: dict) -> RunCreated:
    # Accept either a RawObjective (compile it) or a full ObjectiveSpec.
    try:
        if "desired_modalities" in body or "schema_version" in body:
            objective = ObjectiveSpec.model_validate(body)
        else:
            objective = compile_objective(RawObjective.model_validate(body))
    except Exception as exc:  # surfaced validation error — never bypassed
        raise HTTPException(status_code=422, detail=str(exc))

    sensed = (objective.sensed_quantity_or_state or "").strip().lower()
    if sensed not in _SUPPORTED_SENSES:
        supported = ", ".join(sorted(_SUPPORTED_SENSES))
        raise HTTPException(
            status_code=422,
            detail=f"This build cannot search '{sensed or 'an unstated target'}'. Supported sensing targets: {supported}.",
        )
    # Bound and deduplicate expert seeds before any provider I/O.
    objective = objective.model_copy(update={"seed_accessions": list(dict.fromkeys(objective.seed_accessions))})

    # Idempotency applies across attempts: a live or completed attempt is returned before
    # capacity is checked. Failed/cancelled attempts get a fresh run id so their old worker
    # can never race with the retry and overwrite it.
    fingerprint = input_fingerprint(objective, objective.seed, objective.instrument_id)
    prior = STORE.by_fingerprint(fingerprint)
    existing = next((r for r in prior if r.status not in (RunStatus.failed, RunStatus.cancelled)), None)
    if existing is not None:
        return RunCreated(run_id=existing.run_id, status=existing.status, input_fingerprint=existing.input_fingerprint)

    active = sum(1 for task in _BG_TASKS if not task.done())
    if active >= _MAX_ACTIVE_RUNS:
        raise HTTPException(status_code=429, detail="Discovery capacity is full. Retry after an active run completes.")

    attempt = max((r.attempt for r in prior), default=-1) + 1
    while True:
        run = _new_run(objective, fingerprint=fingerprint, attempt=attempt)
        if STORE.put_new(run):
            break
        collision = STORE.get(run.run_id)
        if collision is not None and collision.status not in (RunStatus.failed, RunStatus.cancelled):
            return RunCreated(run_id=collision.run_id, status=collision.status, input_fingerprint=collision.input_fingerprint)
        attempt += 1
    # Real orchestration runs off the event loop (providers use sync httpx). The
    # run advances retrieve → enrich → assess-physics in the background; clients
    # poll GET /api/runs/{id} or the events stream.
    task = asyncio.create_task(asyncio.to_thread(orchestrate, run.run_id, STORE, offline=OFFLINE))
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)
    return RunCreated(run_id=run.run_id, status=run.status, input_fingerprint=run.input_fingerprint)


@app.get("/api/runs/{run_id}", response_model=RunState)
async def get_run(run_id: str) -> RunState:
    run = STORE.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    return run


@app.get("/api/runs/{run_id}/events")
async def stream_events(run_id: str) -> StreamingResponse:
    """Real Server-Sent Events stream of run progress (not a static JSON list).

    Replays events so far, then streams new ones until the run is terminal.
    """
    if STORE.get(run_id) is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")

    async def gen():
        sent = 0
        for _ in range(600):  # ~cap; each iteration ~0.25s
            cur = STORE.get(run_id)
            if cur is None:
                break
            while sent < len(cur.events):
                yield f"data: {cur.events[sent].model_dump_json()}\n\n"
                sent += 1
            if cur.status in TERMINAL_STATUSES:
                yield f"event: end\ndata: {{\"status\":\"{cur.status.value}\"}}\n\n"
                return
            await asyncio.sleep(0.25)

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/api/runs/{run_id}/events.json", response_model=list[RunEvent])
async def get_events_json(run_id: str) -> list[RunEvent]:
    run = STORE.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    return run.events


@app.post("/api/runs/{run_id}/cancel", response_model=RunState)
async def cancel_run(run_id: str) -> RunState:
    run = STORE.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    try:
        assert_transition(run.status, RunStatus.cancelled)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    now = _now()
    last_progress = next((e.progress for e in reversed(run.events) if e.progress is not None), 0.0)
    run = run.model_copy(update={
        "status": RunStatus.cancelled,
        "current_stage": "cancelled",
        "updated_at": now,
        "events": [*run.events, RunEvent(at=now, from_status=run.status, to_status=RunStatus.cancelled, stage="cancelled", note="cancelled by user", progress=last_progress)],
    })
    STORE.put(run)
    return run


def _find_dossier(candidate_id: str) -> CandidateDossier:
    for run in STORE.all_runs():
        for d in run.dossiers:
            if d.candidate.candidate_id == candidate_id:
                return d
    raise HTTPException(status_code=404, detail=f"candidate {candidate_id} not found in any run")


@app.get("/api/candidates/{candidate_id}", response_model=CandidateRecord)
async def get_candidate(candidate_id: str) -> CandidateRecord:
    return _find_dossier(candidate_id).candidate


@app.get("/api/candidates/{candidate_id}/dossier", response_model=CandidateDossier)
async def get_dossier(candidate_id: str) -> CandidateDossier:
    return _find_dossier(candidate_id)


@app.get("/api/candidates/{candidate_id}/structure", response_model=StructureResponse)
async def get_structure(candidate_id: str) -> StructureResponse:
    """A structure source for Mol*. Prefers the experimental cofactor-bound PDB,
    falls back to the AlphaFold model. `inline_cif` is populated (from cache/fixture
    or a best-effort fetch) so the viewer works offline; otherwise the client loads
    `provider_url` directly (RCSB/AlphaFold both allow browser CORS)."""
    ev = _find_dossier(candidate_id).structural_evidence
    best_pdb = None
    for e in ev.pdb_entries:
        if best_pdb is None or (e.resolution_combined and (not best_pdb.resolution_combined or min(e.resolution_combined) < min(best_pdb.resolution_combined))):
            best_pdb = e
    if best_pdb is not None and best_pdb.coordinates_url:
        inline = None
        try:
            inline, _prov = RcsbProvider(offline=OFFLINE).coordinates(best_pdb.rcsb_id)
        except Exception:
            inline = None
        return StructureResponse(
            source="experimental_pdb", format="mmcif", pdb_id=best_pdb.rcsb_id,
            provider_url=best_pdb.coordinates_url, method=best_pdb.experimental_method,
            resolution=min(best_pdb.resolution_combined) if best_pdb.resolution_combined else None,
            inline_cif=inline,
        )
    af = ev.alphafold_model
    if af is not None and af.cif_url:
        return StructureResponse(
            source="alphafold_prediction", format="mmcif", pdb_id=None,
            provider_url=af.cif_url, method="AlphaFold2 (predicted)",
            mean_plddt=af.global_metric_value, inline_cif=None,
        )
    raise HTTPException(status_code=404, detail=f"no structure available for candidate {candidate_id}")


# --- static SPA (single-container prod) --------------------------------------
# When NEBULA_STATIC_DIR points at the built React app, serve it from this same
# service: hashed assets via StaticFiles, and an index.html fallback for every
# non-/api path so client deep-links work. Registered LAST so it never shadows /api.
# Absent in dev (Vite serves the SPA + proxies /api here), so this is a no-op there.
def _mount_spa() -> None:
    from pathlib import Path

    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    if not STATIC_DIR:
        return
    root = Path(STATIC_DIR)
    if not root.is_dir():
        return
    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:  # noqa: RUF029
        if full_path.startswith("api/") or full_path in ("openapi.json", "docs", "redoc"):
            raise HTTPException(status_code=404, detail="not found")
        candidate = root / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(root / "index.html"))


_mount_spa()
