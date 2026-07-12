"""Design-adapter seam: default is the deterministic preview; a GPU adapter is strictly opt-in,
bring-your-own-compute, firewalled to a backbone-only hypothesis, and always degrades to the
preview on failure — a public build never reaches or bills another account's Modal."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.contracts.design import GenerativePreview
from app.contracts.objective import ObjectiveSpec
from app.design import PreviewDesigner, _select_adapter, generate_previews
from app.design.modal_rfdiffusion import ModalRFdiffusionAdapter

OBJ = ObjectiveSpec(
    objective_id="o",
    objective_text="optical spin contrast demo objective",
    sensed_quantity_or_state="optical spin contrast",
)

_ENV = ("NEBULA_DESIGN_ADAPTER", "NEBULA_MODAL_RFDIFFUSION_URL", "NEBULA_MODAL_RFDIFFUSION_TOKEN")


def _clear_env(mp):
    for k in _ENV:
        mp.delenv(k, raising=False)


def test_default_adapter_is_deterministic_preview(monkeypatch):
    _clear_env(monkeypatch)
    assert isinstance(_select_adapter(), PreviewDesigner)
    out = generate_previews(OBJ)
    assert len(out) == 3
    assert all(p.generator == "deterministic-preview" for p in out)
    assert all(p.backbone_pdb is None and p.sequence_provided is False for p in out)


def test_modal_selected_but_unconfigured_falls_back(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setenv("NEBULA_DESIGN_ADAPTER", "modal")  # URL/token deliberately unset
    assert isinstance(_select_adapter(), PreviewDesigner)  # never reaches any account


def test_unknown_adapter_falls_back(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setenv("NEBULA_DESIGN_ADAPTER", "definitely-not-a-thing")
    assert isinstance(_select_adapter(), PreviewDesigner)


class _FakeResp:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


def test_modal_adapter_maps_backbone_to_firewalled_preview(monkeypatch):
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"], captured["json"] = url, json
        return _FakeResp(
            {
                "model": "rfdiffusion-base",
                "designs": [
                    {
                        "backbone_pdb": "ATOM      1  CA  GLY A   1      0.0   0.0   0.0",
                        "n_residues": 100,
                        "run_ref": "abc123",
                        "params": {"length": 100, "unconditional": "true"},
                    }
                ],
            }
        )

    monkeypatch.setattr("app.design.modal_rfdiffusion.httpx.post", fake_post)
    adapter = ModalRFdiffusionAdapter("https://you--nebula-rfdiffusion-generate.modal.run", "secret-token")
    out = adapter.invent(OBJ, 1)
    assert len(out) == 1
    p = out[0]
    assert p.generator == "rfdiffusion@modal"
    assert p.backbone_pdb and p.n_residues == 100
    # firewall: an invented backbone is never a sequence and never found in nature
    assert p.sequence_provided is False and p.found_in_nature is False
    assert p.provenance and p.provenance.adapter == "rfdiffusion@modal" and p.provenance.run_ref == "abc123"
    assert "not an orderable sequence" in p.note
    # the token is sent to the deployer's own endpoint in the request body, never embedded elsewhere
    assert captured["json"]["token"] == "secret-token"


def test_modal_failure_falls_back_to_preview(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setenv("NEBULA_DESIGN_ADAPTER", "modal")
    monkeypatch.setenv("NEBULA_MODAL_RFDIFFUSION_URL", "https://you--x.modal.run")
    monkeypatch.setenv("NEBULA_MODAL_RFDIFFUSION_TOKEN", "tok")

    def boom(*a, **k):
        raise RuntimeError("network down")

    monkeypatch.setattr("app.design.modal_rfdiffusion.httpx.post", boom)
    out = generate_previews(OBJ)  # must not raise
    assert len(out) == 3
    assert all(p.generator == "deterministic-preview" for p in out)


def test_contract_forbids_sequence_and_nature_flags():
    with pytest.raises(ValidationError):
        GenerativePreview(label="x", invented_for="y", note="z", sequence_provided=True)
    with pytest.raises(ValidationError):
        GenerativePreview(label="x", invented_for="y", note="z", found_in_nature=True)
