"""UniProtKB provider.

Fetches a public UniProtKB entry (or a search page) through
`ProviderBase.get_json` and normalizes the deeply nested JSON response into a
`UniProtRecord`. Nothing is invented: every field maps to a real response path
confirmed against the live `Q43125` (CRY1_ARATH) recon fixture, and optional
fields are left `None`/empty when the provider omits them.

Recon gotchas handled here:
- The JSON format toggles *nested* sections, not flat columns. `cc_function`,
  `cc_cofactor` and `cc_subcellular_location` all surface inside `comments[]`
  keyed by `commentType`; `ft_binding` surfaces inside `features[]` keyed by
  `type`; `xref_pdb`/`xref_alphafolddb` surface inside
  `uniProtKBCrossReferences[]` keyed by `database`.
- There can be MULTIPLE `COFACTOR` comments, each carrying its own
  `cofactors[]` list and a comment-level `note.texts[]`; the ChEBI id lives at
  `cofactor.cofactorCrossReference.id`.
- `proteinDescription.recommendedName.fullName.value` is null-safe: TrEMBL
  entries or fragments may omit `recommendedName` entirely.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote, urlencode

from ..contracts.enums import ProviderId
from ..contracts.providers import (
    BindingSite,
    CofactorRef,
    Keyword,
    PdbXref,
    UniProtRecord,
)
from ..contracts.provenance import Provenance
from .base import ProviderBase

_FIELDS = (
    "accession,id,protein_name,organism_name,sequence,length,"
    "cc_function,cc_cofactor,cc_subcellular_location,ft_binding,"
    "keyword,xref_pdb,xref_alphafolddb"
)


def _texts(container: Any) -> list[str]:
    """Return the non-empty `.value` strings from a `{texts: [{value}]}` block."""
    if not isinstance(container, dict):
        return []
    out: list[str] = []
    for t in container.get("texts") or []:
        if isinstance(t, dict):
            v = t.get("value")
            if isinstance(v, str) and v.strip():
                out.append(v)
    return out


class UniProtProvider(ProviderBase):
    provider = ProviderId.uniprot
    release_header = "x-uniprot-release"

    BASE = "https://rest.uniprot.org"

    # -- public API -----------------------------------------------------------
    def fetch_entry(self, accession: str) -> tuple[UniProtRecord, Provenance]:
        url = f"{self.BASE}/uniprotkb/{quote(accession)}.json?{urlencode({'fields': _FIELDS})}"
        fetched = self.get_json(url, fixture_key=accession)
        return self._parse_entry(fetched.data), fetched.provenance

    def search(
        self, query: str, fields: str | None = None, size: int = 10
    ) -> list[tuple[UniProtRecord, Provenance]]:
        params = {
            "query": query,
            "fields": fields or _FIELDS,
            "size": size,
            "format": "json",
        }
        url = f"{self.BASE}/uniprotkb/search?{urlencode(params)}"
        fixture_key = f"search_{self._fixture_key(query, fields or _FIELDS, size)}"
        fetched = self.get_json(url, fixture_key=fixture_key)
        results = (fetched.data or {}).get("results") or []
        return [(self._parse_entry(entry), fetched.provenance) for entry in results]

    @staticmethod
    def _fixture_key(query: str, fields: str, size: int) -> str:
        import hashlib

        raw = f"{query}|{fields}|{size}".encode()
        return hashlib.sha256(raw).hexdigest()[:24]

    # -- parsing --------------------------------------------------------------
    def _parse_entry(self, data: dict[str, Any]) -> UniProtRecord:
        entry_type = data.get("entryType")
        reviewed = isinstance(entry_type, str) and "reviewed" in entry_type.lower()

        organism = data.get("organism") or {}
        sequence = data.get("sequence") or {}

        comments = data.get("comments") or []
        features = data.get("features") or []
        xrefs = data.get("uniProtKBCrossReferences") or []

        return UniProtRecord(
            primary_accession=data.get("primaryAccession"),
            uniprotkb_id=data.get("uniProtkbId"),
            entry_type=entry_type,
            reviewed=reviewed,
            protein_name=self._protein_name(data),
            organism_scientific_name=organism.get("scientificName"),
            organism_common_name=organism.get("commonName"),
            organism_tax_id=organism.get("taxonId"),
            sequence=sequence.get("value"),
            sequence_length=sequence.get("length"),
            mol_weight_da=sequence.get("molWeight"),
            functions=self._functions(comments),
            cofactors=self._cofactors(comments),
            subcellular_locations=self._subcellular(comments),
            keywords=self._keywords(data.get("keywords") or []),
            binding_sites=self._binding_sites(features),
            pdb_xrefs=self._pdb_xrefs(xrefs),
            alphafold_id=self._alphafold_id(xrefs),
        )

    @staticmethod
    def _protein_name(data: dict[str, Any]) -> str | None:
        # null-safe: recommendedName / fullName may be absent (TrEMBL, fragments)
        desc = data.get("proteinDescription")
        if not isinstance(desc, dict):
            return None
        rec = desc.get("recommendedName")
        if not isinstance(rec, dict):
            return None
        full = rec.get("fullName")
        if not isinstance(full, dict):
            return None
        return full.get("value")

    @staticmethod
    def _functions(comments: list[dict[str, Any]]) -> list[str]:
        out: list[str] = []
        for c in comments:
            if c.get("commentType") == "FUNCTION":
                out.extend(_texts(c))
        return out

    @staticmethod
    def _cofactors(comments: list[dict[str, Any]]) -> list[CofactorRef]:
        out: list[CofactorRef] = []
        for c in comments:
            if c.get("commentType") != "COFACTOR":
                continue
            note_values = _texts(c.get("note"))
            note = " ".join(note_values) if note_values else None
            for cof in c.get("cofactors") or []:
                name = cof.get("name")
                if not name:
                    continue
                chebi_id = None
                xref = cof.get("cofactorCrossReference")
                if isinstance(xref, dict) and xref.get("database") == "ChEBI":
                    chebi_id = xref.get("id")
                out.append(CofactorRef(name=name, chebi_id=chebi_id, note=note))
        return out

    @staticmethod
    def _subcellular(comments: list[dict[str, Any]]) -> list[str]:
        out: list[str] = []
        for c in comments:
            if c.get("commentType") != "SUBCELLULAR LOCATION":
                continue
            for loc in c.get("subcellularLocations") or []:
                location = loc.get("location") if isinstance(loc, dict) else None
                if isinstance(location, dict):
                    val = location.get("value")
                    if isinstance(val, str) and val.strip():
                        out.append(val)
        return out

    @staticmethod
    def _keywords(keywords: list[dict[str, Any]]) -> list[Keyword]:
        out: list[Keyword] = []
        for kw in keywords:
            kw_id = kw.get("id")
            name = kw.get("name")
            if kw_id and name:
                out.append(Keyword(id=kw_id, category=kw.get("category"), name=name))
        return out

    @staticmethod
    def _binding_sites(features: list[dict[str, Any]]) -> list[BindingSite]:
        out: list[BindingSite] = []
        for f in features:
            if f.get("type") != "Binding site":
                continue
            location = f.get("location") or {}
            start = (location.get("start") or {}).get("value")
            end = (location.get("end") or {}).get("value")
            if start is None or end is None:
                continue
            ligand = f.get("ligand") or {}
            out.append(
                BindingSite(
                    start=start,
                    end=end,
                    ligand_name=ligand.get("name"),
                    ligand_id=ligand.get("id"),
                )
            )
        return out

    @staticmethod
    def _pdb_xrefs(xrefs: list[dict[str, Any]]) -> list[PdbXref]:
        out: list[PdbXref] = []
        for x in xrefs:
            if x.get("database") != "PDB":
                continue
            props = {
                p.get("key"): p.get("value")
                for p in (x.get("properties") or [])
                if isinstance(p, dict)
            }
            pdb_id = x.get("id")
            if not pdb_id:
                continue
            out.append(
                PdbXref(
                    id=pdb_id,
                    method=props.get("Method"),
                    resolution=props.get("Resolution"),
                    chains=props.get("Chains"),
                )
            )
        return out

    @staticmethod
    def _alphafold_id(xrefs: list[dict[str, Any]]) -> str | None:
        for x in xrefs:
            if x.get("database") == "AlphaFoldDB" and x.get("id"):
                return x.get("id")
        return None
