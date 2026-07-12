"""De novo generative frontier — "the unmade".

A GenerativePreview is an INVENTED candidate scaffold: not retrieved from any public database,
never validated, never orderable. The deterministic PreviewDesigner emits it with no coordinates
at all. A real design adapter (RFdiffusion via a bring-your-own GPU, see backend/app/design/) may
additionally attach a de novo BACKBONE — coordinates WITHOUT a sequence. A backbone is still
invented, unvalidated, and NOT orderable (no sequence exists yet), so `sequence_provided` stays
False and `found_in_nature` stays False no matter which adapter produced it.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DesignProvenance(BaseModel):
    """Where an invented backbone came from — adapter + model, never any credential or endpoint URL."""

    adapter: str
    model: str | None = None
    run_ref: str | None = None  # opaque run id from the deployer's own compute; not a URL or token
    params: dict[str, float | int | str] | None = None


class GenerativePreview(BaseModel):
    label: str
    invented_for: str
    generator: str = "deterministic-preview"
    found_in_nature: Literal[False] = False
    sequence_provided: Literal[False] = False
    note: str
    # --- per-protein linkage: which retrieved candidate + cofactor motif this design brief TARGETS.
    # A design intent, never a claim that a backbone was scaffolded/validated for that protein. The
    # deterministic preview only names the target; a real adapter would scaffold around the motif. ---
    invented_from_candidate_id: str | None = None
    invented_from_accession: str | None = None
    mechanism_route_id: str | None = None
    motif_note: str | None = None       # honest target-site description, e.g. "FAD flavin radical-pair site"
    design_rationale: str | None = None  # why this brief exists; names the target motif, not a backbone
    # --- optional real-adapter output (e.g. RFdiffusion via a bring-your-own Modal GPU) ---
    # A de novo BACKBONE only: coordinates with NO sequence. Absent for the deterministic preview.
    backbone_pdb: str | None = None
    n_residues: int | None = None
    provenance: DesignProvenance | None = None
