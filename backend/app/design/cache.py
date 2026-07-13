"""Bounded in-memory cache for real RFdiffusion backbone outputs.

The public app can run a real GPU adapter, but a demonstration should not pay for the
same *unconditional* RFdiffusion request more than once while its API process is
running. The cache is deliberately keyed only by inputs that alter generated geometry:
model generation, number of designs, length, and optional contig. It never keys on a
protein name or objective unless those inputs are actually passed into RFdiffusion.

Entries live only in the API process. They expire after a short TTL and disappear when
the Container App restarts or rolls to a new revision. This is an acceleration layer,
never a scientific decision layer.
"""
from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from functools import lru_cache
import hashlib
import json
import os
from threading import RLock
import time
from typing import Any, Protocol

_SCHEMA = "rfdiffusion-unconditional-backbone-v1"
_DEFAULT_MAX_ENTRIES = 8
_DEFAULT_TTL_SECONDS = 6 * 60 * 60


def rfdiffusion_cache_key(*, model: str, n: int, length: int, contig: str | None) -> str:
    """Stable key for the exact geometry-producing RFdiffusion request.

    The current endpoint uses an unconditional monomer request when ``contig`` is
    absent. If motif conditioning is switched on later, the contig becomes part of
    the key automatically, preventing an unconditional backbone from being presented
    as a conditioned result.
    """
    payload = {
        "schema": _SCHEMA,
        "model": model,
        "n": int(n),
        "length": int(length),
        "contig": contig.strip() if isinstance(contig, str) and contig.strip() else None,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class DesignResultCache(Protocol):
    def get(self, key: str) -> dict[str, Any] | None: ...

    def put(self, key: str, value: dict[str, Any]) -> None: ...


class InMemoryDesignCache:
    """Thread-safe TTL/LRU cache with a deliberately small memory ceiling."""

    def __init__(self, *, max_entries: int = _DEFAULT_MAX_ENTRIES, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
        self._max_entries = max(1, max_entries)
        self._ttl_seconds = max(1, ttl_seconds)
        self._entries: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
        self._lock = RLock()

    def get(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._entries.pop(key, None)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= time.monotonic():
                return None
            # Reinsert at the end to mark a cache hit as most recently used.
            self._entries[key] = (expires_at, value)
            return deepcopy(value)

    def put(self, key: str, value: dict[str, Any]) -> None:
        with self._lock:
            self._entries.pop(key, None)
            self._entries[key] = (time.monotonic() + self._ttl_seconds, deepcopy(value))
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)


def _positive_int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, default)))
    except ValueError:
        return default


@lru_cache(maxsize=1)
def design_result_cache() -> DesignResultCache:
    """Return one bounded process-local cache for the lifetime of the API worker."""
    return InMemoryDesignCache(
        max_entries=_positive_int_env("NEBULA_RFDIFFUSION_CACHE_MAX_ENTRIES", _DEFAULT_MAX_ENTRIES),
        ttl_seconds=_positive_int_env("NEBULA_RFDIFFUSION_CACHE_TTL_SECONDS", _DEFAULT_TTL_SECONDS),
    )
