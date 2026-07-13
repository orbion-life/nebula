#!/usr/bin/env python3
"""Smoke-test a running Nebula container using only the Python stdlib.

Shallow mode checks the deployed SPA and API readiness. Full mode additionally
submits a deterministic public-fixture discovery objective and polls it through
the real background pipeline to a completed, decision-bearing result.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen


class SmokeFailure(RuntimeError):
    """A release-blocking smoke-test failure."""


def _endpoint(base_url: str, path: str) -> str:
    return urljoin(f"{base_url.rstrip('/')}/", path.lstrip("/"))


def _request(
    method: str,
    url: str,
    *,
    payload: dict[str, Any] | None = None,
    timeout: float = 15.0,
) -> tuple[int, dict[str, str], bytes]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "Accept": "application/json, text/html;q=0.9",
        "User-Agent": "nebula-container-smoke/1.0",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:1000]
        raise SmokeFailure(f"{method} {url} returned HTTP {exc.code}: {body}") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise SmokeFailure(f"{method} {url} failed: {exc}") from exc


def _json_body(method: str, url: str, *, payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    status, _headers, raw = _request(method, url, payload=payload)
    try:
        body = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        preview = raw[:500].decode("utf-8", errors="replace")
        raise SmokeFailure(f"{method} {url} did not return JSON: {preview}") from exc
    if not isinstance(body, dict):
        raise SmokeFailure(f"{method} {url} returned {type(body).__name__}, expected a JSON object")
    return status, body


def check_root(base_url: str) -> None:
    url = _endpoint(base_url, "/")
    status, headers, body = _request("GET", url)
    text = body.decode("utf-8", errors="replace")
    if status != 200:
        raise SmokeFailure(f"GET {url} returned HTTP {status}")
    if "text/html" not in headers.get("content-type", "") or '<div id="root"' not in text:
        raise SmokeFailure(f"GET {url} did not return the Nebula SPA shell")


def check_health(base_url: str) -> dict[str, Any]:
    url = _endpoint(base_url, "/api/health")
    status, body = _json_body("GET", url)
    if status != 200:
        raise SmokeFailure(f"GET {url} returned HTTP {status}")
    required = {"status", "offline", "providers", "design_adapter", "version"}
    missing = sorted(required - body.keys())
    if missing:
        raise SmokeFailure(f"GET {url} is missing health fields: {', '.join(missing)}")
    if body["status"] not in {"ok", "degraded", "offline"}:
        raise SmokeFailure(f"GET {url} reports non-ready status {body['status']!r}")
    return body


def wait_until_ready(base_url: str, timeout: float, interval: float) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            check_root(base_url)
            return check_health(base_url)
        except SmokeFailure as exc:
            last_error = exc
            time.sleep(interval)
    raise SmokeFailure(f"service did not become ready within {timeout:.0f}s: {last_error}")


def _smoke_objective() -> dict[str, Any]:
    return {
        "schema_version": "2.0.0",
        "objective_id": "container-release-smoke",
        "objective_text": "Prioritize public flavin protein candidates for weak magnetic-field measurement.",
        "user_mode": "expert",
        "sensed_quantity_or_state": "magnetic field",
        "desired_modalities": ["RF_magnetic", "fluorescence"],
        "acceptable_readouts": ["RF_magnetic", "fluorescence"],
        "objective_support": "supported",
        "objective_support_note": "Deterministic container release smoke using committed public fixtures.",
        "seed_accessions": ["Q8LPD9", "Q43125"],
        "seed": 20260713,
    }


def run_discovery(base_url: str, timeout: float, interval: float) -> dict[str, Any]:
    create_url = _endpoint(base_url, "/api/runs")
    status, created = _json_body("POST", create_url, payload=_smoke_objective())
    if status != 201:
        raise SmokeFailure(f"POST {create_url} returned HTTP {status}, expected 201")
    run_id = created.get("run_id")
    if not isinstance(run_id, str) or not run_id:
        raise SmokeFailure(f"POST {create_url} did not return a run_id")

    poll_url = _endpoint(base_url, f"/api/runs/{quote(run_id, safe='')}")
    deadline = time.monotonic() + timeout
    last_state: dict[str, Any] | None = None
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            poll_status, run = _json_body("GET", poll_url)
        except SmokeFailure as exc:
            last_error = exc
            time.sleep(interval)
            continue
        if poll_status != 200:
            last_error = SmokeFailure(f"GET {poll_url} returned HTTP {poll_status}")
            time.sleep(interval)
            continue
        last_state = run
        state = run.get("status")
        if state == "completed":
            _validate_completed_run(run)
            return run
        if state in {"failed", "cancelled"}:
            raise SmokeFailure(
                f"run {run_id} ended as {state}: stage={run.get('current_stage')!r}; "
                f"errors={run.get('errors')!r}"
            )
        last_error = None
        time.sleep(interval)
    detail = last_error or f"last state={last_state!r}"
    raise SmokeFailure(f"run {run_id} did not complete within {timeout:.0f}s: {detail}")


def _validate_completed_run(run: dict[str, Any]) -> None:
    candidates = run.get("candidates")
    scores = run.get("discovery_scores")
    proposals = run.get("measurement_proposals")
    selected = run.get("selected_candidate_id")
    if not isinstance(candidates, list) or not candidates:
        raise SmokeFailure("completed run has no public candidates")
    if not isinstance(scores, list) or not scores:
        raise SmokeFailure("completed run has no discovery scores")
    if not isinstance(proposals, list) or not proposals:
        raise SmokeFailure("completed run has no measurement proposals")
    candidate_ids = {candidate.get("candidate_id") for candidate in candidates if isinstance(candidate, dict)}
    if not isinstance(selected, str) or selected not in candidate_ids:
        raise SmokeFailure("completed run has no valid selected_candidate_id")
    selected_proposal = next(
        (proposal for proposal in proposals if isinstance(proposal, dict) and proposal.get("candidate_id") == selected),
        None,
    )
    experiment = selected_proposal.get("discriminating_experiment") if selected_proposal else None
    if not isinstance(experiment, dict) or not experiment.get("what_to_measure") or not experiment.get("kill_criterion"):
        raise SmokeFailure("selected candidate has no actionable discriminating experiment")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Container or deployment base URL")
    parser.add_argument("--mode", choices=("shallow", "full"), default="full")
    parser.add_argument("--startup-timeout", type=float, default=120.0)
    parser.add_argument("--run-timeout", type=float, default=120.0)
    parser.add_argument("--interval", type=float, default=1.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        health = wait_until_ready(args.base_url, args.startup_timeout, args.interval)
        print(
            f"READY {args.base_url.rstrip('/')} "
            f"status={health['status']} offline={health['offline']} version={health['version']}"
        )
        if args.mode == "full":
            run = run_discovery(args.base_url, args.run_timeout, args.interval)
            print(
                f"DISCOVERY run_id={run['run_id']} candidates={len(run['candidates'])} "
                f"selected={run['selected_candidate_id']} proposals={len(run['measurement_proposals'])}"
            )
        print(f"SMOKE PASS mode={args.mode}")
        return 0
    except SmokeFailure as exc:
        print(f"SMOKE FAIL mode={args.mode}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
