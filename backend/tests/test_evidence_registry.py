"""Evidence-card registry: real DOIs, honest demo flags, resolvable route anchors, and 1-to-1
parity with the TypeScript source (src/core/fixtures/evidenceCards.ts) so the two never drift."""
from __future__ import annotations

import re
from pathlib import Path

from app.retrieval.evidence_cards import EVIDENCE_CARDS, ROUTE_ANCHORS, citations_for_route

_DOI = re.compile(r"^10\.\d{4,9}/\S+$")
_TS_CARDS = Path(__file__).resolve().parents[2] / "src" / "core" / "fixtures" / "evidenceCards.ts"


def test_public_cards_have_wellformed_dois() -> None:
    for card in EVIDENCE_CARDS.values():
        if card.provenance == "public_literature":
            assert card.citations, f"{card.id} is public_literature but uncited"
            for cit in card.citations:
                assert _DOI.match(cit.doi), f"{card.id}: malformed DOI {cit.doi!r}"


def test_demo_cards_carry_no_citation() -> None:
    for card in EVIDENCE_CARDS.values():
        if card.provenance == "demo_assumption":
            assert card.citations == (), f"{card.id}: a demo_assumption card must carry no citation"


def test_route_anchors_resolve() -> None:
    for route_id, ids in ROUTE_ANCHORS.items():
        assert ids, f"{route_id} has no anchors"
        for cid in ids:
            assert cid in EVIDENCE_CARDS, f"{route_id} anchors missing card {cid}"


def test_live_routes_yield_real_citations() -> None:
    # the five routes reachable via the shipped bench each surface >=1 real citation
    for route_id in (
        "route_lov_flavin_rp", "route_cry_fad_rp", "route_triplet_fp",
        "route_rfp_flavin_photo", "route_redox_electrochem",
    ):
        assert citations_for_route(route_id), f"{route_id} yields no citation"


def test_dois_match_typescript_source_1to1() -> None:
    # the Python registry DOIs equal the TS evidenceCards.ts DOIs exactly (no drift)
    ts = _TS_CARDS.read_text()
    ts_dois = set(re.findall(r'doi:\s*"([^"]+)"', ts))
    py_dois = {cit.doi for card in EVIDENCE_CARDS.values() for cit in card.citations}
    assert py_dois == ts_dois, f"DOI drift: only-in-py={py_dois - ts_dois} only-in-ts={ts_dois - py_dois}"
