# Skeptic Pass

Run the **mandatory** adversarial swarm first, then a multi-persona skeptic panel
against the current repo, then patch it.

## Step 1 — Swarm (required)

Run `/swarm-review` or `npm test tests/swarm.test.ts`. Every `DiscoverResult`
must include `swarmReview`. Blockers from the swarm must be fixed before
continuing.

## Step 2 — Extended panel

Personas: quantum-sensing physicist; protein engineer; protein-design scientist;
biomaterials customer; hackathon judge; IP/claim auditor; UI clarity critic.

Find: false scientific claims; missing controls; weak mechanisms; unclear
construct logic; fake confidence; confusing visuals; private leakage; demo
failure risks.

Patch the repo after the critique, then re-run `npm test` and `npm run build`.
