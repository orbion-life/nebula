"""InterPro provider — domain/family/site annotations for a UniProt accession.

Fetches InterPro entries that match a protein via the public EBI endpoint
`GET /entry/interpro/protein/uniprot/{acc}/` and normalizes them into
`InterProMatch` records. Everything is retrieved through `ProviderBase.get_json`
(live → cache → recorded fixture), so the committed fixture makes the demo and
tests deterministic and offline. Nothing is imputed.

Recon gotchas handled here:
- The fragment status key is hyphenated in the payload (`dc-status`), not
  `dc_status`; read it explicitly.
- `metadata.go_terms` may be `null`; treat it as an empty list and keep only the
  canonical GO identifiers.
- Positional matches are nested `results[].proteins[].entry_protein_locations[]
  .fragments[]`; iterate EVERY protein, location, and fragment so discontinuous
  (multi-fragment / multi-location) matches are preserved in full.
- The response is a paged envelope (`count` / `next` / `previous`); aggregate
  `results` across pages, following `next` until it is `null`.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..contracts.enums import ProviderId
from ..contracts.providers import (
    InterProFragment,
    InterProLocation,
    InterProMatch,
)
from ..contracts.provenance import Provenance
from .base import ProviderBase

INTERPRO_BASE = "https://www.ebi.ac.uk/interpro/api"


@dataclass(frozen=True)
class InterProMatches:
    """Normalized InterPro record set plus the retrieval provenance it travels with."""

    matches: list[InterProMatch]
    provenance: Provenance
    count: int


class InterProProvider(ProviderBase):
    provider = ProviderId.interpro
    # EBI exposes the data release as the `interpro-version` response header
    # (httpx lowercases header keys), e.g. "109.0".
    release_header = "interpro-version"

    def matches_for(self, accession: str) -> InterProMatches:
        """Return the InterPro entries matching `accession`, with provenance.

        The provenance returned is that of the FIRST page fetch (the one whose
        exact URL and retrieval mode define the record set); subsequent pages,
        when present, are followed to complete `matches`.
        """
        url = f"{INTERPRO_BASE}/entry/interpro/protein/uniprot/{accession}/"
        fetched = self.get_json(url, fixture_key=accession)
        provenance = fetched.provenance

        envelope = fetched.data
        count = int(envelope.get("count") or 0)
        matches: list[InterProMatch] = []

        page = envelope
        page_index = 0
        while page is not None:
            for entry in page.get("results") or []:
                matches.append(self._parse_entry(entry))
            next_url = page.get("next")
            if not next_url:
                break
            page_index += 1
            # Distinct fixture key per follow-on page so offline recording stays
            # deterministic; the Q43125 fixture is a single page (next is null).
            page = self.get_json(
                next_url, fixture_key=f"{accession}_p{page_index}"
            ).data

        return InterProMatches(matches=matches, provenance=provenance, count=count)

    # -- parsing --------------------------------------------------------------
    @staticmethod
    def _parse_entry(entry: dict) -> InterProMatch:
        metadata = entry.get("metadata") or {}

        go_terms = [
            term["identifier"]
            for term in (metadata.get("go_terms") or [])
            if isinstance(term, dict) and term.get("identifier")
        ]

        locations: list[InterProLocation] = []
        for protein in entry.get("proteins") or []:
            for loc in protein.get("entry_protein_locations") or []:
                fragments = [
                    InterProFragment(
                        start=frag["start"],
                        end=frag["end"],
                        # payload key is hyphenated: "dc-status"
                        dc_status=frag.get("dc-status"),
                    )
                    for frag in (loc.get("fragments") or [])
                ]
                locations.append(
                    InterProLocation(
                        fragments=fragments,
                        representative=loc.get("representative"),
                        score=loc.get("score"),
                    )
                )

        return InterProMatch(
            interpro_accession=metadata["accession"],
            name=metadata.get("name"),
            entry_type=metadata.get("type"),
            source_database=metadata.get("source_database"),
            go_terms=go_terms,
            locations=locations,
        )
