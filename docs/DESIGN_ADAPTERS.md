# Design adapters — bring your own GPU

Nebula's "unmade" generative frontier is produced by a **design adapter** behind the
`DesignAdapter` seam (`backend/app/design/`). It is **opt-in and bring-your-own-compute**.

## Default: deterministic preview (no GPU, no credentials)

With no configuration, the adapter is `PreviewDesigner`: deterministic, clearly-labelled scaffold
previews with **no coordinates and no sequence**. This is what the public build and CI run. It
never calls out to any GPU or account.

## Optional: RFdiffusion on **your own** Modal GPU

You can plug real de novo backbone generation (RFdiffusion) into the same seam. It runs on **your
own** Modal account and GPU budget — this project's backend never holds your credentials and never
runs it for you. Anyone who forks the repo does the same on their account; **the maintainer's
compute is never shared or billed.**

### 1. Deploy the recipe to your Modal account

```bash
pip install modal                         # local, for `modal deploy`
modal token new                           # sign in to YOUR Modal account
modal secret create nebula-rfdiffusion RFDIFFUSION_TOKEN=$(openssl rand -hex 24)
modal deploy infra/modal/rfdiffusion_modal.py
#   → prints your endpoint, e.g. https://<you>--nebula-rfdiffusion-generate.modal.run
```

RFdiffusion (RosettaCommons/RFdiffusion) is BSD-licensed research software; deploying it runs it
under your account and your acceptance of its license and model terms. The recipe is provided
as-is and is **not exercised by CI** (it needs a GPU); pin versions before production use.

### 2. Point Nebula at **your** endpoint (never commit these)

```bash
export NEBULA_DESIGN_ADAPTER=modal
export NEBULA_MODAL_RFDIFFUSION_URL="https://<you>--nebula-rfdiffusion-generate.modal.run"
export NEBULA_MODAL_RFDIFFUSION_TOKEN="<the RFDIFFUSION_TOKEN from step 1>"
```

That's it — the generative frontier now shows real RFdiffusion backbones. Unset either variable
and it falls straight back to the deterministic preview.

## The isolation guarantees

- **No credentials in the repo or image.** The URL and token come only from environment variables
  you set locally; nothing is baked into the Docker image or committed. Keep them in an untracked
  `.env` (see `.env.example`).
- **Opt-in default.** `NEBULA_DESIGN_ADAPTER` unset → deterministic preview. A deployment with the
  variables unset can reach no Modal account at all.
- **Token-gated endpoint.** Your Modal endpoint rejects any request whose `token` does not match
  your secret, so possessing the URL alone cannot spend your GPU budget.
- **Fail-safe.** Any network error, timeout, misconfiguration, or empty result degrades to the
  deterministic preview. A design step never breaks a run and never silently borrows compute.

## What the adapter is allowed to produce (claim firewall)

RFdiffusion invents a de novo **backbone** — coordinates with **no sequence**. The result stays an
unvalidated, non-orderable **design hypothesis**: `sequence_provided=False`, `found_in_nature=False`,
and the same claim ceilings as any other frontier candidate. Adding a sequence designer
(ProteinMPNN/LigandMPNN) behind the same seam is possible, but a designed **sequence** must never be
presented as orderable or validated — that is exactly what the claim firewall forbids.

## Per-protein motif conditioning

Each generative brief is now **linked to a top-ranked retrieved candidate**: the orchestrator passes
the ranked shortlist into `generate_previews`, and every `GenerativePreview` carries
`invented_from_accession`, `mechanism_route_id`, `motif_note` (e.g. "FMN flavin radical-pair site"),
and a `design_rationale`. This is a design **intent** — the brief names the protein and cofactor
motif it would target; it is never a claim that a backbone was scaffolded or validated for that
protein. The deterministic preview keeps `backbone_pdb=null` (a brief, not coordinates).

To produce a backbone genuinely **scaffolded around that motif** (not the default unconditional
monomer), two pieces cooperate:

1. **The recipe honors a `contig`.** `_run_rfdiffusion(n, length, contig)` (and the `generate`
   endpoint) accept an optional RFdiffusion contigmap string; when present the backbone is
   conditioned on it (`params.unconditional="false"`), else it stays unconditional. The input is
   allowlisted (chain letters, digits, `/ , -`, spaces) so a rogue payload cannot inject hydra/shell
   args. The `ModalRFdiffusionAdapter` already forwards the target accession, route, and `motif_note`
   in its payload.
2. **Deriving the `contig` from the candidate's structure** — mapping the cofactor-coordinating
   residues of the linked candidate (AlphaFold/RCSB coordinates) to a contigmap/hotspot spec — is the
   remaining wire-up. It is intentionally left to enable on a live Modal deploy (it needs a GPU and
   real structures to validate the contigs); until then the adapter forwards `contig=None` and the
   endpoint runs unconditional. No fabricated or unvalidated motif ever ships from the offline build.
