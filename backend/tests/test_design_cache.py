from app.design.cache import InMemoryDesignCache, rfdiffusion_cache_key


def test_rfdiffusion_cache_key_tracks_actual_geometry_inputs():
    baseline = rfdiffusion_cache_key(model="rfdiffusion-base", n=3, length=100, contig=None)
    assert baseline == rfdiffusion_cache_key(model="rfdiffusion-base", n=3, length=100, contig=None)
    assert baseline != rfdiffusion_cache_key(model="rfdiffusion-base", n=3, length=120, contig=None)
    assert baseline != rfdiffusion_cache_key(model="rfdiffusion-base", n=3, length=100, contig="A1-50")


def test_memory_cache_is_bounded_and_returns_a_copy():
    cache = InMemoryDesignCache(max_entries=1, ttl_seconds=60)
    first = {"designs": [{"backbone_pdb": "first"}]}
    cache.put("first", first)
    result = cache.get("first")
    assert result == first
    result["designs"][0]["backbone_pdb"] = "mutated by caller"
    assert cache.get("first") == first

    cache.put("second", {"designs": [{"backbone_pdb": "second"}]})
    assert cache.get("first") is None
    assert cache.get("second") == {"designs": [{"backbone_pdb": "second"}]}


def test_memory_cache_expires(monkeypatch):
    now = [100.0]
    monkeypatch.setattr("app.design.cache.time.monotonic", lambda: now[0])
    cache = InMemoryDesignCache(max_entries=1, ttl_seconds=10)
    cache.put("key", {"designs": []})
    now[0] += 11
    assert cache.get("key") is None
