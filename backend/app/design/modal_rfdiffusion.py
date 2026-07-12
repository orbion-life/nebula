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

from ..contracts.design import DesignProvenance, GenerativePreview
from ..contracts.objective import ObjectiveSpec

_DESIGN_NOTE = (
    "Invented de novo backbone from RFdiffusion, coordinates only with no sequence. "
    "Not found in nature, not validated, and not an orderable sequence; a design "
    "hypothesis to prove at the bench."
)


class ModalRFdiffusionAdapter:
    """Posts an objective to the deployer's own Modal RFdiffusion endpoint and maps the
    returned backbones onto the GenerativePreview firewall shape. Holds the URL/token only
    in memory for the request; never writes them into any output or log."""

    name = "rfdiffusion@modal"

    def __init__(self, url: str, token: str, *, timeout: float = 180.0) -> None:
        self._url = url
        self._token = token
        self._timeout = timeout

    def invent(self, objective: ObjectiveSpec, n: int = 3) -> list[GenerativePreview]:
        sensed = objective.sensed_quantity_or_state or "the stated target"
        payload = {
            "token": self._token,  # goes only to the deployer's own endpoint, over HTTPS
            "sensed_quantity": sensed,
            "material_context": objective.material_context,
            "n": max(1, min(int(n), 8)),
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
            out.append(
                GenerativePreview(
                    label=f"de novo backbone {i:02d}",
                    invented_for=sensed,
                    generator=self.name,
                    note=_DESIGN_NOTE,
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
