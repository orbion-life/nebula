"""Tier 0: per-protein radical-pair extraction + geometry-derived couplings.

The partner identity, separation, and D become per-protein (read from THIS protein's structure); D is
the well-constrained point dipole, J is an order-of-magnitude tunnelling estimate. No spin-dynamics
yield is produced here — parameter derivation only, so nothing to firewall as a sensor claim.
"""
from __future__ import annotations

import math
from pathlib import Path

from app.contracts.enums import ArchitectureKind, RouteClass, ScaffoldFamily
from app.contracts.candidate import CandidateRecord
from app.contracts.providers import CofactorRef, UniProtRecord
from app.physics.eligibility import assess_eligibility, upgrade_with_radical_pair
from app.physics.radical_pair import couplings, extract_radical_pair

_FIX = Path(__file__).resolve().parents[1] / "app" / "providers" / "fixtures" / "rcsb"


def test_couplings_match_point_dipole_and_moser():
    # point-dipole D at 1.9 nm ~ -0.41 mT (Efimova & Hore 2008); scales as 1/r^3
    _j19, d19 = couplings(1.9e-9)
    assert -0.45 < d19 < -0.38
    _j10, d10 = couplings(1.0e-9)
    assert d10 < d19  # larger magnitude (more negative) at shorter separation
    assert math.isclose(d10 / d19, (1.9 / 1.0) ** 3, rel_tol=1e-6)
    # J: positive Moser tunnelling decay, larger at shorter r
    assert _j10 > _j19 > 0


def test_extracts_partner_from_real_flavoprotein():
    rp = extract_radical_pair((_FIX / "coords_1N9O.cif").read_text())  # FMN flavoprotein
    assert rp is not None
    assert rp.partner_kind in ("tryptophan", "tyrosine")
    assert 4.0 < rp.separation_angstrom < 25.0
    assert rp.dipolar_d_mT < 0.0            # point dipole is negative
    assert rp.exchange_j_mT > 0.0
    assert rp.chain_residues and rp.partner_residue == rp.chain_residues[-1]
    # D reproduces the point-dipole closed form at the reported separation
    _j, d = couplings(rp.separation_angstrom * 1e-10)
    assert math.isclose(d, rp.dipolar_d_mT, rel_tol=1e-9)


def test_none_without_bound_flavin():
    assert extract_radical_pair((_FIX / "coords_6QTW.cif").read_text()) is None  # no flavin ligand


def test_none_when_flavin_has_no_aromatic_partner():
    assert extract_radical_pair((_FIX / "coords_5DKL.cif").read_text()) is None  # FMN but no reachable Trp/Tyr


def test_upgrade_attaches_radical_pair_to_eligibility():
    cand = CandidateRecord(
        candidate_id="c1", title="t", scaffold_family=ScaffoldFamily.cryptochrome_fad,
        architecture_kind=ArchitectureKind.single_scaffold,
        uniprot=UniProtRecord(primary_accession="Q1"),
        cofactors=[CofactorRef(name="FAD")],
        mechanism_route_id="route_cryptochrome_FAD_radical_pair",
        route_class=RouteClass.cryptochrome_fad_radical_pair, generated_by="test",
    )
    elig = assess_eligibility(cand)
    assert elig.radical_pair is None
    rp = extract_radical_pair((_FIX / "coords_1N9O.cif").read_text())
    assert rp is not None
    upgraded = upgrade_with_radical_pair(elig, rp)
    assert upgraded.radical_pair is not None
    assert upgraded.radical_pair.partner_residue == rp.partner_residue
    assert upgraded.radical_pair.dipolar_d_mT == rp.dipolar_d_mT
    # honest framing: D leads (point dipole), J flagged order-of-magnitude, hyperfine still class-level
    low = upgraded.reason.lower()
    assert "point dipole" in low and "order-of-magnitude" in low
    assert "hyperfine is still class-level" in low
    # the coarse magnetic field effect estimate (radicalpy available in this env) stays honestly framed
    mfe = upgraded.radical_pair.magnetic_field_effect_percent
    if mfe is not None:
        assert 0.0 < mfe < 100.0
        sensitivity = upgraded.radical_pair.magnetic_field_effect
        assert sensitivity is not None
        assert sensitivity.lower_percent <= sensitivity.baseline_percent <= sensitivity.upper_percent
        assert len(sensitivity.scenarios) >= 5
        assert len(sensitivity.fields_mT) == len(sensitivity.baseline_curve_percent)
        assert len(sensitivity.fields_mT) == len(sensitivity.lower_curve_percent)
        assert len(sensitivity.fields_mT) == len(sensitivity.upper_curve_percent)
        assert "kinetic-sensitivity envelope" in low
        assert "not a validated response prediction or a working-sensor claim" in low


def test_mfe_estimate_is_bounded_and_positive():
    from app.physics.radical_pair_response import estimate_mfe
    out = estimate_mfe(-0.97, 20.0)  # cryptochrome-scale D with an uncertain strong J estimate
    if out is not None:  # radicalpy is optional (absent in the slim runtime image)
        assert 0.0 < out["mfe_amplitude_percent"] < 100.0
        assert out["lower_percent"] <= out["mfe_amplitude_percent"] <= out["upper_percent"]
        assert len(out["scenarios"]) >= 5
        names = {row["name"] for row in out["scenarios"]}
        assert "geometry_j__baseline" in names
        assert "negligible_j__baseline" in names
        assert len(out["fields_mT"]) == len(out["baseline_curve_percent"])
