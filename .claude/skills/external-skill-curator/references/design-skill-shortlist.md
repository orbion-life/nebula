# External Design / UX Skill Shortlist

This note summarizes the attached skill list for Nebula. It is a
selection guide, not an installation record.

## Best fit

| Skill | Source | Use for Nebula | Install level |
| --- | --- | --- | --- |
| Anthropic `frontend-design` | `anthropics/skills` | Cinematic, distinctive UI direction when the app feels generic | Personal |
| Vercel `web-design-guidelines` | `vercel-labs/agent-skills` | UI/UX and accessibility quality review | Personal or plugin |
| Vercel `react-best-practices` | `vercel-labs/agent-skills` | React performance and bundle hygiene | Personal or plugin |
| Vercel `composition-patterns` | `vercel-labs/agent-skills` | Component API cleanup and avoiding boolean-prop sprawl | Personal or plugin |
| AccessLint | `accesslint/claude-marketplace` | Contrast, WCAG, link-purpose, color-only-state audits | Plugin if reviewed |

## Conditional

| Skill | Decision | Reason |
| --- | --- | --- |
| UI/UX Pro Max | Use only after script review | Useful database, but includes a Python CLI and broad design opinions |
| Bencium UX Designer | Optional personal skill | Strong UX reference, but license/source need review before vendoring |

## Skip for now

| Skill | Reason |
| --- | --- |
| Vercel React Native Skills | This is a web app, not a React Native/Expo app |

## Installation commands, if the user explicitly asks

Install personal skills outside the repo:

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/anthropics/skills.git /tmp/anthropic-skills
cp -R /tmp/anthropic-skills/skills/frontend-design ~/.claude/skills/

git clone https://github.com/vercel-labs/agent-skills.git /tmp/vercel-agent-skills
cp -R /tmp/vercel-agent-skills/skills/web-design-guidelines ~/.claude/skills/
cp -R /tmp/vercel-agent-skills/skills/react-best-practices ~/.claude/skills/
cp -R /tmp/vercel-agent-skills/skills/composition-patterns ~/.claude/skills/
```

AccessLint is better installed as a plugin, after review:

```text
/plugin marketplace add accesslint/claude-marketplace
/plugin install accesslint@accesslint
```

## Repo policy

Do not vendor third-party skill folders under `.claude/skills/` unless the user
explicitly asks. If vendoring is requested, add the source, license, exact commit,
and security review outcome in a small note before committing.

## How to combine with local skills

1. External creative pass: frontend-design or UI/UX skill.
2. Local claim pass: `claim-boundary`.
3. Local visual pass: `visual-system`.
4. External quality pass: Vercel guidelines or AccessLint.
5. Local demo pass: `accessibility-demo-pass` and `adversarial-swarm`.

