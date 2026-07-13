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
    # honest framing: D leads, J flagged order-of-magnitude, no yield/sensor claim
    low = upgraded.reason.lower()
    assert "point dipole" in low and "order-of-magnitude" in low
    assert "no spin-dynamics yield" in low
