# Swarm Review (mandatory)

Run the mandatory adversarial swarm against the current repo. This is **not**
optional — every Discover result must carry a `swarmReview` consensus.

## Steps

1. Read `src/core/swarm/lenses.ts` and confirm all 10 lenses are present.
2. Run `npm test` (especially `tests/swarm.test.ts`).
3. Run `npm run dev` and open the **Release audit** disclosure on the Measure next
   screen to confirm the deterministic consensus for the demo objective.
4. If verdict is `fail`, patch blockers and re-run until clean.
5. If adding a new pipeline stage, add or update a lens so the swarm still covers
   the new failure mode.

## Lenses (deterministic code, mirrored by the Claude review group)

Quantum-sensing physicist; protein engineer; protein-design scientist;
biomaterials customer; hackathon judge; IP/claim auditor; reproducibility
engineer; UI clarity critic; controls reviewer; evidence auditor.

Patch the repo after any blocker findings, then re-run `npm test` and
`npm run build`.
