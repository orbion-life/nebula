"""RCSB PDB provider — two-step recon: full-text search, then per-entry detail.

The recon separates two RCSB services that speak different response shapes:

1. **Search** (``search.rcsb.org/rcsbsearch/v2/query``) takes a URL-encoded JSON
   query and returns only ``result_set[].{identifier, score}`` plus a
   ``total_count``. It carries NO method/ligand/title detail — that is a
   deliberate gotcha: the caller must resolve each identifier through step 2.
2. **Entry** (``data.rcsb.org/rest/v1/core/entry/{id}``) returns the full entry
   document (``struct.title``, ``exptl[].method``,
   ``rcsb_entry_info.resolution_combined``,
   ``rcsb_entry_info.nonpolymer_bound_components``, …).

Every fetch goes through :meth:`ProviderBase.get_json`, so live / cached /
fixture selection and :class:`Provenance` are handled uniformly. Coordinates are
not fetched here — we synthesize the canonical ``files.rcsb.org`` CIF URL so a
downstream consumer can pull structure only if it needs it.
"""
from __future__ import annotations

import json
import re
import urllib.parse

from ..contracts.enums import ProviderId
from ..contracts.providers import PdbEntry, PdbSearchHit
from ..contracts.provenance import Provenance
from .base import ProviderBase

_SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query"
_ENTRY_URL = "https://data.rcsb.org/rest/v1/core/entry/{pdb_id}"
_COORDINATES_URL = "https://files.rcsb.org/download/{pdb_id}.cif"

# Bound-cofactor filter attribute. NOTE (recon gotcha): the entry-level field
# ``rcsb_entry_info.nonpolymer_bound_components`` is NOT search-enabled — the
# search service rejects it with HTTP 400. The searchable equivalent is the
# entity-container identifier below.
_COMP_ID_ATTRIBUTE = (
    "rcsb_nonpolymer_entity_container_identifiers.nonpolymer_comp_id"
)


def _sanitize(text: str) -> str:
    """Collapse a free-text query into a filesystem-safe fixture-key fragment."""
    slug = re.sub(r"[^A-Za-z0-9]+", "_", text.strip().lower()).strip("_")
    return slug or "query"


class RcsbProvider(ProviderBase):
    """Search RCSB PDB and normalize entries into the shared contracts."""

    provider = ProviderId.rcsb
    release_header = None  # RCSB search/data APIs expose no release/version header

    # -- step 1: search -------------------------------------------------------
    def _build_query(self, text: str, comp_id: str | None, rows: int) -> dict:
        full_text = {
            "type": "terminal",
            "service": "full_text",
            "parameters": {"value": text},
        }
        if comp_id:
            query_node: dict = {
                "type": "group",
                "logical_operator": "and",
                "nodes": [
                    full_text,
                    {
                        "type": "terminal",
                        "service": "text",
                        "parameters": {
                            "attribute": _COMP_ID_ATTRIBUTE,
                            "operator": "exact_match",
                            "value": comp_id,
                        },
                    },
                ],
            }
        else:
            query_node = full_text
        return {
            "query": query_node,
            "return_type": "entry",
            "request_options": {
                "paginate": {"start": 0, "rows": rows},
                "results_content_type": ["experimental"],
            },
        }

    def _search_url(self, text: str, comp_id: str | None, rows: int) -> str:
        query = self._build_query(text, comp_id, rows)
        encoded = urllib.parse.quote(json.dumps(query, separators=(",", ":")))
        return f"{_SEARCH_URL}?json={encoded}"

    def _parse_search(self, data: dict) -> tuple[list[PdbSearchHit], int]:
        result_set = data.get("result_set") or []
        hits = [
            PdbSearchHit(identifier=item["identifier"], score=item.get("score"))
            for item in result_set
        ]
        total = int(data.get("total_count", len(hits)))
        return hits, total

    def search(
        self,
        text: str,
        comp_id: str | None = None,
        *,
        rows: int = 100,
    ) -> tuple[list[PdbSearchHit], int, Provenance]:
        """Full-text search (optionally bound-cofactor filtered).

        Returns ``(hits, total_count, provenance)``. Hits carry only identifier
        and relevance score — resolve each through :meth:`entry` for detail.
        """
        url = self._search_url(text, comp_id, rows)
        fetched = self.get_json(url, fixture_key=f"search_{_sanitize(text)}")
        hits, total = self._parse_search(fetched.data)
        return hits, total, fetched.provenance

    # -- step 2: entry --------------------------------------------------------
    def _parse_entry(self, data: dict) -> PdbEntry:
        rcsb_id = data["rcsb_id"]
        struct = data.get("struct") or {}
        entry_info = data.get("rcsb_entry_info") or {}

        methods = [
            m.get("method")
            for m in (data.get("exptl") or [])
            if m.get("method")
        ]
        experimental_method = "; ".join(methods) if methods else None

        return PdbEntry(
            rcsb_id=rcsb_id,
            title=struct.get("title"),
            experimental_method=experimental_method,
            resolution_combined=list(entry_info.get("resolution_combined") or []),
            nonpolymer_bound_components=list(
                entry_info.get("nonpolymer_bound_components") or []
            ),
            polymer_entity_count=entry_info.get("polymer_entity_count"),
            nonpolymer_entity_count=entry_info.get("nonpolymer_entity_count"),
            coordinates_url=_COORDINATES_URL.format(pdb_id=rcsb_id),
        )

    def entry(self, pdb_id: str) -> tuple[PdbEntry, Provenance]:
        """Fetch and normalize a single PDB entry by identifier."""
        pid = pdb_id.strip().upper()
        url = _ENTRY_URL.format(pdb_id=pid)
        fetched = self.get_json(url, fixture_key=f"entry_{pid}")
        return self._parse_entry(fetched.data), fetched.provenance

    def coordinates(self, pdb_id: str) -> tuple[str, Provenance]:
        """Download the mmCIF coordinate file (for candidate-specific physics)."""
        pid = pdb_id.strip().upper()
        url = f"https://files.rcsb.org/download/{pid}.cif"
        return self.get_text(url, fixture_key=f"coords_{pid}")
