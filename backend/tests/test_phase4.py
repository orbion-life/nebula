"""Phase 4 tests: candidate-specific quantum chemistry on real coordinates.

These prove the physics is genuinely candidate-specific, not a template:
- the isolated subprocess QM worker actually converges an open-shell radical,
- the calculation depends on geometry (different coordinates → different energy),
- this protein's isoalloxazine is extracted from its real mmCIF, and
- `candidate_specific` flips to True (with a `computed` provenance) ONLY when
  real coordinates entered the calculation — never from the generic template.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import app
from app.contracts.enums import ParameterSourceType, RouteClass, ScaffoldFamily
from app.contracts.providers import CofactorRef, UniProtRecord
from app.contracts.candidate import CandidateRecord
from app.contracts.enums import ArchitectureKind, ReadoutMode
from app.physics.candidate_specific import CandidateQm, run_candidate_qm
from app.physics.cluster import extract_isoalloxazine
from app.physics.eligibility import assess_eligibility, upgrade_with_candidate_qm

_WORKER = Path(app.__file__).resolve().parent / "physics" / "qm_worker.py"
_COORDS = Path(app.__file__).resolve().parent / "providers" / "fixtures" / "rcsb" / "coords_5DKL.cif"

# planar methyl radical (doublet): a cheap, fast open-shell system for the worker
_METHYL = [
    ["C", [0.0, 0.0, 0.0]],
    ["H", [1.079, 0.0, 0.0]],
    ["H", [-0.5395, 0.9345, 0.0]],
    ["H", [-0.5395, -0.9345, 0.0]],
]


def _run_worker(atoms, *, charge=0, spin=1, basis="sto-3g") -> dict:
    env = {**os.environ, "OMP_NUM_THREADS": "2", "KMP_DUPLICATE_LIB_OK": "TRUE"}
    proc = subprocess.run(
        [sys.executable, str(_WORKER)],
        input=json.dumps({"atoms": atoms, "charge": charge, "spin": spin, "basis": basis, "max_cycle": 200}),
        capture_output=True, text=True, timeout=90, env=env,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_qm_worker_converges_open_shell_radical() -> None:
    out = _run_worker(_METHYL)
    assert out["converged"] is True
    assert out["natm"] == 4
    assert out["method"] == "UHF"
    assert out["n_spin_sites"] >= 1          # an unpaired electron is somewhere
    assert out["max_abs_spin"] > 0.0


def test_qm_energy_depends_on_geometry() -> None:
    # stretch one C-H bond: same atoms, same electrons, DIFFERENT geometry → different energy.
    stretched = [row[:] for row in _METHYL]
    stretched[1] = ["H", [1.5, 0.0, 0.0]]
    e0 = _run_worker(_METHYL)["energy"]
    e1 = _run_worker(stretched)["energy"]
    assert abs(e0 - e1) > 1e-3, "geometry must change the computed energy — else it is not candidate-specific"


def test_extract_isoalloxazine_from_real_structure() -> None:
    cif = _COORDS.read_text()
    extracted = extract_isoalloxazine(cif)
    assert extracted is not None
    atoms, charge, spin, note, ligand, chain = extracted
    assert ligand == "FMN"
    assert charge == 0 and spin == 1          # stated neutral-doublet-radical assumption
    heavy = [a for a in atoms if a[0] != "H"]
    assert len(heavy) >= 13                    # full isoalloxazine ring system
    assert "isoalloxazine" in note.lower()


def test_candidate_qm_on_real_coordinates_is_candidate_specific() -> None:
    cif = _COORDS.read_text()
    # use_cache=False: this test must exercise the real subprocess QM, never a cached result
    qm = run_candidate_qm("5DKL", cif, basis="sto-3g", timeout=90.0, use_cache=False)
    assert qm is not None
    assert isinstance(qm, CandidateQm)
    assert qm.pdb_id == "5DKL" and qm.ligand == "FMN"
    assert qm.converged is True
    assert qm.n_atoms >= 14
    prov = qm.provenance()
    assert prov.source_type == ParameterSourceType.computed
    assert "5DKL" in prov.citation_or_assumption


def test_run_candidate_qm_returns_none_without_flavin() -> None:
    # a coordinate file with no bound flavin cannot yield candidate-specific physics
    assert run_candidate_qm("XXXX", "data_empty\n_cell.length_a 1.0\n") is None


def _fake_qm() -> CandidateQm:
    return CandidateQm(
        pdb_id="5DKL", ligand="FMN", chain="A", n_atoms=18, n_heavy=17, converged=True,
        energy_hartree=-773.9, max_abs_spin=0.42, n_spin_sites=3, basis="6-31g",
        wall_seconds=9.1, note="isoalloxazine core (17 heavy atoms) …",
    )


def test_upgrade_flips_candidate_specific_only_with_real_coords() -> None:
    cand = CandidateRecord(
        candidate_id="cand_test_rp", title="test flavoprotein",
        scaffold_family=ScaffoldFamily.cryptochrome_fad, architecture_kind=ArchitectureKind.single_scaffold,
        uniprot=UniProtRecord(primary_accession="Q00000", reviewed=True, protein_name="x", sequence_length=400),
        cofactors=[CofactorRef(name="FAD", chebi_id="CHEBI:57692")],
        readout_modes=[ReadoutMode.fluorescence, ReadoutMode.rf_magnetic],
        mechanism_route_id="route_cry", route_class=RouteClass.cryptochrome_fad_radical_pair,
        required_controls=["dark control"], generated_by="test",
    )
    elig = assess_eligibility(cand)
    # generic template: never candidate-specific on its own
    assert elig.qm_cluster_plan is not None
    assert elig.qm_cluster_plan.candidate_specific is False

    upgraded = upgrade_with_candidate_qm(elig, _fake_qm())
    assert upgraded.qm_cluster_plan.candidate_specific is True
    assert any(p.source_type == ParameterSourceType.computed for p in upgraded.assumptions)
    assert "5DKL" in upgraded.reason
