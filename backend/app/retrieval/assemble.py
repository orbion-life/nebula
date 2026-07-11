"""Candidate assembly — retrieve → enrich → cross-reference → CandidateRecord.

Turns query plans into normalized, real-accession candidates: UniProt entry →
InterPro domains → best structure (experimental PDB preferred, else AlphaFold) →
cofactor union → route/family assignment → rationale grounded in the real
annotations. Every provider call's provenance is collected; every failed
enrichment is recorded as an explicit `degradation`, never imputed.
"""
from __future__ import annotations

from typing import Callable

from ..contracts.candidate import CandidateRecord
from ..contracts.enums import ArchitectureKind, ClaimLevel, ReadoutMode, RouteClass, ScaffoldFamily
from ..contracts.providers import UniProtRecord
from ..contracts.provenance import Provenance
from ..providers import (
    AlphaFoldProvider,
    InterProProvider,
    ProviderUnavailable,
    RcsbProvider,
    UniProtProvider,
)
from .plan import QueryPlan

DEFAULT_FIELDS = (
    "accession,id,protein_name,organism_name,sequence,length,"
    "cc_function,cc_cofactor,cc_subcellular_location,ft_binding,keyword,xref_pdb,xref_alphafolddb"
)

# route metadata mirrored from src/core/fixtures/routes.ts
_ROUTE_META: dict[RouteClass, dict] = {
    RouteClass.cryptochrome_fad_radical_pair: dict(
        arch=ArchitectureKind.single_scaffold, readouts=[ReadoutMode.fluorescence, ReadoutMode.rf_magnetic],
        claim=ClaimLevel.diagnostic_only, route_id="route_cry_fad_rp",
        controls=["Illuminated no-field control", "Oxygen level control", "Photobleaching decay control"],
        confounders=["oxygen quenching", "photobleaching", "weak effect size"]),
    RouteClass.lov_flavin_radical_pair: dict(
        arch=ArchitectureKind.single_scaffold, readouts=[ReadoutMode.fluorescence, ReadoutMode.rf_magnetic, ReadoutMode.lifetime],
        claim=ClaimLevel.measurement_triage, route_id="route_lov_flavin_rp",
        controls=["Illuminated no-field control", "RF off/on paired control", "Photobleaching decay control", "Oxygen level control"],
        confounders=["photobleaching", "oxygen quenching", "temperature drift"]),
    RouteClass.triplet_fp: dict(
        arch=ArchitectureKind.fusion_reporter, readouts=[ReadoutMode.fluorescence, ReadoutMode.odmr_like, ReadoutMode.lifetime],
        claim=ClaimLevel.diagnostic_only, route_id="route_triplet_fp",
        controls=["RF off/on paired control", "Oxygen control (triplet quenching)", "Photobleaching decay control", "Temperature control"],
        confounders=["oxygen quenching", "low triplet yield", "photobleaching"]),
    RouteClass.rfp_flavin_photochemical: dict(
        arch=ArchitectureKind.single_scaffold, readouts=[ReadoutMode.fluorescence, ReadoutMode.lifetime],
        claim=ClaimLevel.measurement_triage, route_id="route_rfp_flavin_photo",
        controls=["Explicit light-history control", "Photobleaching decay control", "Dark-recovery control"],
        confounders=["photobleaching", "light-history ambiguity"]),
    RouteClass.redox_electrochemical: dict(
        arch=ArchitectureKind.electrode_coupled, readouts=[ReadoutMode.redox_electrochemical, ReadoutMode.fluorescence],
        claim=ClaimLevel.measurement_triage, route_id="route_redox_electrochem",
        controls=["Redox titration control", "Oxygen control", "pH control"],
        confounders=["oxygen", "pH cross-talk", "electrode fouling"]),
}


def _has_cofactor(rec: UniProtRecord, chebi: str | None, name: str | None) -> bool:
    if chebi:
        if any(c.chebi_id and chebi.split(":")[-1] in c.chebi_id for c in rec.cofactors):
            return True
    if name:
        if any(name.lower() in (c.name or "").lower() for c in rec.cofactors):
            return True
    return False


