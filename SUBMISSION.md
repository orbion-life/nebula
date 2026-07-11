# Nebula Discover: hackathon submission pack

**Built with Claude: Life Sciences**

## One-line pitch

Turn a sensing objective into annotation-checked public protein hypotheses across
multiple sensing modalities and one falsifiable measurement handoff, with every
physics assumption exposed.

## Problem

Protein and biomaterial teams can generate candidate ideas faster than they can
measure them. Familiar sequence and structure tools do not answer whether a proposed
transduction mechanism (radical-pair, redox, or photochemical) will create a control-surviving readout. Nebula Discover narrows
the public search and makes the next experiment auditable without claiming the sensor
works.

## What the demo proves

- Beginner and expert objectives compile into the same editable contract.
- The sensed quantity drives mechanism-specific public-protein search.
- Public family and cofactor annotations prevent route relabeling.
- A real public structure can support a bounded cofactor-cluster UHF diagnostic.
- Reference spin dynamics, candidate diagnostics, and uncalibrated triage axes remain
  visibly separate.
- The output carries a route-compatible measurement scenario, controls, uncertainty,
  and a falsifier.
- Unsupported objectives, missing evidence, and unavailable WebGL fail honestly.

## What it does not prove

- No working or validated sensor.
- No arbitrary sequence-to-spin-response prediction.
- No calibrated probability of success or predicted performance.
- No complete protein-environment quantum calculation.
- No private Nebula logic, partner target, mutation list, or bench data.

## Claude use

The repository contains the project agents, skills, commands, dated Claude artifacts,
and transparency report used to plan, build, red-team, and document the project. The
scientific execution path is deterministic and inspectable. Claude is not presented as
having run inside the product or produced experimental evidence.

See [`CLAUDE_TRANSPARENCY.md`](./CLAUDE_TRANSPARENCY.md).

## Demo

- Script: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
- Browser flow: Mission Bench -> live run -> seven-scene result narrative -> Markdown handoff
- Offline judging mode: versioned public fixtures and cached public-structure cluster result
- Seed: `1337`

## Verify before submission

```bash
npm test
npm run build
cd backend && python3 -m pytest -q
cd .. && npm run e2e
npm audit --omit=dev
```

Run `/audit-submit` and `/skeptic-pass` in Claude Code after the deterministic suite.

## Draft form fields

**Title:** Nebula Discover: Decide What Deserves Measurement Next

**Description:** Nebula Discover converts a supported sensing objective into a
mechanism-specific public protein search across multiple readout modalities, enriches real accessions with public domain,
cofactor, and structure evidence, exposes bounded physics assumptions, and returns an
unvalidated measurement hypothesis with controls and a kill criterion. It separates
evidence from exploration and abstains rather than manufacturing a winner.
