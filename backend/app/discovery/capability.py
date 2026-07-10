"""Capability extraction — what a real protein can physically offer.

From a CandidateRecord (real public evidence), build a CapabilityVector: the
substrate the frontier search composes mechanisms from. Everything here is read
off public annotations/structure; nothing is predicted.
"""
from __future__ import annotations

from ..contracts.candidate import CandidateRecord
from ..contracts.enums import ReadoutMode
from ..contracts.mechanism import CapabilityVector

_FLAVIN = ("fad", "fmn", "flavin", "riboflavin")
_METALS = ("iron", "heme", "fe-s", "iron-sulfur", "[2fe-2s]", "[4fe-4s]", "copper", "cu ", "zinc", "zn ",
           "manganese", "mn ", "nickel", "cobalt", "cobalamin", "molybdenum", "magnesium")
_CHROMO_KW = ("chromophore", "gfp", "fluorescent")


def _norm(items: list[str]) -> str:
    return " ".join(items).lower()


def extract_capability(candidate: CandidateRecord) -> CapabilityVector:
    u = candidate.uniprot
    acc = u.primary_accession if u else candidate.candidate_id
    cof_names = [c.name for c in candidate.cofactors]
    cof_blob = _norm(cof_names)
    fn_blob = _norm(u.functions) if u else ""
    kw_blob = _norm([k.name for k in (u.keywords if u else [])])

    has_flavin = any(f in cof_blob for f in _FLAVIN)
    metals = [c.name for c in candidate.cofactors if any(m in (c.name or "").lower() for m in _METALS)]
    metals += [m for m in _METALS if m.strip() in kw_blob and m.strip() not in cof_blob][:0]  # keep from cofactors only
    has_metal = bool(metals) or any(m in kw_blob for m in ("iron-sulfur", "heme", "metal"))
    redox = has_flavin or has_metal or any(k in fn_blob for k in ("redox", "electron transfer", "oxidoreductase", "electron transport"))
    chromo = any(k in kw_blob or k in fn_blob for k in _CHROMO_KW) or candidate.scaffold_family.value in ("fluorescent_protein", "RFP_plus_flavin")
    triplet = chromo  # triplet/dark states are a chromophore property (public photophysics)

    # structure confidence: prefer experimental resolution; else AlphaFold pLDDT/100
    has_exp = bool(candidate.pdb_entries)
    conf: float | None = None
    if has_exp and candidate.pdb_entries[0].resolution_combined:
        res = candidate.pdb_entries[0].resolution_combined[0]
        conf = max(0.0, min(1.0, 1.0 - (res - 1.0) / 3.0))  # 1.0A→1.0, 4.0A→0.0
    elif candidate.alphafold_model and candidate.alphafold_model.global_metric_value is not None:
        conf = round(candidate.alphafold_model.global_metric_value / 100.0, 3)

    readouts = list(candidate.readout_modes)
    optical = ReadoutMode.fluorescence in readouts
    magnetic = has_flavin or has_metal  # a spin-bearing center could exist
    electro = redox

    reviewed = bool(u and u.reviewed)
    ann_depth = min(1.0, ((len(u.functions) if u else 0) + len(candidate.interpro_matches) + len(candidate.cofactors)) / 8.0)
    struct_term = 0.2 if has_exp else (0.1 if candidate.alphafold_model else 0.0)
    evidence_conf = round(min(1.0, (0.5 if reviewed else 0.2) + 0.3 * ann_depth + struct_term), 3)

    return CapabilityVector(
        accession=acc,
        cofactors=cof_names,
        metals=metals,
        has_flavin=has_flavin,
        has_metal_open_shell=has_metal,
        redox_active=redox,
        chromophore=chromo,
        triplet_capable=triplet,
        domains=[m.name or m.interpro_accession for m in candidate.interpro_matches],
        binding_site_residues=[b.start for b in (u.binding_sites if u else [])],
        has_experimental_structure=has_exp,
        structure_confidence=conf,
        readouts_supported=readouts,
        optical=optical,
        magnetic_candidate=magnetic,
        electrochemical=electro,
        evidence_confidence=evidence_conf,
        notes=[] if (has_flavin or has_metal or chromo) else ["no obvious spin-bearing centre from public evidence"],
    )
