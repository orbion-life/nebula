# IP Boundary

Nebula Discover is the **public** discovery-module concept for Nebula. This file
defines what the public artifact may and may not do. The runtime claim firewall
(`src/core/claimFirewall.ts`) and the boundary tests (`tests/boundary.test.ts`)
enforce these rules in CI.

## Allowed public claim

> Nebula Discover generates public construct hypotheses and simulates
> transparent, assumption-driven multimodal measurement signatures for
> literature-backed protein-sensor routes, then turns them into
> measurement-ready hypotheses.

## The public artifact must NOT

- claim it predicts magnetic/RF fluorescence response for arbitrary proteins;
- claim it discovers or validates working quantum biosensors;
- claim to be the full private Nebula engine;
- contain private ranking, calibration, construct generation, partner targets,
  or wet-lab data;
- present generated construct hypotheses or design-adapter artifacts as
  commercial candidates;
- claim that sequence, AlphaFold, or ESM determine spin response;
- present any simulated trace as measured data or prediction.

## Public vs private

| Released here (public) | Kept private (not in this repo) |
| --- | --- |
| construct-hypothesis schema | real construct generation / selection |
| mechanism route taxonomy | proprietary ranking + calibration |
| public evidence-card schema | partner / measurement data |
| synthetic simulation scaffolding | private spin / electronic-structure scoring |
| claim firewall + measurement-handoff language | mutation shortlists |
| Tufte UI patterns + public fixtures | private embeddings, wet-lab feedback |

## Private continuation (NOT implemented here)

```text
public construct hypotheses
  -> internal developability / thermostability triage
  -> private spin / electronic-structure scoring
  -> partner measurement
  -> calibrated ranked construct shortlist
```

This continuation is intentionally out of scope for the public module.

## Leak scan (run before submission)

Two layers, so the public repo never has to embed private strings verbatim:

1. **Generic, committed scan** — safe to keep public:

```bash
rg -n "validated sensor|predicts magnetic|discovered a (working )?(quantum )?biosensor|/Users/" .
```

2. **Private specifics** — the exact home paths, company domain, and retired
   private codenames live ONLY in a gitignored `.leak-terms.local.json` on the
   developer machine. Scan for them locally without committing them:

```bash
node -e "const t=require('./.leak-terms.local.json').terms; console.log(t.join('|'))" \
  | xargs -I{} rg -n "{}" .
```

Expected result: no hits outside this file and `tests/boundary.test.ts`.
`tests/boundary.test.ts` enforces both layers in CI: it always checks the generic
markers and, when `.leak-terms.local.json` is present, also checks the private
specifics — in source files and in the generated export artifacts. The public
repository must never contain the private specifics as literal text.
