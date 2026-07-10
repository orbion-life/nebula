"""SQLite-backed run store.

Persists immutable-per-input RunState as JSON, keyed by run_id. Thread-safe via a
process lock (SQLite connection is created per call with check_same_thread=False).
An in-memory store is provided for tests.
"""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from ..contracts.run import RunState

_DEFAULT_DB = Path(__file__).resolve().parents[2] / "artifacts" / "runs.sqlite"


class RunStore:
    def __init__(self, db_path: Path | str | None = None) -> None:
        self._path = ":memory:" if db_path == ":memory:" else str(db_path or _DEFAULT_DB)
        self._lock = threading.Lock()
        if self._path != ":memory:":
            Path(self._path).parent.mkdir(parents=True, exist_ok=True)
        self._mem: dict[str, str] = {}
        if self._path != ":memory:":
            with self._connect() as con:
                con.execute(
                    "CREATE TABLE IF NOT EXISTS runs ("
                    "run_id TEXT PRIMARY KEY, fingerprint TEXT, status TEXT, json TEXT)"
                )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._path, check_same_thread=False)

    def get(self, run_id: str) -> RunState | None:
        with self._lock:
            if self._path == ":memory:":
                raw = self._mem.get(run_id)
            else:
                with self._connect() as con:
                    row = con.execute("SELECT json FROM runs WHERE run_id=?", (run_id,)).fetchone()
                    raw = row[0] if row else None
        return RunState.model_validate_json(raw) if raw else None

    def put(self, run: RunState) -> None:
        raw = run.model_dump_json()
        with self._lock:
            if self._path == ":memory:":
                self._mem[run.run_id] = raw
            else:
                with self._connect() as con:
                    con.execute(
                        "INSERT INTO runs(run_id,fingerprint,status,json) VALUES(?,?,?,?) "
                        "ON CONFLICT(run_id) DO UPDATE SET status=excluded.status, json=excluded.json",
                        (run.run_id, run.input_fingerprint, run.status.value, raw),
                    )

    def exists(self, run_id: str) -> bool:
        return self.get(run_id) is not None

    def all_runs(self) -> list[RunState]:
        """Every persisted run, newest-first — backs candidate lookup by id."""
        with self._lock:
            if self._path == ":memory:":
                raws = list(self._mem.values())
            else:
                with self._connect() as con:
                    raws = [r[0] for r in con.execute("SELECT json FROM runs").fetchall()]
        runs = [RunState.model_validate_json(r) for r in raws]
        runs.sort(key=lambda r: r.created_at, reverse=True)
        return runs
