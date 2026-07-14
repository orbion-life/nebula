"""Per-protein radical-pair geometry + geometry-derived couplings (Tier 0).

From a candidate's real cofactor-bound structure this identifies the electron-transfer partner
(the terminal Trp/Tyr in the aromatic hopping chain leading away from the flavin) and the
inter-radical separation r, then derives the exchange coupling J(r) and dipolar coupling D(r) from
the standard closed forms. That makes the radical-pair MODEL genuinely per-protein in four inputs
the old template hard-coded: the partner identity, the separation, J, and D (previously a generic
FAD+Trp pair with J = D = 0). Two honest limits stay explicit: the hyperfine couplings are still
class-level (database values, not computed on this geometry — that is Tier 1), and NO spin-dynamics
yield or magnetic response is predicted here. This is parameter derivation only, assumption-derived,
never a sensor claim.

Radical partner: a light in-house version of the Beratan-Onuchic aromatic-hopping heuristic (the
fuller tool is eMap/pyemap, Tazhigulov et al., J. Phys. Chem. B 2019, 10.1021/acs.jpcb.9b04816).
J(r): Moser et al., Nature 355:796 (1992) tunnelling decay, matching RadicalPy
`exchange_interaction_in_protein`. D(r): point dipole (Santabarbara 2005 / Efimova & Hore, Biophys.
J. 2008, 10.1529/biophysj.107.119362), matching RadicalPy `dipolar_interaction_isotropic`.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import gemmi

# isoalloxazine ring (the flavin electron donor); mirrors physics/cluster.py
_ISO = {
    "N1", "C2", "O2", "N3", "C4", "O4", "C4A", "C4X", "N5", "C5A", "C5X",
    "C6", "C7", "C7M", "C8", "C8M", "C9", "C9A", "N10",
}
_FLAVIN_LIGANDS = {"FMN", "FAD", "FNR", "RBF", "FDA", "6FA", "FADH"}
# aromatic side-chain ring atoms (the electron/hole hopping nodes)
_TRP_RING = {"CG", "CD1", "CD2", "NE1", "CE2", "CE3", "CZ2", "CZ3", "CH2"}
_TYR_RING = {"CG", "CD1", "CD2", "CE1", "CE2", "CZ", "OH"}

# edge-to-edge (closest heavy-atom) tunnelling hop between two rings. Protein electron transfer is
# significant to ~9-10 Angstrom edge-to-edge (Moser-Dutton, ~1 order of magnitude per 1.7 A); 9.0 A
# captures a real single ET step while staying tight enough to trace an outward chain, not a mesh.
_EDGE_CUTOFF_A = 9.0

# D point-dipole prefactor (3 g_e mu_B mu_0)/(8 pi) in T m^3 (~2.786e-30); matches RadicalPy.
_MU0 = 1.25663706212e-6      # T m / A
_MUB = 9.2740100783e-24      # J / T
_GE = 2.00231930436          # electron g-factor
_D_PREFACTOR_Tm3 = (3.0 * _GE * _MUB * _MU0) / (8.0 * math.pi)


@dataclass(frozen=True)
class RadicalPair:
    partner_residue: str          # e.g. "TRP 400 (chain A)"
    partner_kind: str             # "tryptophan" | "tyrosine"
    chain_residues: list[str]     # aromatic hopping chain, flavin -> partner (excludes the flavin)
    separation_angstrom: float    # flavin isoalloxazine centroid <-> partner ring centroid
    exchange_j_mT: float          # Moser 1992 J(r)
    dipolar_d_mT: float           # point-dipole D(r) (negative)


def couplings(r_m: float) -> tuple[float, float]:
    """(J, D) in mT from the inter-radical separation r (metres). J: Moser 1992 exponential
    tunnelling decay; D: point-dipole. Both are geometry-derived, order-of-magnitude for J."""
    j = 9.7e9 * math.exp(-14e9 * r_m)                 # mT (Moser et al. 1992)
    d = -(_D_PREFACTOR_Tm3 / r_m**3) * 1000.0         # mT, negative (point dipole)
    return j, d


def _centroid(pts: list[tuple[float, float, float]]) -> tuple[float, float, float]:
    n = len(pts)
    return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n, sum(p[2] for p in pts) / n)


def _dist(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def _min_edge(a: list[tuple[float, float, float]], b: list[tuple[float, float, float]]) -> float:
    """Closest heavy-atom (edge-to-edge) distance between two rings."""
    return min(_dist(p, q) for p in a for q in b)


def extract_radical_pair(cif_text: str) -> RadicalPair | None:
    """Identify the flavin's electron-transfer partner + derive J, D, or None if no bound flavin or
    no reachable aromatic chain. Intra-chain: the hopping chain is searched within the flavin's chain.

    Algorithm (light Beratan-Onuchic hop): build a graph over the isoalloxazine ring and every Trp/Tyr
    ring in the chain, connect two rings when their closest heavy atoms are within 9 Angstrom, run a
    Dijkstra from the flavin, and take the geodesically farthest reachable aromatic as the terminal
    radical partner. r is the flavin<->partner ring-centroid separation."""
    block = gemmi.cif.read_string(cif_text).sole_block()
    st = gemmi.make_structure_from_block(block)
    model = st[0] if len(st) else None
    if model is None:
        return None

    # locate the flavin isoalloxazine (donor) and remember its chain
    flavin_atoms: list[tuple[float, float, float]] | None = None
    flavin_chain: str | None = None
    for chain in model:
        for res in chain:
            if res.name in _FLAVIN_LIGANDS:
                iso = [(a.pos.x, a.pos.y, a.pos.z) for a in res if a.name in _ISO]
                if len(iso) >= 13:
                    flavin_atoms, flavin_chain = iso, chain.name
                    break
        if flavin_atoms is not None:
            break
    if flavin_atoms is None or flavin_chain is None:
        return None

    # nodes: node 0 = flavin; then each Trp/Tyr ring in the flavin's chain
    nodes: list[dict] = [{"label": "flavin", "kind": "flavin", "atoms": flavin_atoms, "centroid": _centroid(flavin_atoms)}]
    for chain in model:
        if chain.name != flavin_chain:
            continue
        for res in chain:
            ring = _TRP_RING if res.name in ("TRP", "TRY") else _TYR_RING if res.name == "TYR" else None
            if ring is None:
                continue
            pts = [(a.pos.x, a.pos.y, a.pos.z) for a in res if a.name in ring]
            if len(pts) < 5:
                continue
            kind = "tryptophan" if res.name in ("TRP", "TRY") else "tyrosine"
            nodes.append({
                "label": f"{res.name} {res.seqid.num} (chain {chain.name})",
                "kind": kind, "atoms": pts, "centroid": _centroid(pts),
            })
    if len(nodes) < 2:
        return None

    # edges (edge-to-edge within cutoff), weighted by centroid distance
    n = len(nodes)
    adj: list[list[tuple[int, float]]] = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if _min_edge(nodes[i]["atoms"], nodes[j]["atoms"]) <= _EDGE_CUTOFF_A:
                w = _dist(nodes[i]["centroid"], nodes[j]["centroid"])
                adj[i].append((j, w))
                adj[j].append((i, w))

    # Dijkstra from the flavin (node 0)
    INF = float("inf")
    dist = [INF] * n
    prev = [-1] * n
    dist[0] = 0.0
    visited = [False] * n
    for _ in range(n):
        u, best = -1, INF
        for k in range(n):
            if not visited[k] and dist[k] < best:
                u, best = k, dist[k]
        if u == -1:
            break
        visited[u] = True
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u

    # terminal partner = geodesically farthest reachable aromatic (node != flavin, finite dist)
    terminal, far = -1, -1.0
    for k in range(1, n):
        if dist[k] < INF and dist[k] > far:
            terminal, far = k, dist[k]
    if terminal == -1:
        return None  # flavin has no aromatic hop within cutoff → no radical pair identified

    # reconstruct the chain flavin -> partner
    path: list[int] = []
    cur = terminal
    while cur != -1:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    chain_labels = [nodes[i]["label"] for i in path if nodes[i]["kind"] != "flavin"]

    # round the separation first, then derive J/D from it, so the displayed r and couplings are
    # internally consistent (a reader recomputing D from the shown separation gets the shown D).
    sep_a = round(_dist(nodes[0]["centroid"], nodes[terminal]["centroid"]), 2)
    j, d = couplings(sep_a * 1e-10)
    return RadicalPair(
        partner_residue=nodes[terminal]["label"],
        partner_kind=nodes[terminal]["kind"],
        chain_residues=chain_labels,
        separation_angstrom=sep_a,
        exchange_j_mT=j,
        dipolar_d_mT=d,
    )
