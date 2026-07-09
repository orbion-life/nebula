---
name: accessibility-demo-pass
description: Ensure demo UI is readable on video — contrast, font size, colorblind-safe charts.
---

# Accessibility Demo Pass

Target: `src/ui/theme.css`, `LineChart.tsx`, masthead badges.

## Video checklist

- [ ] Body text ≥12px; section titles readable at 1080p
- [ ] Chart lines distinguishable (control green, nuisance amber, signal teal)
- [ ] Verdict badges (pass/warn/fail) not color-only — text label present
- [ ] Falsification card visually distinct (`.rcard.falsify`)
- [ ] Sentry vs committee swarm headings visible
- [ ] No low-contrast gray on cream background for critical labels

## Quick fixes

Increase `--muted` contrast; add patterns to chart lines if needed.

## Not required for hackathon

Full WCAG audit — optimize for **recording readability**.
