"""Offline test for the AlphaFold provider.

Reads the committed fixture (recorded live from the real accession P0DP23) and
validates that the parser produces a well-formed :class:`AlphaFoldModel` with the
key real fields, and that retrieval provenance reports ``fixture`` mode.
"""
from __future__ import annotations

from app.contracts.enums import ProviderId, RetrievalMode
from app.contracts.providers import AlphaFoldModel
from app.providers.alphafold import AlphaFoldProvider

ACCESSION = "P0DP23"  # Calmodulin-1 (CALM1_HUMAN), recorded fixture


def test_alphafold_model_for_offline_fixture() -> None:
    provider = AlphaFoldProvider(offline=True)
    model, prov = provider.model_for(ACCESSION)

    # -- parsed record: key real fields ------------------------------------
    assert isinstance(model, AlphaFoldModel)
    assert model.entry_id == "AF-P0DP23-F1"
    assert model.uniprot_accession == "P0DP23"
    assert model.uniprot_id == "CALM1_HUMAN"
    assert model.uniprot_description == "Calmodulin-1"
    assert model.organism_scientific_name == "Homo sapiens"
    assert model.tax_id == 9606

    # globalMetricValue -> global_metric_value (mean pLDDT, 0-100)
    assert model.global_metric_value == 85.25
    assert 0.0 <= model.global_metric_value <= 100.0

    # version + created date
    assert model.latest_version == 6
    assert model.model_created_date == "2025-08-01T00:00:00Z"

    # coordinate URLs mapped from camelCase
    assert model.cif_url == "https://alphafold.ebi.ac.uk/files/AF-P0DP23-F1-model_v6.cif"
    assert model.pdb_url == "https://alphafold.ebi.ac.uk/files/AF-P0DP23-F1-model_v6.pdb"
    assert model.bcif_url == "https://alphafold.ebi.ac.uk/files/AF-P0DP23-F1-model_v6.bcif"

    # optional fraction_plddt_* bands, present for this model
    assert model.fraction_plddt_very_low == 0.013
    assert model.fraction_plddt_low == 0.087
    assert model.fraction_plddt_confident == 0.456
    assert model.fraction_plddt_very_high == 0.443

    # sequence carried through (from `sequence`/`uniprotSequence`)
    assert model.sequence and model.sequence.startswith("MADQLTEEQIAEFKEAF")

    # -- provenance: served from the recorded fixture ----------------------
    assert prov.mode == RetrievalMode.fixture
    assert prov.provider == ProviderId.alphafold
    assert prov.endpoint_url == "https://alphafold.ebi.ac.uk/api/prediction/P0DP23"
    assert prov.http_status == 200
