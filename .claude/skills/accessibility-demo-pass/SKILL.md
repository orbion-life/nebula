---
name: accessibility-demo-pass
description: Ensure demo UI is readable on video — contrast, font size, colorblind-safe charts.
---

# Accessibility Demo Pass

Target: `src/ui/theme.css`, `LineChart.tsx`, screen headers + honest status labels.

## Video checklist

- [ ] Body text ≥12px; section titles readable at 1080p
- [ ] Chart lines distinguishable (control green, nuisance amber, signal teal)
- [ ] Verdict badges (pass/warn/fail) not color-only — text label present
- [ ] Falsification kill criterion visually distinct on Measure next
- [ ] Release audit disclosure readable (verdict + lens tiers)
- [ ] No low-contrast gray on cream background for critical labels

## Quick fixes

Increase `--muted` contrast; add patterns to chart lines if needed.

## Not required for hackathon

Full WCAG audit — optimize for **recording readability**.
