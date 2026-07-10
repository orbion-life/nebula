"""AlphaFold Protein Structure Database provider.

Fetches a per-accession structure prediction summary from the EBI AlphaFold DB
(``GET /api/prediction/{accession}``) and normalizes it into an
:class:`AlphaFoldModel`. Everything travels with :class:`Provenance`; nothing is
imputed. This is a *public reference lookup* of a predicted model — not sensor
validation and not a spin-response prediction.

Recon gotchas handled here:

- The endpoint returns a JSON **array**, not an object. The per-model summary is
  element ``[0]``; an empty array means "no public model for this accession".
- Response keys are ``camelCase`` (``globalMetricValue``, ``cifUrl``,
  ``modelCreatedDate`` …) and are mapped explicitly to the ``snake_case``
  contract. ``globalMetricValue`` is the mean pLDDT (0–100).
- The optional ``fractionPlddt*`` confidence-band fields are only present on some
  models; each is read null-safe and left ``None`` when absent.
"""
from __future__ import annotations

from .base import Fetched, ProviderBase, ProviderUnavailable
from ..contracts.enums import ProviderId
from ..contracts.providers import AlphaFoldModel
from ..contracts.provenance import Provenance


class AlphaFoldProvider(ProviderBase):
    provider = ProviderId.alphafold
    release_header = None  # AlphaFold DB exposes no release header; version is in-body

    BASE = "https://alphafold.ebi.ac.uk"

    def model_for(self, accession: str) -> tuple[AlphaFoldModel, Provenance]:
        """Return the normalized AlphaFold model summary for a UniProt accession."""
        url = f"{self.BASE}/api/prediction/{accession}"
        fetched: Fetched = self.get_json(url, fixture_key=accession)
        model = self._parse(fetched.data, accession, url)
        return model, fetched.provenance

    def record(self, accession: str) -> AlphaFoldModel:
        """Fetch live and persist the committed offline fixture (recording only)."""
        url = f"{self.BASE}/api/prediction/{accession}"
        data = self.record_fixture(url, accession)
        return self._parse(data, accession, url)

    # -- parsing --------------------------------------------------------------
    def _parse(self, data: object, accession: str, url: str) -> AlphaFoldModel:
        if not isinstance(data, list):
            raise ProviderUnavailable(
                self.provider, url, f"expected a JSON array, got {type(data).__name__}"
            )
        if not data:
            raise ProviderUnavailable(
                self.provider, url, f"no public AlphaFold model for {accession}"
            )
        m = data[0]
        if not isinstance(m, dict):
            raise ProviderUnavailable(
                self.provider, url, f"array element [0] is {type(m).__name__}, not an object"
            )

        return AlphaFoldModel(
            entry_id=m.get("entryId") or accession,
            uniprot_accession=m.get("uniprotAccession") or accession,
            uniprot_id=m.get("uniprotId"),
            uniprot_description=m.get("uniprotDescription"),
            organism_scientific_name=m.get("organismScientificName"),
            tax_id=m.get("taxId"),
            sequence=m.get("sequence") or m.get("uniprotSequence"),
            global_metric_value=m.get("globalMetricValue"),
            fraction_plddt_very_low=m.get("fractionPlddtVeryLow"),
            fraction_plddt_low=m.get("fractionPlddtLow"),
            fraction_plddt_confident=m.get("fractionPlddtConfident"),
            fraction_plddt_very_high=m.get("fractionPlddtVeryHigh"),
            latest_version=m.get("latestVersion"),
            model_created_date=m.get("modelCreatedDate"),
            cif_url=m.get("cifUrl"),
            pdb_url=m.get("pdbUrl"),
            bcif_url=m.get("bcifUrl"),
        )
