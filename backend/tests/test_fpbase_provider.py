"""FPbase provider tests — offline against the committed `egfp` fixture.

Deterministic: no network. The provider fetches the recorded fixture, parses the
1-element array into a normalized `FpbaseProtein`, and attaches fixture-mode
provenance with the FPbase reference-only license note.
"""
from __future__ import annotations

from app.contracts.enums import ProviderId, RetrievalMode
from app.contracts.providers import FpbaseProtein
from app.providers.fpbase import FpbaseProvider


def test_by_slug_egfp_offline() -> None:
    provider = FpbaseProvider(offline=True)

    record, provenance = provider.by_slug("egfp")

    # -- normalized record: real fields from the live egfp response -----------
    assert isinstance(record, FpbaseProtein)
    assert record.name == "EGFP"
    assert record.slug == "egfp"
    assert record.uuid == "R9NL8"
    assert record.uniprot == "C5MKY7"
    assert record.agg == "wd"
    assert record.switch_type == "b"
    assert record.doi == "10.1016/0378-1119(95)00685-0"
    assert record.pdb == ["2Y0G", "4EUL"]
    assert record.seq is not None and record.seq.startswith("MVSKGEELFTG")

    # -- photophysics live INSIDE states[] ------------------------------------
    assert len(record.states) == 1
    state = record.states[0]
    assert state.ex_max == 488
    assert state.em_max == 507
    assert state.qy == 0.6
    assert state.ext_coeff == 55900
    assert state.brightness == 33.54
    assert state.pka == 6.0
    assert state.lifetime == 2.6

    # -- provenance: fixture mode + reference-only license note ---------------
    assert provenance.provider == ProviderId.fpbase
    assert provenance.mode == RetrievalMode.fixture
    assert provenance.endpoint_url.endswith("/proteins/?slug=egfp&format=json")
    assert provenance.license_note is not None
    assert "CC-BY-SA" in provenance.license_note
    assert "reference only" in provenance.license_note


def test_no_photophysics_is_never_imputed() -> None:
    """Optional photophysics stay None; the parser must not invent values."""
    payload = [{"name": "Ghost", "slug": "ghost", "states": [{"name": "default"}]}]

    record = FpbaseProvider._parse(payload)

    assert record.name == "Ghost"
    assert record.pdb == []  # missing list defaults empty, not imputed
    assert record.uuid is None
    state = record.states[0]
    assert state.ex_max is None
    assert state.em_max is None
    assert state.qy is None
    assert state.brightness is None
    assert state.lifetime is None
