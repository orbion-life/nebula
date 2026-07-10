"""Offline test for the UniProt provider.

Reads the committed `Q43125` (CRY1_ARATH) fixture, exercises the real parse
path, and validates the normalized `UniProtRecord` plus fixture-mode provenance.
No network: the provider is constructed with `offline=True`.
"""
from __future__ import annotations

from app.contracts.enums import ProviderId, RetrievalMode
from app.contracts.providers import UniProtRecord
from app.providers.uniprot import UniProtProvider


def test_fetch_entry_q43125_offline() -> None:
    provider = UniProtProvider(offline=True)
    record, provenance = provider.fetch_entry("Q43125")

    # provenance: served from the committed fixture, not live
    assert provenance.mode == RetrievalMode.fixture
    assert provenance.provider == ProviderId.uniprot
    assert provenance.endpoint_url.startswith("https://rest.uniprot.org/uniprotkb/Q43125.json")

    # identity + review status (reviewed derived from entryType)
    assert isinstance(record, UniProtRecord)
    assert record.primary_accession == "Q43125"
    assert record.uniprotkb_id == "CRY1_ARATH"
    assert record.reviewed is True
    assert record.entry_type == "UniProtKB reviewed (Swiss-Prot)"

    # null-safe recommendedName.fullName.value
    assert record.protein_name == "Cryptochrome-1"

    # organism
    assert record.organism_scientific_name == "Arabidopsis thaliana"
    assert record.organism_common_name == "Mouse-ear cress"
    assert record.organism_tax_id == 3702

    # sequence block
    assert record.sequence_length == 681
    assert record.sequence is not None and len(record.sequence) == 681
    assert record.mol_weight_da is not None and record.mol_weight_da > 0

    # functions: comments[FUNCTION].texts[].value
    assert len(record.functions) >= 1
    assert all(isinstance(f, str) and f for f in record.functions)

    # cofactors: FAD (ChEBI:57692) + MTHF from two separate COFACTOR comments
    cofactor_names = {c.name for c in record.cofactors}
    assert "FAD" in cofactor_names
    fad = next(c for c in record.cofactors if c.name == "FAD")
    assert fad.chebi_id == "CHEBI:57692"
    assert fad.note is not None and "FAD" in fad.note
    assert len(record.cofactors) >= 2

    # subcellular locations: subcellularLocations[].location.value
    assert "Cytoplasm" in record.subcellular_locations
    assert "Nucleus" in record.subcellular_locations

    # binding sites: features[type=='Binding site']
    assert len(record.binding_sites) >= 1
    bs = record.binding_sites[0]
    assert bs.start >= 1 and bs.end >= bs.start
    assert any(b.ligand_name == "FAD" for b in record.binding_sites)

    # keywords
    assert len(record.keywords) >= 1
    assert any(k.name == "3D-structure" for k in record.keywords)

    # PDB xrefs with Method/Resolution/Chains properties
    assert len(record.pdb_xrefs) >= 1
    pdb = record.pdb_xrefs[0]
    assert pdb.method is not None
    assert pdb.resolution is not None
    assert pdb.chains is not None

    # AlphaFoldDB cross reference id
    assert record.alphafold_id == "Q43125"


def test_offline_without_fixture_is_unavailable() -> None:
    from app.providers.base import ProviderUnavailable

    provider = UniProtProvider(offline=True)
    try:
        provider.fetch_entry("P00000_nonexistent")
    except ProviderUnavailable as exc:
        assert exc.provider == ProviderId.uniprot
    else:
        raise AssertionError("expected ProviderUnavailable for a missing fixture")
