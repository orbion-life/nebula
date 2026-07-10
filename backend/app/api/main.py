"""Nebula Discover — discovery API (FastAPI).

Phase-1 skeleton: contracts, health with live provider reachability, deterministic
objective compilation, and the immutable run lifecycle over the state machine.
Real provider retrieval + orchestration land in Phase 2/3; runs created here sit
at `queued` until the orchestrator is wired, and that is stated honestly.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..contracts.enums import TERMINAL_STATUSES, ProviderId, RunStatus
from ..contracts.objective import ObjectiveSpec, RawObjective
from ..contracts.run import RunCreated, RunEvent, RunState
from ..jobs.fingerprint import input_fingerprint, run_id_for
from ..jobs.orchestrator import orchestrate
from ..jobs.store import RunStore
from ..objective.compile import compile_objective
from ..state.machine import assert_transition, progress_fraction
from .fixtures_static import INSTRUMENTS, ROUTES

OFFLINE = os.environ.get("NEBULA_OFFLINE", "0") == "1"

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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STORE = RunStore()
_BG_TASKS: set = set()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Health(BaseModel):
    status: str
    offline: bool
    providers: dict[str, bool]
    version: str


class CompileRequest(BaseModel):
    objective_text: str
    user_mode: str = "novice"
    instrument_id: str | None = None
    seed: int = 1337


@app.get("/api/health", response_model=Health)
async def health() -> Health:
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
    return Health(status="ok", offline=OFFLINE, providers=providers, version=app.version)


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


def _new_run(objective: ObjectiveSpec) -> RunState:
    fp = input_fingerprint(objective, objective.seed, objective.instrument_id)
    rid = run_id_for(fp)
    now = _now()
    return RunState(
        run_id=rid,
        input_fingerprint=fp,
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

    # idempotent: identical inputs → same run_id → return the cached run
    existing = STORE.get(run_id_for(input_fingerprint(objective, objective.seed, objective.instrument_id)))
    if existing is not None:
        return RunCreated(run_id=existing.run_id, status=existing.status, input_fingerprint=existing.input_fingerprint)

    run = _new_run(objective)
    STORE.put(run)
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
    run = run.model_copy(update={
        "status": RunStatus.cancelled,
        "current_stage": "cancelled",
        "updated_at": now,
        "events": [*run.events, RunEvent(at=now, from_status=run.status, to_status=RunStatus.cancelled, stage="cancelled", note="cancelled by user", progress=1.0)],
    })
    STORE.put(run)
    return run
