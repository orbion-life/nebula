"""De novo generative frontier — "the unmade".

A GenerativePreview is an INVENTED candidate scaffold: not retrieved from any public database,
carrying NO sequence and NO coordinates, never validated, never orderable. It is the honest
placeholder produced by the deterministic preview designer until a real design adapter
(RFdiffusion / ProteinMPNN / LigandMPNN) is wired in behind the same DesignAdapter seam.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class GenerativePreview(BaseModel):
    label: str
    invented_for: str
    generator: str = "deterministic-preview"
    found_in_nature: Literal[False] = False
    sequence_provided: Literal[False] = False
    note: str
