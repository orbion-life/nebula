"""RFdiffusion design adapter over a bring-your-own Modal GPU endpoint.

This calls a Modal web endpoint that YOU deploy to YOUR OWN Modal account
(see infra/modal/rfdiffusion_modal.py and docs/DESIGN_ADAPTERS.md). It is OFF by
default and embeds no URL, token, or account: the endpoint URL and a shared bearer
token come only from environment variables the deployer sets. A public build with
those unset never reaches any Modal account; a misconfigured one falls back to the
deterministic preview rather than borrowing someone else's compute.

RFdiffusion invents a de novo BACKBONE (coordinates, no sequence). The result stays an
unvalidated, non-orderable design hypothesis: sequence_provided=False, found_in_nature
False, claim ceiling unchanged. No sequence is ever requested or surfaced here.
"""
from __future__ import annotations

import httpx

from ..contracts.candidate import CandidateRecord
from ..contracts.design import DesignProvenance, GenerativePreview
from ..contracts.objective import ObjectiveSpec

_DESIGN_NOTE = (
    "Invented de novo backbone from RFdiffusion, coordinates only with no sequence. "
    "Not found in nature, not validated, and not an orderable sequence; a design "
    "hypothesis to prove at the bench."
)


def _modal_rationale(accession: str | None) -> str:
    """Honest 'why this design' for a REAL RFdiffusion backbone.

    Unlike the preview brief, coordinates DO exist here — so this must not echo the preview's
    "coordinates require the adapter / not a produced construct" text (it would contradict the
    produced backbone shown alongside it). The geometry is generated unconditionally (not scaffolded
    around the cofactor site), so the motif is named as the design GOAL, never as something the
    backbone already encodes. Claim ceiling unchanged: geometry only, no sequence, unvalidated."""
    target = accession or "the top-ranked candidate"
    return (
        f"A de novo RFdiffusion backbone generated for {target}'s sensing route — real coordinates, "
        "geometry only. It is not conditioned on the cofactor pocket and carries no sequence; "
        "scaffolding the motif in and designing a sequence come next. An unvalidated design "
        "hypothesis to prove at a bench, not a finished construct."
    )


class ModalRFdiffusionAdapter:
    """Posts an objective to the deployer's own Modal RFdiffusion endpoint and maps the
    returned backbones onto the GenerativePreview firewall shape. Holds the URL/token only
    in memory for the request; never writes them into any output or log."""

    name = "rfdiffusion@modal"

    def __init__(self, url: str, token: str, *, timeout: float = 300.0) -> None:
        self._url = url
        self._token = token
        self._timeout = timeout

    def invent(self, objective: ObjectiveSpec, candidates: list[CandidateRecord] | None = None, n: int = 3) -> list[GenerativePreview]:
        # imported lazily-safe: this module is only imported after app.design.__init__ is loaded
        from . import candidate_motif_note, cofactor_residues

        sensed = objective.sensed_quantity_or_state or "the stated target"
        cands = candidates or []
        # motif context for a motif-aware endpoint: the REAL cofactor-binding residues + structure so
        # the endpoint can scaffold around them. Unknown keys are ignored by the current recipe.
        top = cands[0] if cands else None
        top_pdb = next((p.rcsb_id for p in (top.pdb_entries or []) if getattr(p, "rcsb_id", None)), None) if top else None
        payload = {
            "token": self._token,  # goes only to the deployer's own endpoint, over HTTPS
            "sensed_quantity": sensed,
            "material_context": objective.material_context,
            "n": max(1, min(int(n), 8)),
            "motif_note": candidate_motif_note(top) if top else None,
            "motif_residues": cofactor_residues(top) if top else [],
            "target_accession": (top.uniprot.primary_accession if (top and top.uniprot) else None),
            "target_pdb_id": top_pdb,
            "mechanism_route_id": (top.mechanism_route_id if top else None),
        }
        resp = httpx.post(self._url, json=payload, timeout=self._timeout)
        resp.raise_for_status()
        data = resp.json()
        model = data.get("model")
        out: list[GenerativePreview] = []
        for i, d in enumerate(data.get("designs", [])[:n], 1):
            pdb = d.get("backbone_pdb")
            if not pdb:  # a backbone with no coordinates is not a design; skip it
                continue
            cand = cands[(i - 1) % len(cands)] if cands else None
            accession = cand.uniprot.primary_accession if (cand and cand.uniprot) else None
            motif = candidate_motif_note(cand) if cand else None
            out.append(
                GenerativePreview(
                    label=f"de novo backbone {i:02d}",
                    invented_for=sensed,
                    generator=self.name,
                    note=_DESIGN_NOTE,
                    invented_from_candidate_id=cand.candidate_id if cand else None,
                    invented_from_accession=accession,
                    mechanism_route_id=cand.mechanism_route_id if cand else None,
                    motif_note=motif,
                    design_rationale=_modal_rationale(accession) if cand else None,
                    backbone_pdb=pdb,
                    n_residues=d.get("n_residues"),
                    provenance=DesignProvenance(
                        adapter=self.name,
                        model=model,
                        run_ref=d.get("run_ref"),
                        params={
                            # allowlist plain short alnum keys so a rogue endpoint cannot inject a
                            # URL/token-shaped key into provenance; values stay scalar
                            k: v
                            for k, v in (d.get("params") or {}).items()
                            if isinstance(k, str)
                            and k.replace("_", "").isalnum()
                            and len(k) <= 32
                            and isinstance(v, (int, float, str))
                        },
                    ),
                )
            )
        return out
