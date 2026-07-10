"""Offline tests for the RCSB provider.

Both tests run with ``offline=True`` so they read the committed fixtures
(recorded from real RCSB responses) — no network. They validate the two-step
recon: a full-text + bound-cofactor search returns identifier/score hits, and a
single-entry fetch normalizes into the shared ``PdbEntry`` contract.
"""
from __future__ import annotations

from app.contracts.enums import ProviderId, RetrievalMode
from app.contracts.providers import PdbEntry, PdbSearchHit
from app.providers.rcsb import RcsbProvider


def test_search_lov_flavin_fmn_offline() -> None:
    provider = RcsbProvider(offline=True)
    hits, total, prov = provider.search("LOV domain flavin", "FMN")

    # Real query: ~99 hits including the Aureochrome LOV structure 5DKL.
    assert total == 99
    assert all(isinstance(h, PdbSearchHit) for h in hits)
    ids = {h.identifier for h in hits}
    assert "5DKL" in ids

    # Search carries ONLY identifier + score (no method/ligand detail).
    top = next(h for h in hits if h.identifier == "5DKL")
    assert top.score is not None

    assert prov.provider is ProviderId.rcsb
    assert prov.mode is RetrievalMode.fixture


def test_entry_5dkl_offline() -> None:
    provider = RcsbProvider(offline=True)
    entry, prov = provider.entry("5dkl")  # accepts lower-case; normalizes to 5DKL

    assert isinstance(entry, PdbEntry)
    assert entry.rcsb_id == "5DKL"
    assert entry.title is not None and "LOV" in entry.title
    assert entry.experimental_method == "X-RAY DIFFRACTION"
    assert entry.resolution_combined == [2.7]
    assert entry.nonpolymer_bound_components == ["FMN"]
    assert entry.coordinates_url == "https://files.rcsb.org/download/5DKL.cif"

    assert prov.provider is ProviderId.rcsb
    assert prov.mode is RetrievalMode.fixture
    assert prov.endpoint_url == "https://data.rcsb.org/rest/v1/core/entry/5DKL"
