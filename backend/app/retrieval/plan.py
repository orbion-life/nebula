"""Mechanism-route query planning.

Compile an ObjectiveSpec into per-route UniProt query plans — reviewed (Swiss-Prot)
first — instead of scanning all of UniProt. Each plan names the mechanism route,
scaffold family, the required cofactor (ChEBI), and either explicit seed
accessions (expert / offline demo) or a Lucene query.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..contracts.enums import ReadoutMode, RouteClass, ScaffoldFamily
from ..contracts.objective import ObjectiveSpec


@dataclass(frozen=True)
class QueryPlan:
    route_id: str
    route_class: RouteClass
    scaffold_family: ScaffoldFamily
    lucene_query: str | None
    required_cofactor_name: str | None
    required_cofactor_chebi: str | None
    seed_accessions: tuple[str, ...] = field(default_factory=tuple)
    rationale: str = ""


# route → (scaffold, cofactor name, ChEBI, base Lucene query fragment)
_ROUTE_TEMPLATES: dict[RouteClass, tuple[ScaffoldFamily, str | None, str | None, str | None]] = {
    RouteClass.cryptochrome_fad_radical_pair: (ScaffoldFamily.cryptochrome_fad, "FAD", "CHEBI:57692", "cryptochrome"),
    RouteClass.lov_flavin_radical_pair: (ScaffoldFamily.lov_flavin, "FMN", "CHEBI:57618", '("LOV domain" OR phototropin OR "blue light" flavin)'),
    RouteClass.triplet_fp: (ScaffoldFamily.fluorescent_protein, "intrinsic chromophore", None, '("fluorescent protein" OR GFP)'),
    RouteClass.rfp_flavin_photochemical: (ScaffoldFamily.rfp_plus_flavin, "FMN", "CHEBI:57618", '(flavin AND fluorescent)'),
    RouteClass.redox_electrochemical: (ScaffoldFamily.redox_flavoprotein, "FAD", "CHEBI:57692", '(flavodoxin OR "flavin" AND redox)'),
}

_ROUTE_IDS: dict[RouteClass, str] = {
    RouteClass.cryptochrome_fad_radical_pair: "route_cry_fad_rp",
    RouteClass.lov_flavin_radical_pair: "route_lov_flavin_rp",
    RouteClass.triplet_fp: "route_triplet_fp",
    RouteClass.rfp_flavin_photochemical: "route_rfp_flavin_photo",
    RouteClass.redox_electrochemical: "route_redox_electrochem",
}


def _routes_for_readouts(readouts: list[ReadoutMode]) -> list[RouteClass]:
    want: list[RouteClass] = []
    rs = set(readouts)
    if ReadoutMode.rf_magnetic in rs:
        want += [RouteClass.cryptochrome_fad_radical_pair, RouteClass.lov_flavin_radical_pair]
    if ReadoutMode.odmr_like in rs:
        want += [RouteClass.triplet_fp, RouteClass.lov_flavin_radical_pair]
    if ReadoutMode.redox_electrochemical in rs:
        want += [RouteClass.redox_electrochemical]
    if ReadoutMode.fluorescence in rs and not want:
        want += [RouteClass.triplet_fp, RouteClass.rfp_flavin_photochemical]
    # de-dupe preserving order
    seen: set[RouteClass] = set()
    return [r for r in want if not (r in seen or seen.add(r))]


def plan_queries(objective: ObjectiveSpec, *, per_route: int = 6) -> list[QueryPlan]:
    reviewed = "" if objective.include_unreviewed else " AND reviewed:true"

    # expert override: explicit scaffold families and/or a raw query
    families = objective.target_scaffold_families
    route_classes: list[RouteClass]
    if families:
        fam_to_route = {v[0]: k for k, v in _ROUTE_TEMPLATES.items()}
        route_classes = [fam_to_route[f] for f in families if f in fam_to_route]
    else:
        route_classes = _routes_for_readouts(objective.desired_modalities or objective.acceptable_readouts)

    plans: list[QueryPlan] = []
    for rc in route_classes:
        scaffold, cofactor, chebi, frag = _ROUTE_TEMPLATES[rc]
        if objective.seed_query:
            query = objective.seed_query
        elif frag:
            cof_clause = f' AND cc_cofactor:"{cofactor}"' if cofactor and cofactor != "intrinsic chromophore" else ""
            query = f"({frag}){cof_clause}{reviewed}"
        else:
            query = None
        plans.append(QueryPlan(
            route_id=_ROUTE_IDS[rc],
            route_class=rc,
            scaffold_family=scaffold,
            lucene_query=query,
            required_cofactor_name=cofactor,
            required_cofactor_chebi=chebi,
            seed_accessions=tuple(objective.seed_accessions),
            rationale=f"{scaffold.value} route selected for readouts {[m.value for m in objective.desired_modalities]}",
        ))
    # material_state is a non-protein-retrieval route; handled separately downstream.
    return plans
