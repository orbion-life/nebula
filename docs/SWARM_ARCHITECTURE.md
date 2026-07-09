# Swarm Architecture

Nebula Discover uses a **mandatory** adversarial swarm after every pipeline run.
The implementation is deterministic TypeScript (offline-safe, seed-stable) that
mirrors research-backed multi-agent patterns used in production MAS design.

## Pattern: Hierarchical Map-Reduce + Producer-Reviewer

```text
Discover pipeline (PRODUCER)
  → ORCHESTRATE  freeze artifact + immutable reviewer context
  → MAP          parallel specialist lenses (4 sentry + 6 committee)
  → REDUCE       severity-weighted consensus + cross-lens escalation
  → SYNTHESIZE   arbiter decision + verification manifest
```

### Why this architecture

| Research pattern | How we use it |
| --- | --- |
| **Map-Reduce** (LangGraph Send / AgentPatterns) | MAP fans out identical review operation to N specialist lenses; REDUCE aggregates |
| **Producer-Reviewer** (Planner-Generator-Evaluator) | Discover core produces artifact; swarm reviewers see artifact + frozen rubric only |
| **Pipeline Triad** (Creator → Critic → Arbiter) | Core = creator; lenses = critics; `arbiter` field = binding pass/warn/fail |
| **Severity-weighted consensus** (not majority vote) | Blockers always fail; avoids adversarial-majority collapse (arXiv:2604.17139) |
| **Trusted-first synthesis** (Frontiers 2026 MAS) | Sentry lenses + trusted-first patch ordering in arbiter |
| **Two-tier staging** (MAS-Shield style) | Fast **sentry** lenses gate release; **committee** lenses deep-audit |

## Lens tiers

| Tier | Count | Lenses | Role |
| --- | --- | --- | --- |
| Sentry | 4 | reproducibility, claim-IP, protein engineer, hackathon judge | Fast structural gates |
| Committee | 6 | quantum physicist, protein-design, biomaterials, controls, evidence, UI | Deep domain audit |

## Cross-lens escalation

When **≥2 committee lenses** flag warnings in the **same theme** (e.g. `controls`),
REDUCE escalates one warning → blocker. This is theme agreement, not majority
voting on unrelated issues.

## Verification manifest

Every `SwarmConsensus` carries:

- `verification.inputFingerprint` — hash of frozen producer inputs
- `verification.outputFingerprint` — hash of verdict + lens outcomes
- `verification.deterministic: true` — same seed → same manifest

Run `npm test tests/swarm.test.ts` to verify.

## Code map

| Module | File |
| --- | --- |
| Architecture constants | `src/core/swarm/architecture.ts` |
| Lens registry (frozen rubric) | `src/core/swarm/lenses.ts` |
| MAP phase | `src/core/swarm/map.ts` |
| REDUCE phase | `src/core/swarm/reduce.ts` |
| Orchestrator | `src/core/swarm/index.ts` |
| Public API | `runSwarmPanel`, `runSwarmOrchestrator`, `SWARM_LENS_COUNT` |

## Claude mirror

The `.claude/agents/swarm-orchestrator.md` agent and `adversarial-swarm` skill
mirror this runtime architecture for human/LLM-driven sessions. The TypeScript
orchestrator is the source of truth for the demo and CI.

## References (public)

- Map-Reduce multi-agent pattern — [AgentPatterns.ai](https://agentpatterns.ai/multi-agent/llm-map-reduce/)
- Producer-Reviewer / Pipeline Triad — [Agent Patterns Catalog](https://www.agentpatternscatalog.org/patterns/pipeline-triad-pattern/)
- Adversarial majority / consensus trap — [arXiv:2604.17139](https://arxiv.org/abs/2604.17139)
- MAS adversarial robustness — [Frontiers in AI 2026](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1784484/full)
- Enterprise MAS orchestration — [arXiv:2601.13671](https://arxiv.org/html/2601.13671v1)
