---
name: external-skill-curator
description: Evaluate and optionally install external Claude skills for Nebula Discover UI, UX, React, accessibility, and design work without weakening the project claim firewall.
---

# External Skill Curator

Use this when the user asks to add, install, compare, or use outside Claude
skills/plugins for Nebula Discover.

## Default decision

Do not copy third-party skill folders into this repo by default. Project-level
skills should stay Nebula-specific. External design, React, and accessibility
skills belong in the user's personal `~/.claude/skills/` or plugin install path
unless the user explicitly wants a vendored dependency.

## Curated shortlist

Read `references/design-skill-shortlist.md` when deciding whether a skill makes
sense for this project.

## Security gate

Before recommending or installing any external skill:

1. Read its `SKILL.md`.
2. Inspect bundled scripts before running them.
3. Check license and source reputation.
4. Reject skills that ask for broad shell/network access without a clear need.
5. Never install a skill that can weaken `IP_BOUNDARY.md`, `CLAUDE_USE.md`, or the
   runtime claim firewall.

## Nebula-specific priority

External skills can improve visuals, accessibility, React performance, or motion.
They must not rewrite the scientific story. These local skills stay authoritative:

- `claim-boundary`
- `visual-system`
- `accessibility-demo-pass`
- `measurement-worthiness`
- `mechanism-route`
- `adversarial-swarm`

## Recommended use

- For cinematic web polish: use a personal install of Anthropic
  `frontend-design`, then apply local `visual-system` and `claim-boundary`.
- For UI correctness: use Vercel `web-design-guidelines`, then run local
  `accessibility-demo-pass`.
- For React performance: use Vercel `react-best-practices` and
  `composition-patterns`.
- For WCAG/contrast: use AccessLint if the plugin is installed and reviewed.

## Not recommended for this repo

- React Native skills: irrelevant unless the project becomes mobile.
- Broad community UI packs with unknown license or heavy scripts: only install
  after manual review.
- Any skill that encourages generic dashboards, fake confidence gauges, or
  overconfident sensor claims.

