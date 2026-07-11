"""SQLite-backed run store.

Persists immutable-per-input RunState as JSON, keyed by run_id. Thread-safe via a
process lock (SQLite connection is created per call with check_same_thread=False).
An in-memory store is provided for tests.
"""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from ..contracts.enums import TERMINAL_STATUSES
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
            self._connect().close()  # ensure the schema exists at startup

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self._path, check_same_thread=False)
        # create the schema on EVERY connection (cheap + idempotent) so a deleted/rotated
        # DB file, or a fresh process, can never hit "no such table: runs" at runtime.
        con.execute(
            "CREATE TABLE IF NOT EXISTS runs ("
            "run_id TEXT PRIMARY KEY, fingerprint TEXT, status TEXT, json TEXT)"
        )
        return con

    def get(self, run_id: str) -> RunState | None:
        with self._lock:
            if self._path == ":memory:":
                raw = self._mem.get(run_id)
            else:
                with self._connect() as con:
                    row = con.execute("SELECT json FROM runs WHERE run_id=?", (run_id,)).fetchone()
                    raw = row[0] if row else None
        return RunState.model_validate_json(raw) if raw else None

    @staticmethod
    def _terminal(raw: str | None) -> bool:
        if not raw:
            return False
        try:
            return RunState.model_validate_json(raw).status in TERMINAL_STATUSES
        except Exception:
            return False

    def put(self, run: RunState) -> bool:
        """Store a state update without allowing stale workers to revive terminal runs."""
        raw = run.model_dump_json()
        with self._lock:
            if self._path == ":memory:":
                previous = self._mem.get(run.run_id)
                if self._terminal(previous) and previous != raw:
                    return False
                self._mem[run.run_id] = raw
            else:
                with self._connect() as con:
                    row = con.execute("SELECT json FROM runs WHERE run_id=?", (run.run_id,)).fetchone()
                    previous = row[0] if row else None
                    if self._terminal(previous) and previous != raw:
                        return False
                    con.execute(
                        "INSERT INTO runs(run_id,fingerprint,status,json) VALUES(?,?,?,?) "
                        "ON CONFLICT(run_id) DO UPDATE SET status=excluded.status, json=excluded.json",
                        (run.run_id, run.input_fingerprint, run.status.value, raw),
                    )
        return True

    def put_new(self, run: RunState) -> bool:
        """Insert a new attempt atomically; return False when the id already exists."""
        raw = run.model_dump_json()
        with self._lock:
            if self._path == ":memory:":
                if run.run_id in self._mem:
                    return False
                self._mem[run.run_id] = raw
                return True
            with self._connect() as con:
                cur = con.execute(
                    "INSERT OR IGNORE INTO runs(run_id,fingerprint,status,json) VALUES(?,?,?,?)",
                    (run.run_id, run.input_fingerprint, run.status.value, raw),
                )
                return cur.rowcount == 1

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

    def by_fingerprint(self, fingerprint: str) -> list[RunState]:
        """All attempts for one immutable input fingerprint, newest first."""
        return [run for run in self.all_runs() if run.input_fingerprint == fingerprint]
