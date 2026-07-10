"""Isoalloxazine QM-cluster extraction from a real cofactor-bound mmCIF.

Selects the redox-active isoalloxazine ring atoms from a bound FAD/FMN residue by
their canonical PDB atom names, truncates the ribityl/adenine tail, and H-caps
the N10 link atom toward the (removed) ribityl C1' — standard QM-cluster
truncation. The coordinates are THIS protein's, so the resulting calculation is
genuinely candidate-specific (a different structure gives different geometry →
different spin density). Assumption-derived, never a whole-protein claim.
"""
from __future__ import annotations

import gemmi

# isoalloxazine ring atom names (PDB chem-comp FAD/FMN; naming variants included)
_ISO = {
    "N1", "C2", "O2", "N3", "C4", "O4", "C4A", "C4X", "N5", "C5A", "C5X",
    "C6", "C7", "C7M", "C8", "C8M", "C9", "C9A", "N10",
}
_FLAVIN_LIGANDS = {"FMN", "FAD", "FNR", "RBF", "FDA", "6FA", "FADH"}

Cluster = tuple[list[list], int, int, str, str, str]  # atoms, charge, spin, note, ligand, chain


def extract_isoalloxazine(cif_text: str, *, min_ring_atoms: int = 13) -> Cluster | None:
    """Return (atoms, charge, spin, note, ligand, chain) or None if no bound flavin."""
    import numpy as np

    block = gemmi.cif.read_string(cif_text).sole_block()
    st = gemmi.make_structure_from_block(block)
    for model in st:
        for chain in model:
            for res in chain:
                if res.name not in _FLAVIN_LIGANDS:
                    continue
                atoms = {a.name: (a.element.name, a.pos.x, a.pos.y, a.pos.z) for a in res}
                iso = [(n, atoms[n]) for n in atoms if n in _ISO]
                if len(iso) < min_ring_atoms:
                    continue
                cluster: list[list] = [[a[1][0], [a[1][1], a[1][2], a[1][3]]] for a in iso]
                # H-cap N10 toward the removed ribityl C1'
                n10 = atoms.get("N10")
                c1 = atoms.get("C1'") or atoms.get("C1*") or atoms.get("C1B")
                if n10 and c1:
                    p = np.array(n10[1:4])
                    v = np.array(c1[1:4]) - p
                    norm = np.linalg.norm(v)
                    if norm > 1e-6:
                        h = p + v / norm * 1.01
                        cluster.append(["H", [float(h[0]), float(h[1]), float(h[2])]])
                note = (
                    f"isoalloxazine core ({len(iso)} heavy atoms) extracted from bound {res.name} in "
                    f"chain {chain.name}; ribityl/tail truncated + H-capped at N10; neutral doublet "
                    f"radical (charge 0, spin 1) assumed. Assumption-derived; not a whole-protein claim."
                )
                return cluster, 0, 1, note, res.name, chain.name
        break
    return None
