# Phase 2 — verified recon + Phase-1 integration design

**Date:** 2026-07-10 · **Branch:** `claude/live-protein-discovery`
Produced by the `nebula-phase2-recon` workflow (8 agents); every provider shape
was confirmed by a **live fetch**, physics by a **live run**. Findings I verified
directly are load-bearing; I re-fetch my own records when writing fixtures.

## Providers — verified live (real IDs fetched)

- **UniProt** `rest.uniprot.org` — `/uniprotkb/search?query=&fields=&format=json&size=&cursor=`, `/uniprotkb/{acc}.json`, `/uniprotkb/stream`. Cursor is in the HTTP **Link** header (`rel="next"`), not the body; `X-Total-Results`, `x-uniprot-release=2026_02`; cofactors are ChEBI xrefs under `comments[COFACTOR]`; PDB + AlphaFoldDB live in one `uniProtKBCrossReferences[]` array. Real: Q43125 (CRY1_ARATH), Q75WS4.
- **InterPro** `ebi.ac.uk/interpro/api` — `/entry/interpro/protein/uniprot/{acc}/`; positional matches nested `results[].proteins[].entry_protein_locations[].fragments[].{start,end}`, discontinuous (multi-fragment) supported. Real: IPR000014 PAS domain on CRY1.
- **RCSB** — Search v2 returns only `{identifier,score}`+`total_count` → must follow each hit with Data API `/core/entry/{id}` (method/resolution/`nonpolymer_bound_components`) and `/core/nonpolymer_entity` (cofactor comp_id); coords at `files.rcsb.org/download`. Real: 5DKL (LOV+FMN, total_count=99).
- **AlphaFold** `alphafold.ebi.ac.uk` — `/api/prediction/{acc}` returns an **array**; `globalMetricValue`=mean pLDDT; direct files `AF-{acc}-F1-model_v{V}.cif/.pdb`. Real: P0DP23 (148 KB cif).
- **FPbase** — `/api/proteins/?slug={slug}&format=json` returns a 1-element array; photophysics inside `states[]` (ex/em/qy…), disambiguate by slug. Real: EGFP (uuid R9NL8). Reference-only license note.

## Physics — verified live

- **PySCF 2.12.1** open-shell single points run: CH3• UHF/sto-3g 0.045 s; **phenazine radical anion (14 heavy) UHF 6-31G 7.8 s, 6-31G\* 30 s**. Plan: truncate cofactor to the **isoalloxazine core (~15–17 heavy), UHF/ROHF 6-31G single point, ~10–40 s** offline budget. Full flavin is intractable in 60 s → must truncate. Output is an **assumption-derived cluster adapter**, never a whole-protein spin-response claim.
- **RadicalPy 1.0.9** — repo MARY path runs (37-pt curve, 1.17 s); real spin dynamics only for DB/hand-specified radicals (matches the claim boundary).
- **ESM-2** — `esm2_t6_8M_UR50D` loads offline (cached, 0.05 s) → embeddings for **public analog search only**, never spin. MMseqs2 17-b804f runs real searches. No GPU (MPS only); 650M/3B impractical.
- **Critical gotcha:** importing torch/esm with pyscf/numpy in ONE process aborts (macOS OpenMP `Error #15`, SIGABRT). **Mitigation: run PySCF and torch/ESM in separate subprocesses.** The physics pipeline must isolate them.

## Design decisions (Phase 1)

- Python **FastAPI + Pydantic v2** service at `backend/` = authoritative Phase-2
  contract source; **TS types generated** from its OpenAPI into `src/contracts/`.
- Existing TS invariants preserved: `status:"public_hypothesis_not_validated"`,
  `privateCandidate:false`, the claim firewall, boundary tests, the RadicalPy
  artifact, Tufte charts, `experimentScore`, `instruments`/`evidenceCards`.
- Contracts: `ObjectiveSpec`, `Provenance` (retrieval-time), normalized provider
  records, `PhysicsEligibility` (kinds: real_spin_dynamics | qm_cluster_assumption
  | analytic_proxy_only | ineligible), `CandidateRecord`, `CandidateDossier`,
  `RunState`/`RunEvent`. All `extra=forbid`, `frozen`, Literal-pinned safety fields.
- Run state machine: queued → compiling_objective → retrieving_evidence →
  assessing_physics → simulating → ranking → planning → completed (+ failed,
  cancelled). Simulation for EVERY candidate BEFORE ranking. Invalid objective →
  422 with surfaced issues.
- **Boundary preserved:** normal results carry real accessions but NO orderable
  sequence/mutation list; embeddings = analog search only; proxy amplitudes barred
  from the computed shortlist; providers default to offline `mode=fixture` with
  full provenance + explicit `degradations`.
