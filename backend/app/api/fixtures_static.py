"""Static registry mirror served by the API.

Mirrors the authoritative TS fixtures (`src/core/fixtures/instruments.ts`,
`src/core/fixtures/routes.ts`). These are DATA registries, not schema; a
`tests/test_registry_parity.py` check guards against drift with the TS side.
"""
from __future__ import annotations

INSTRUMENTS = [
    {
        "id": "benchtop_field_fluorimeter",
        "label": "Benchtop fluorimeter + static-field coil",
        "readout_modes": ["fluorescence", "lifetime"],
        "min_detectable_delta_f_over_f": 1e-3,
        "static_field_range_mT": [0, 50],
        "rf_available": False,
        "rf_freq_range_MHz": [0, 0],
        "rf_b1_mT": 0,
        "oxygen_control": True,
        "temperature_control": True,
    },
    {
        "id": "odmr_confocal",
        "label": "Confocal ODMR bench (field + RF)",
        "readout_modes": ["fluorescence", "ODMR_like", "lifetime"],
        "min_detectable_delta_f_over_f": 5e-4,
        "static_field_range_mT": [0, 10],
        "rf_available": True,
        "rf_freq_range_MHz": [1, 400],
        "rf_b1_mT": 0.1,
        "oxygen_control": True,
        "temperature_control": True,
    },
    {
        "id": "plate_reader_screen",
        "label": "High-throughput plate reader",
        "readout_modes": ["fluorescence"],
        "min_detectable_delta_f_over_f": 5e-3,
        "static_field_range_mT": [0, 5],
        "rf_available": False,
        "rf_freq_range_MHz": [0, 0],
        "rf_b1_mT": 0,
        "oxygen_control": False,
        "temperature_control": False,
    },
    {
        "id": "potentiostat_optical_bench",
        "label": "Potentiostat with optical control channel",
        "readout_modes": ["redox_electrochemical", "fluorescence"],
        "min_detectable_delta_f_over_f": 1e-3,
        "static_field_range_mT": [0, 0],
        "rf_available": False,
        "rf_freq_range_MHz": [0, 0],
        "rf_b1_mT": 0,
        "oxygen_control": True,
        "temperature_control": True,
    },
]

ROUTES = [
    {"id": "route_lov_flavin_rp", "name": "LOV/flavin radical-pair optical route", "route_class": "LOV_flavin_radical_pair", "max_claim_level": "measurement_triage", "required_cofactors": ["FMN"]},
    {"id": "route_cry_fad_rp", "name": "Cryptochrome/FAD radical-pair route", "route_class": "cryptochrome_FAD_radical_pair", "max_claim_level": "diagnostic_only", "required_cofactors": ["FAD"]},
    {"id": "route_triplet_fp", "name": "Triplet-state fluorescent-protein (ODMR-like) route", "route_class": "triplet_FP", "max_claim_level": "diagnostic_only", "required_cofactors": ["intrinsic chromophore"]},
    {"id": "route_rfp_flavin_photo", "name": "Flavin photochemical light-history route", "route_class": "RFP_flavin_photochemical", "max_claim_level": "measurement_triage", "required_cofactors": ["FMN"]},
    {"id": "route_redox_electrochem", "name": "Redox/electrochemical flavoprotein route", "route_class": "redox_electrochemical", "max_claim_level": "measurement_triage", "required_cofactors": ["FAD", "FMN"]},
    {"id": "route_material_state", "name": "Material-state (hydrogel/film) response route", "route_class": "material_state", "max_claim_level": "measurement_triage", "required_cofactors": []},
    {"id": "route_metal_confounder", "name": "Metal/cofactor annotation (confounder-only)", "route_class": "metal_cofactor_confounder", "max_claim_level": "diagnostic_only", "required_cofactors": ["metal ion"]},
]
