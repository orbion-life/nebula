"""Controlled vocabularies for Nebula Discover Phase 2.

Mirrored 1:1 from the TypeScript domain schema (`src/core/types.ts`) so the two
sides never drift, plus Phase-2 additions for retrieval, physics eligibility, and
run state. These are the authoritative source; the TS contracts are generated
from the FastAPI OpenAPI that references them.
"""
from __future__ import annotations

from enum import Enum


class ReadoutMode(str, Enum):
    fluorescence = "fluorescence"
    lifetime = "lifetime"
    rf_magnetic = "RF_magnetic"
    odmr_like = "ODMR_like"
    redox_electrochemical = "redox_electrochemical"
    material_state = "material_state"


class MaterialContext(str, Enum):
    hydrogel = "hydrogel"
    film = "film"
    chip = "chip"
    cell = "cell"
    solution = "solution"
    wearable = "wearable"
    unknown = "unknown"


class ExpressionHost(str, Enum):
    bacteria = "bacteria"
    yeast = "yeast"
    mammalian = "mammalian"
    cell_free = "cell_free"
    unknown = "unknown"


class ScaffoldFamily(str, Enum):
    lov_flavin = "LOV_flavin"
    cryptochrome_fad = "cryptochrome_FAD"
    fluorescent_protein = "fluorescent_protein"
    rfp_plus_flavin = "RFP_plus_flavin"
    metal_cofactor = "metal_cofactor"
    redox_flavoprotein = "redox_flavoprotein"
    material_composite = "material_composite"
    unsupported = "unsupported"


class ArchitectureKind(str, Enum):
    single_scaffold = "single_scaffold"
    fusion_reporter = "fusion_reporter"
    co_encapsulated_pair = "co_encapsulated_pair"
    surface_immobilized = "surface_immobilized"
    electrode_coupled = "electrode_coupled"
    material_composite = "material_composite"


class RouteClass(str, Enum):
    lov_flavin_radical_pair = "LOV_flavin_radical_pair"
    cryptochrome_fad_radical_pair = "cryptochrome_FAD_radical_pair"
    triplet_fp = "triplet_FP"
    rfp_flavin_photochemical = "RFP_flavin_photochemical"
    redox_electrochemical = "redox_electrochemical"
    material_state = "material_state"
    metal_cofactor_confounder = "metal_cofactor_confounder"
    unsupported = "unsupported"


class ClaimLevel(str, Enum):
    diagnostic_only = "diagnostic_only"
    measurement_triage = "measurement_triage"
    partner_ready_dossier = "partner_ready_dossier"


class Uncertainty(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ParameterSourceType(str, Enum):
    database = "database"
    literature = "literature"
    assumption = "assumption"
    instrument = "instrument"
    user_constraint = "user_constraint"
    computed = "computed"  # Phase-2: PySCF/RadicalPy computed value


# -- Phase-2 additions --------------------------------------------------------


class ProviderId(str, Enum):
    uniprot = "uniprot"
    interpro = "interpro"
    rcsb = "rcsb"
    alphafold = "alphafold"
    fpbase = "fpbase"


class RetrievalMode(str, Enum):
    live = "live"          # fetched from the provider this run
    cached = "cached"      # served from the on-disk cache
    fixture = "fixture"    # served from a recorded offline fixture
    unavailable = "unavailable"  # provider could not be reached and no cache/fixture


class PhysicsEligibilityKind(str, Enum):
    # only the first two may enter the COMPUTED candidate ranking
    real_spin_dynamics = "real_spin_dynamics"          # artifact-backed spin dynamics
    qm_cluster_assumption = "qm_cluster_assumption"     # PySCF cluster parameterized
    analytic_proxy_only = "analytic_proxy_only"         # exploration lane only
    ineligible = "ineligible"                           # excluded, with reasons


class DiscoveryLane(str, Enum):
    evidence = "evidence"    # known mechanism families + stronger evidence
    frontier = "frontier"    # plausible, measurable hypotheses outside familiar families


class ExplorationLevel(str, Enum):
    # constraint-relaxation ladder; each level lowers the claim ceiling
    l0_known_family = "L0_known_family"                    # known family + known cofactor
    l1_cofactor_geometry = "L1_cofactor_geometry"          # family-independent cofactor/geometry
    l2_alternative_spin = "L2_alternative_spin_chemistry"  # alt spin-forming chem + compatible transduction
    l3_scaffold_composition = "L3_scaffold_composition"    # compatible domain/scaffold compositions
    l4_design = "L4_design_exploration"                    # optional generative design (disabled by default)


class PrimitiveKind(str, Enum):
    energy_input = "energy_input"
    excitation = "excitation"
    radical_pair_formation = "radical_pair_formation"
    triplet_formation = "triplet_formation"
    metal_open_shell = "metal_open_shell"
    spin_evolution = "spin_evolution"
    recombination = "recombination"
    relaxation = "relaxation"
    fluorescence_readout = "fluorescence_readout"
    lifetime_readout = "lifetime_readout"
    electrochemical_readout = "electrochemical_readout"
    hybrid_transduction = "hybrid_transduction"
    biological_transduction = "biological_transduction"
    material_context = "material_context"


class KnowledgeStateKind(str, Enum):
    known = "known"        # public-anchor supported
    assumed = "assumed"    # transparent assumption
    unknown = "unknown"    # explicitly unresolved


class RunStatus(str, Enum):
    queued = "queued"
    compiling_objective = "compiling_objective"
    retrieving_evidence = "retrieving_evidence"
    assessing_physics = "assessing_physics"
    simulating = "simulating"
    ranking = "ranking"
    planning = "planning"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


TERMINAL_STATUSES = frozenset({RunStatus.completed, RunStatus.failed, RunStatus.cancelled})
