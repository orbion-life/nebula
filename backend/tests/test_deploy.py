"""Deploy-shape tests: single-container SPA serving + env-driven CORS.

The app reads NEBULA_STATIC_DIR / NEBULA_CORS_ORIGINS at import time, so we reload the
module with those set, assert behaviour, then reload once more (in finally) to restore
the default app for the rest of the suite.
"""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def test_spa_fallback_and_env_cors(tmp_path, monkeypatch) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>Nebula</title><div id=\"root\">app</div>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log('nebula')")
    monkeypatch.setenv("NEBULA_STATIC_DIR", str(tmp_path))
    monkeypatch.setenv("NEBULA_CORS_ORIGINS", "https://nebula.example.com")
    monkeypatch.setenv("NEBULA_OFFLINE", "1")

    from app.api import main as main_mod
    importlib.reload(main_mod)
    try:
        client = TestClient(main_mod.app)

        # SPA served at root and for client deep-links (non-/api paths → index.html)
        root = client.get("/")
        assert root.status_code == 200 and '<div id="root">' in root.text
        deep = client.get("/some/candidate/deep-link")
        assert deep.status_code == 200 and '<div id="root">' in deep.text

        # hashed asset served as a real file
        asset = client.get("/assets/app-abc123.js")
        assert asset.status_code == 200 and "nebula" in asset.text

        # the API is NOT shadowed by the SPA fallback
        health = client.get("/api/health")
        assert health.status_code == 200 and health.json()["status"] == "offline"
        assert client.get("/api/does-not-exist").status_code == 404  # unknown /api → 404, not index.html

        # CORS comes from the env, not the hardcoded localhost list
        assert main_mod.CORS_ORIGINS == ["https://nebula.example.com"]
    finally:
        # restore the default (no static dir / localhost CORS) module for other tests
        monkeypatch.undo()
        importlib.reload(main_mod)
