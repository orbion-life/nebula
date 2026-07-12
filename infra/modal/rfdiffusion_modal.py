"""RFdiffusion on Modal — bring-your-own-GPU recipe for the Nebula Discover design adapter.

Deploy this to YOUR OWN Modal account. Nebula Discover's backend never runs it and never holds
your credentials; it only POSTs to the endpoint URL you paste into an env var, with a bearer
token only you know. Forkers do the same on their own account. The maintainer's compute is never
shared or billed.

    # one-time, on your machine, signed into your own Modal account:
    pip install modal
    modal token new
    modal secret create nebula-rfdiffusion RFDIFFUSION_TOKEN=$(openssl rand -hex 24)
    modal deploy infra/modal/rfdiffusion_modal.py
    #   -> prints a web endpoint URL, e.g. https://<you>--nebula-rfdiffusion-generate.modal.run

Then point Nebula Discover at YOUR endpoint (never commit these):

    export NEBULA_DESIGN_ADAPTER=modal
    export NEBULA_MODAL_RFDIFFUSION_URL="https://<you>--nebula-rfdiffusion-generate.modal.run"
    export NEBULA_MODAL_RFDIFFUSION_TOKEN="<the RFDIFFUSION_TOKEN you generated above>"

RFdiffusion (RosettaCommons/RFdiffusion) is BSD-licensed research software; by deploying this you
run it under your own account and accept its license and model terms. It invents a de novo
BACKBONE (coordinates, no sequence) — an unvalidated, non-orderable design hypothesis.

NOTE: this recipe is provided as-is and is not exercised by the project's CI (it needs a GPU and a
Modal account). Pin versions and adjust the RFdiffusion install to its current instructions before
production use.
"""
from __future__ import annotations

import os

import modal

app = modal.App("nebula-rfdiffusion")

# RFdiffusion image: clone the repo, install SE3Transformer + deps, fetch the model weights.
# CUDA base so torch/dgl find the runtime. Weights are baked into the image so cold starts do not
# re-download. Adjust to RFdiffusion's current setup instructions if it has moved on.
rfdiffusion_image = (
    modal.Image.from_registry("nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04", add_python="3.10")
    .apt_install("git", "wget", "aria2")
    .pip_install(
        "torch==2.1.2",
        "dgl==1.1.3",
        "hydra-core==1.3.2",
        "omegaconf==2.3.0",
        "e3nn==0.5.1",
        "numpy<2",
        "scipy",
        "biopython",
        "icecream",
    )
    .run_commands(
        "git clone https://github.com/RosettaCommons/RFdiffusion.git /opt/RFdiffusion",
        "pip install /opt/RFdiffusion/env/SE3Transformer",
        "pip install --no-deps -e /opt/RFdiffusion",
        # model weights (~1.5 GB) — download once into the image
        "mkdir -p /opt/RFdiffusion/models",
        "wget -q http://files.ipd.uw.edu/pub/RFdiffusion/6f5902ac237024bdd0c176cb93063dc4/Base_ckpt.pt "
        "-O /opt/RFdiffusion/models/Base_ckpt.pt",
    )
)

with rfdiffusion_image.imports():
    import glob
    import subprocess
    import uuid


@app.function(
    image=rfdiffusion_image,
    gpu="A10G",
    timeout=600,
    # bills YOUR account; only the endpoint (below) can trigger it, and only with your token.
)
def _run_rfdiffusion(n: int, length: int) -> list[dict]:
    """Unconditional monomer backbones. Returns [{backbone_pdb, n_residues, run_ref, params}]."""
    n = max(1, min(int(n), 8))
    length = max(40, min(int(length), 260))
    run_ref = uuid.uuid4().hex[:12]
    out_prefix = f"/tmp/{run_ref}/design"
    os.makedirs(f"/tmp/{run_ref}", exist_ok=True)
    subprocess.run(
        [
            "python",
            "/opt/RFdiffusion/scripts/run_inference.py",
            f"inference.output_prefix={out_prefix}",
            "inference.model_directory_path=/opt/RFdiffusion/models",
            f"contigmap.contigs=[{length}-{length}]",
            f"inference.num_designs={n}",
        ],
        check=True,
        cwd="/opt/RFdiffusion",
    )
    designs: list[dict] = []
    for pdb_path in sorted(glob.glob(f"{out_prefix}_*.pdb")):
        with open(pdb_path) as fh:
            pdb = fh.read()
        n_res = len({ln[22:26] for ln in pdb.splitlines() if ln.startswith("ATOM") and ln[12:16].strip() == "CA"})
        designs.append(
            {"backbone_pdb": pdb, "n_residues": n_res, "run_ref": run_ref,
             "params": {"length": length, "unconditional": "true"}}
        )
    return designs


@app.function(
    image=modal.Image.debian_slim().pip_install("fastapi[standard]"),
    secrets=[modal.Secret.from_name("nebula-rfdiffusion")],
)
@modal.fastapi_endpoint(method="POST")
def generate(payload: dict):
    """Token-gated web endpoint. Rejects any request whose `token` does not match your Modal secret,
    so nobody without your token can spend your GPU budget. fastapi is imported INSIDE the function
    so this module still imports cleanly in the GPU image (which has no fastapi)."""
    from fastapi import HTTPException

    expected = os.environ.get("RFDIFFUSION_TOKEN", "")
    provided = str(payload.get("token", "")).strip()
    if not expected or provided != expected:
        raise HTTPException(status_code=401, detail="missing or invalid token")
    n = int(payload.get("n", 3))
    length = int(payload.get("length", 100))
    designs = _run_rfdiffusion.remote(n, length)
    return {"model": "rfdiffusion-base", "designs": designs}
