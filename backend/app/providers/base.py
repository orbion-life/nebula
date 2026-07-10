"""Shared provider infrastructure.

Every provider fetches through `ProviderBase.get_json`, which gives, in order of
preference: live HTTP (with tenacity retry/backoff honoring Retry-After) → on-disk
cache → recorded offline fixture → explicit `unavailable`. Every call yields a
`Provenance` (exact URL, status, release header, mode). Fixtures are recorded from
live responses via `record_fixture` and committed so the demo runs offline and
tests are deterministic. Nothing is ever imputed.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..contracts.enums import ProviderId, RetrievalMode
from ..contracts.provenance import Provenance

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
CACHE_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "provider_cache"
CACHE_TTL_SECONDS = 12 * 3600
USER_AGENT = "nebula-discover/2.0 (public-protein discovery; contact via repo)"


class ProviderUnavailable(RuntimeError):
    def __init__(self, provider: ProviderId, url: str, reason: str) -> None:
        super().__init__(f"{provider.value} unavailable for {url}: {reason}")
        self.provider = provider
        self.url = url
        self.reason = reason


class _Retryable(Exception):
    pass


@dataclass
class Fetched:
    data: Any
    provenance: Provenance


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


class ProviderBase:
    provider: ProviderId
    release_header: str | None = None  # e.g. "x-uniprot-release"

    def __init__(self, *, offline: bool = True, timeout: float = 15.0) -> None:
        self.offline = offline
        self.timeout = timeout
        self._fx = FIXTURES_DIR / self.provider.value
        self._cache = CACHE_DIR / self.provider.value

    # -- fixtures -------------------------------------------------------------
    def _fixture_path(self, fixture_key: str) -> Path:
        safe = fixture_key.replace("/", "_")
        return self._fx / f"{safe}.json"

    def _load_fixture(self, fixture_key: str) -> Any | None:
        p = self._fixture_path(fixture_key)
        if p.exists():
            return json.loads(p.read_text())
        return None

    def record_fixture(self, url: str, fixture_key: str, *, headers: dict | None = None) -> Any:
        """Fetch a live response and persist it as a committed offline fixture."""
        h = {"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})}
        with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
            r = client.get(url, headers=h)
            r.raise_for_status()
            data = r.json()
        self._fx.mkdir(parents=True, exist_ok=True)
        self._fixture_path(fixture_key).write_text(json.dumps(data, indent=1))
        return data

    # -- cache ----------------------------------------------------------------
    def _cache_get(self, url: str) -> Any | None:
        p = self._cache / f"{_key(url)}.json"
        if p.exists() and (time.time() - p.stat().st_mtime) < CACHE_TTL_SECONDS:
            try:
                return json.loads(p.read_text())
            except Exception:
                return None
        return None

    def _cache_put(self, url: str, data: Any) -> None:
        self._cache.mkdir(parents=True, exist_ok=True)
        (self._cache / f"{_key(url)}.json").write_text(json.dumps(data))

    # -- fetch ----------------------------------------------------------------
    def get_json(
        self,
        url: str,
        *,
        fixture_key: str,
        headers: dict | None = None,
        accept: str = "application/json",
    ) -> Fetched:
        prov_kw = dict(provider=self.provider, endpoint_url=url, retrieved_at=_now())

        if self.offline:
            fx = self._load_fixture(fixture_key)
            if fx is not None:
                return Fetched(fx, Provenance(mode=RetrievalMode.fixture, http_status=200, **prov_kw))
            raise ProviderUnavailable(self.provider, url, "offline and no recorded fixture")

        cached = self._cache_get(url)
        if cached is not None:
            return Fetched(cached, Provenance(mode=RetrievalMode.cached, http_status=200, **prov_kw))

        try:
            data, status, hdrs = self._http_get(url, headers=headers, accept=accept)
            self._cache_put(url, data)
            return Fetched(
                data,
                Provenance(
                    mode=RetrievalMode.live,
                    http_status=status,
                    source_release=hdrs.get(self.release_header) if self.release_header else None,
                    cache_control=hdrs.get("cache-control"),
                    etag=hdrs.get("etag"),
                    **prov_kw,
                ),
            )
        except Exception as exc:  # last resort: recorded fixture, else explicit unavailable
            fx = self._load_fixture(fixture_key)
            if fx is not None:
                return Fetched(fx, Provenance(mode=RetrievalMode.fixture, http_status=None, **prov_kw))
            raise ProviderUnavailable(self.provider, url, f"live fetch failed and no fixture: {exc}")

    @retry(
        retry=retry_if_exception_type(_Retryable),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        reraise=True,
    )
    def _http_get(self, url: str, *, headers: dict | None, accept: str) -> tuple[Any, int, dict]:
        h = {"User-Agent": USER_AGENT, "Accept": accept, **(headers or {})}
        with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
            r = client.get(url, headers=h)
            if r.status_code == 429 or r.status_code >= 500:
                ra = r.headers.get("retry-after")
                if ra:
                    try:
                        time.sleep(min(float(ra), 8.0))
                    except ValueError:
                        pass
                raise _Retryable(f"status {r.status_code}")
            r.raise_for_status()
            return r.json(), r.status_code, dict(r.headers)
