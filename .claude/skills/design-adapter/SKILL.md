---
name: design-adapter
description: Represent RFdiffusion/LigandMPNN/ProteinMPNN as optional, public-demo-only design adapters.
---

# Design Adapter

Reference: `src/core/designAdapter.ts`, `src/core/fixtures/designAdapterDemo.ts`.

## Core-demo rule

The app must work if no design tool runs live. Use `template_stub` or
`precomputed_demo` unless a live run is trivial. Degrade gracefully on failure.

## Output (`DesignAdapterOutput`)

`adapter`, `status`, `generatedArtifactType`, `publicDemoOnly: true`,
`artifactPreview` (prefixed `PUBLIC-DEMO-STUB`), `warnings`, `nextPrivateNebulaStep`.

## Guardrails

No private candidate claims. No ready-to-test sequence claims. No real Orbion
mutation shortlist.