def _rationale(rec: UniProtRecord, plan: QueryPlan, has_cofactor: bool, has_experimental: bool) -> tuple[list[str], list[str]]:
    work: list[str] = []
    if has_cofactor and plan.required_cofactor_name:
        work.append(f"{plan.required_cofactor_name} cofactor is annotated in UniProt ({rec.primary_accession}), the redox/photo-active center this route needs.")
    if has_experimental:
        work.append("An experimental structure is available, so the cofactor pocket geometry can be inspected rather than assumed.")
    fn = " ".join(rec.functions[:1]).lower()
    if any(k in fn for k in ("blue light", "photoreceptor", "light")):
        work.append("UniProt function describes light-driven chemistry, consistent with the photochemical step of this route.")
    if not work:
        work.append("Scaffold family and readout are compatible with this mechanism route on the objective's readouts.")

    fail: list[str] = []
    if not has_cofactor:
        fail.append(f"Required cofactor ({plan.required_cofactor_name}) is NOT annotated for this accession — the mechanism may not apply.")
    if not has_experimental:
        fail.append("No experimental cofactor-bound structure; geometry must come from a prediction with stated uncertainty.")
    fail.append("Any spin/optical effect may be below the instrument noise floor; requires the mandatory controls.")
    return work, fail


def _matches_route(rec: UniProtRecord, plan: QueryPlan, interpro_matches: list, has_cofactor: bool) -> bool:
    """Reject accession/route pairings that public annotations do not support.

    Seed accessions are candidate *inputs*, not permission to relabel a phototropin as
    a cryptochrome (or vice versa). This deliberately prefers an honest omission over
    a larger but biologically mislabeled shortlist.
    """
    if plan.required_cofactor_name and plan.required_cofactor_name != "intrinsic chromophore" and not has_cofactor:
        return False
    blob = " ".join(
        [
            rec.protein_name or "",
            rec.uniprotkb_id or "",
            *rec.functions,
            *(m.name or m.interpro_accession for m in interpro_matches),
            *(k.name for k in rec.keywords),
        ]
    ).lower()
    if plan.route_class == RouteClass.cryptochrome_fad_radical_pair:
        return "cryptochrome" in blob and any("fad" in (c.name or "").lower() for c in rec.cofactors)
    if plan.route_class == RouteClass.lov_flavin_radical_pair:
        return any(k in blob for k in ("phototropin", "lov domain", "light oxygen voltage")) and any(
            "fmn" in (c.name or "").lower() for c in rec.cofactors
        )
    if plan.route_class == RouteClass.triplet_fp:
        return any(k in blob for k in ("fluorescent protein", "gfp", "rfp", "chromophore"))
    if plan.route_class == RouteClass.rfp_flavin_photochemical:
        return has_cofactor and any(k in blob for k in ("phototropin", "lov domain", "photoreceptor", "blue light"))
    if plan.route_class == RouteClass.redox_electrochemical:
        return has_cofactor and any(k in blob for k in ("redox", "oxidoreduct", "electron transfer", "flavodoxin"))
    return True


