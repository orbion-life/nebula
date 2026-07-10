"""Offline test for the InterPro provider.

Reads the committed Q43125 fixture (recorded live from
`GET /entry/interpro/protein/uniprot/Q43125/`) and validates the normalized
`InterProMatch` records plus fixture-mode provenance. No network required.
"""
from __future__ import annotations

from app.contracts.enums import ProviderId, RetrievalMode
from app.providers.interpro import InterProProvider

ACCESSION = "Q43125"  # CRY1, Arabidopsis thaliana — a real UniProt accession


def test_interpro_matches_for_q43125_offline() -> None:
    provider = InterProProvider(offline=True)
    result = provider.matches_for(ACCESSION)

    # (4) provenance travels with the record and is served from the fixture
    assert result.provenance.mode == RetrievalMode.fixture
    assert result.provenance.provider == ProviderId.interpro
    assert result.provenance.http_status == 200
    assert result.provenance.endpoint_url.endswith(f"/uniprot/{ACCESSION}/")

    # page envelope: count matches number of parsed entries (single page)
    assert result.count == 9
    assert len(result.matches) == 9

    by_acc = {m.interpro_accession: m for m in result.matches}

    # (3) key real fields of a specific entry parse correctly
    fam = by_acc["IPR002081"]
    assert fam.name == "Cryptochrome/DNA photolyase class 1"
    assert fam.entry_type == "family"
    assert fam.source_database == "interpro"
    # positional match: fragment start/end and the hyphenated dc-status key
    assert len(fam.locations) == 1
    frag = fam.locations[0].fragments[0]
    assert (frag.start, frag.end) == (13, 512)
    assert frag.dc_status == "CONTINUOUS"

    # go_terms: null in most entries, populated (as GO identifiers) in IPR014134
    assert fam.go_terms == []
    go_entry = by_acc["IPR014134"]
    assert "GO:0009882" in go_entry.go_terms
    assert "GO:0009785" in go_entry.go_terms

    # ALL fragments preserved across multiple locations (IPR018394 has two)
    multi = by_acc["IPR018394"]
    assert len(multi.locations) == 2
    spans = {
        (f.start, f.end)
        for loc in multi.locations
        for f in loc.fragments
    }
    assert spans == {(339, 351), (359, 378)}

    # every parsed match satisfies the Pydantic contract (extra="forbid")
    assert all(isinstance(m, type(fam)) for m in result.matches)
