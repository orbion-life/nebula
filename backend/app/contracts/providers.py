"""Normalized provider records.

Every field maps to a real response path confirmed in the recon (nothing
invented). Optional fields are `None` when the provider omits them — never
imputed. Each record travels with `Provenance`.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class _Rec(BaseModel):
    model_config = ConfigDict(extra="forbid")


# -- UniProt ------------------------------------------------------------------
class CofactorRef(_Rec):
    name: str
    chebi_id: str | None = None
    note: str | None = None


class PdbXref(_Rec):
    id: str
    method: str | None = None
    resolution: str | None = None
    chains: str | None = None


class BindingSite(_Rec):
    start: int
    end: int
    ligand_name: str | None = None
    ligand_id: str | None = None


class Keyword(_Rec):
    id: str
    category: str | None = None
    name: str


class UniProtRecord(_Rec):
    primary_accession: str
    uniprotkb_id: str | None = None
    entry_type: str | None = None  # reviewed (Swiss-Prot) | unreviewed (TrEMBL)
    reviewed: bool = False
    protein_name: str | None = None  # may be absent — null-safe
    organism_scientific_name: str | None = None
    organism_common_name: str | None = None
    organism_tax_id: int | None = None
    sequence: str | None = None
    sequence_length: int | None = None
    mol_weight_da: int | None = None
    functions: list[str] = Field(default_factory=list)
    cofactors: list[CofactorRef] = Field(default_factory=list)
    subcellular_locations: list[str] = Field(default_factory=list)
    keywords: list[Keyword] = Field(default_factory=list)
    binding_sites: list[BindingSite] = Field(default_factory=list)
    pdb_xrefs: list[PdbXref] = Field(default_factory=list)
    alphafold_id: str | None = None


# -- InterPro -----------------------------------------------------------------
class InterProFragment(_Rec):
    start: int
    end: int
    dc_status: str | None = None


class InterProLocation(_Rec):
    fragments: list[InterProFragment] = Field(default_factory=list)
    representative: bool | None = None
    score: float | None = None


class InterProMatch(_Rec):
    interpro_accession: str
    name: str | None = None
    entry_type: str | None = None  # domain | family | homologous_superfamily | ...
    source_database: str | None = None
    go_terms: list[str] = Field(default_factory=list)
    locations: list[InterProLocation] = Field(default_factory=list)


# -- RCSB ---------------------------------------------------------------------
class PdbCofactor(_Rec):
    comp_id: str
    name: str | None = None
    description: str | None = None
    formula: str | None = None
    formula_weight_da: float | None = None
    auth_asym_ids: list[str] = Field(default_factory=list)


class PdbEntry(_Rec):
    rcsb_id: str
    title: str | None = None
    experimental_method: str | None = None
    resolution_combined: list[float] = Field(default_factory=list)
    nonpolymer_bound_components: list[str] = Field(default_factory=list)
    polymer_entity_count: int | None = None
    nonpolymer_entity_count: int | None = None
    cofactors: list[PdbCofactor] = Field(default_factory=list)
    coordinates_url: str | None = None  # files.rcsb.org/download/{id}.cif


class PdbSearchHit(_Rec):
    identifier: str
    score: float | None = None


# -- AlphaFold ----------------------------------------------------------------
class AlphaFoldModel(_Rec):
    entry_id: str
    uniprot_accession: str
    uniprot_id: str | None = None
    uniprot_description: str | None = None
    organism_scientific_name: str | None = None
    tax_id: int | None = None
    sequence: str | None = None
    global_metric_value: float | None = None  # mean pLDDT (0-100)
    fraction_plddt_very_low: float | None = None
    fraction_plddt_low: float | None = None
    fraction_plddt_confident: float | None = None
    fraction_plddt_very_high: float | None = None
    latest_version: int | None = None
    model_created_date: str | None = None
    cif_url: str | None = None
    pdb_url: str | None = None
    bcif_url: str | None = None


# -- FPbase -------------------------------------------------------------------
class FpbaseState(_Rec):
    name: str | None = None
    ex_max: float | None = None
    em_max: float | None = None
    qy: float | None = None
    ext_coeff: float | None = None
    brightness: float | None = None
    pka: float | None = None
    lifetime: float | None = None


class FpbaseProtein(_Rec):
    name: str
    slug: str
    uuid: str | None = None
    seq: str | None = None
    agg: str | None = None  # oligomerization code ('' -> unknown)
    switch_type: str | None = None
    uniprot: str | None = None
    pdb: list[str] = Field(default_factory=list)
    doi: str | None = None
    states: list[FpbaseState] = Field(default_factory=list)