def _build_candidate(
    rec: UniProtRecord,
    prov: Provenance,
    plan: QueryPlan,
    ip: InterProProvider,
    rc: RcsbProvider,
    af: AlphaFoldProvider,
) -> CandidateRecord | None:
    meta = _ROUTE_META[plan.route_class]
    provenance: list[Provenance] = [prov]
    degradations: list[str] = []

    # domains
    interpro_matches = []
    try:
        res = ip.matches_for(rec.primary_accession)
        interpro_matches = res.matches
        provenance.append(res.provenance)
    except ProviderUnavailable:
        degradations.append("InterPro domains unavailable (offline or no fixture)")

    # structure: pick the BEST cofactor-bound experimental PDB (not just the first
    # xref), else AlphaFold. "Best" = has the required cofactor bound, then best
    # (lowest) resolution.
    pdb_entries = []
    alphafold_model = None
    has_experimental = False
    if rec.pdb_xrefs:
        req = (plan.required_cofactor_name or "").upper()
        best = None
        best_key: tuple[int, float] | None = None
        for xref in rec.pdb_xrefs[:4]:  # bound cost
            try:
                entry, ep = rc.entry(xref.id)
                provenance.append(ep)
            except ProviderUnavailable:
                degradations.append(f"RCSB entry {xref.id} unavailable")
                continue
            has_cof = 1 if any(req and req in (c or "").upper() for c in entry.nonpolymer_bound_components) else 0
            res = entry.resolution_combined[0] if entry.resolution_combined else 99.0
            key = (has_cof, -res)  # prefer cofactor-bound, then lower resolution
            if best_key is None or key > best_key:
                best_key, best = key, entry
        if best is not None:
            pdb_entries = [best]
            has_experimental = True
            if req and not any(req in (c or "").upper() for c in best.nonpolymer_bound_components):
                degradations.append(f"selected PDB {best.rcsb_id} does not resolve bound {req}; geometry is approximate")
    if not has_experimental and rec.alphafold_id:
        try:
            model, mp = af.model_for(rec.primary_accession)
            alphafold_model = model
            provenance.append(mp)
        except ProviderUnavailable:
            degradations.append("AlphaFold model unavailable")
    if not has_experimental and alphafold_model is None:
        degradations.append("no structure resolved (experimental or predicted)")

    has_cofactor = _has_cofactor(rec, plan.required_cofactor_chebi, plan.required_cofactor_name)
    if not _matches_route(rec, plan, interpro_matches, has_cofactor):
        return None
    work, fail = _rationale(rec, plan, has_cofactor, has_experimental)
    name = rec.protein_name or rec.uniprotkb_id or rec.primary_accession

    return CandidateRecord(
        candidate_id=f"cand_{rec.primary_accession}_{plan.route_class.value}",
        title=f"{name} ({rec.organism_scientific_name or 'unknown organism'}) — {plan.scaffold_family.value} candidate",
        scaffold_family=plan.scaffold_family,
        architecture_kind=meta["arch"],
        uniprot=rec,
        interpro_matches=interpro_matches,
        pdb_entries=pdb_entries,
        alphafold_model=alphafold_model,
        cofactors=rec.cofactors,
        readout_modes=meta["readouts"],
        mechanism_route_id=meta["route_id"],
        route_class=plan.route_class,
        why_it_might_work=work,
        why_it_might_fail=fail,
        required_controls=meta["controls"],
        confounders=meta["confounders"],
        claim_ceiling=meta["claim"],
        generated_by=f"generated from UniProt {rec.primary_accession} via {plan.route_class.value}",
        provenance=provenance,
        degradations=degradations,
    )


def assemble_candidates(
    plans: list[QueryPlan],
    *,
    offline: bool,
    per_route: int = 6,
    record: bool = False,
    on_candidate: Callable[[CandidateRecord], None] | None = None,
) -> list[CandidateRecord]:
    """Assemble candidates. `on_candidate` (if given) is called for each candidate as it
    is built — the orchestrator uses it to stream real accessions into the run/universe as
    they arrive, rather than in one atomic batch at the end of retrieval."""
    up = UniProtProvider(offline=offline, record=record)
    ip = InterProProvider(offline=offline, record=record)
    rc = RcsbProvider(offline=offline, record=record)
    af = AlphaFoldProvider(offline=offline, record=record)

    out: list[CandidateRecord] = []
    seen: set[str] = set()
    for plan in plans:
        records: list[tuple[UniProtRecord, Provenance]] = []
        if plan.seed_accessions:
            for acc in plan.seed_accessions:
                try:
                    records.append(up.fetch_entry(acc))
                except ProviderUnavailable:
                    continue
        elif plan.lucene_query:
            try:
                records = up.search(plan.lucene_query, fields=DEFAULT_FIELDS, size=per_route)
            except ProviderUnavailable:
                records = []
        for rec, prov in records:
            key = f"{rec.primary_accession}:{plan.route_class.value}"
            if key in seen:
                continue
            seen.add(key)
            cand = _build_candidate(rec, prov, plan, ip, rc, af)
            if cand is None:
                continue
            out.append(cand)
            if on_candidate is not None:
                on_candidate(cand)
    return out
