"""FPbase provider — public fluorescent-protein reference records.

FPbase (https://www.fpbase.org) is a community database of fluorescent proteins.
We use it strictly as a *public reference* for scaffold identity and reported
photophysics (excitation/emission maxima, quantum yield, extinction coefficient,
brightness, pKa, fluorescence lifetime). None of these values are sensor
predictions; they are literature/database descriptors of the wild-type or
published variant, and every value is Optional and never imputed — a missing
field stays `None`.

The `/proteins/` list endpoint returns a JSON **array** even for a single-slug
query, so `by_slug` takes element `[0]`. Photophysics live INSIDE each entry's
`states[]` (one protein can have several states, e.g. photoswitchable FPs), not
at the top level.
"""
from __future__ import annotations

from typing import Any

from ..contracts.enums import ProviderId
from ..contracts.providers import FpbaseProtein, FpbaseState
from ..contracts.provenance import Provenance
from .base import ProviderBase

# FPbase content is licensed CC-BY-SA 4.0. We retrieve it as public reference
# only (scaffold identity + reported photophysics), never as a validated sensor
# dataset and never for redistribution as such.
LICENSE_NOTE = (
    "FPbase content is CC-BY-SA 4.0; retrieved for public reference only "
    "(reported photophysics, not sensor validation or prediction)."
)


class FpbaseProvider(ProviderBase):
    provider = ProviderId.fpbase
    release_header = None  # FPbase exposes no release/version header

    BASE = "https://www.fpbase.org/api"

    def by_slug(self, slug: str) -> tuple[FpbaseProtein, Provenance]:
        """Fetch and normalize one FPbase protein by its slug.

        Returns the normalized `FpbaseProtein` plus retrieval `Provenance`
        (with the FPbase license note attached).
        """
        url = f"{self.BASE}/proteins/?slug={slug}&format=json"
        fetched = self.get_json(url, fixture_key=slug)
        record = self._parse(fetched.data)
        provenance = fetched.provenance.model_copy(update={"license_note": LICENSE_NOTE})
        return record, provenance

    @staticmethod
    def _parse(payload: Any) -> FpbaseProtein:
        # The list endpoint returns a 1-element array for a single-slug query.
        if not isinstance(payload, list) or not payload:
            raise ValueError("FPbase returned no matching protein for the requested slug")
        rec = payload[0]

        states = [
            FpbaseState(
                # Only contract fields — FPbase state objects also carry
                # `slug`/`maturation`, which the (extra='forbid') model rejects.
                name=s.get("name"),
                ex_max=s.get("ex_max"),
                em_max=s.get("em_max"),
                qy=s.get("qy"),
                ext_coeff=s.get("ext_coeff"),
                brightness=s.get("brightness"),
                pka=s.get("pka"),
                lifetime=s.get("lifetime"),
            )
            for s in (rec.get("states") or [])
        ]

        return FpbaseProtein(
            name=rec["name"],
            slug=rec["slug"],
            uuid=rec.get("uuid"),
            seq=rec.get("seq"),
            agg=rec.get("agg"),
            switch_type=rec.get("switch_type"),
            uniprot=rec.get("uniprot"),
            pdb=rec.get("pdb") or [],
            doi=rec.get("doi"),
            states=states,
        )
