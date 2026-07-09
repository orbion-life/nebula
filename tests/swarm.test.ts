import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { runDiscoverCore } from "../src/core/discoverCore";
import {
  SWARM_ARCHITECTURE_ID,
  SWARM_ARCHITECTURE_VERSION,
  SWARM_STAGE_ORDER,
} from "../src/core/swarm/architecture";
import { stableFingerprint } from "../src/core/swarm/fingerprint";
import { SWARM_LENSES } from "../src/core/swarm/lenses";
import { mapLenses } from "../src/core/swarm/map";
import { reduceLensReports } from "../src/core/swarm/reduce";
import {
  SWARM_LENS_COUNT,
  runSwarmOrchestrator,
  runSwarmPanel,
} from "../src/core/swarm";

describe("mandatory adversarial swarm", () => {
  const result = runDiscover(DEMO_OBJECTIVE, 1337);

  it("attaches swarmReview to every pipeline result", () => {
    expect(result.swarmReview).toBeDefined();
    expect(result.swarmReview.lenses).toHaveLength(SWARM_LENS_COUNT);
    expect(["pass", "warn", "fail"]).toContain(result.swarmReview.verdict);
  });

  it("uses hierarchical map-reduce producer-reviewer architecture", () => {
    expect(result.swarmReview.architecture).toBe(SWARM_ARCHITECTURE_ID);
    expect(result.swarmReview.version).toBe(SWARM_ARCHITECTURE_VERSION);
    expect(result.swarmReview.stages.map((s) => s.stage)).toEqual([
      ...SWARM_STAGE_ORDER,
    ]);
    expect(result.swarmReview.verification.deterministic).toBe(true);
    expect(result.swarmReview.verification.inputFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(result.swarmReview.verification.outputFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(result.swarmReview.arbiter.verdict).toBe(result.swarmReview.verdict);
  });

  it("runs 4 sentry + 6 committee lenses", () => {
    const sentry = result.swarmReview.lenses.filter((l) => l.tier === "sentry");
    const committee = result.swarmReview.lenses.filter(
      (l) => l.tier === "committee",
    );
    expect(sentry).toHaveLength(4);
    expect(committee).toHaveLength(6);
  });

  it("runs all lenses in deterministic order", () => {
    const again = runDiscover(DEMO_OBJECTIVE, 1337);
    expect(again.swarmReview).toEqual(result.swarmReview);
    const ids = result.swarmReview.lenses.map((l) => l.lens);
    expect(ids).toEqual([...ids].sort());
  });

  it("passes the demo objective with no blockers", () => {
    expect(result.swarmReview.verdict).not.toBe("fail");
    expect(result.swarmReview.counts.blocker).toBe(0);
  });

  it("panel matches standalone orchestrator on core output", () => {
    const core = runDiscoverCore(DEMO_OBJECTIVE, 1337);
    const panel = runSwarmPanel({
      result: { ...core, swarmReview: undefined! },
      raw: DEMO_OBJECTIVE,
      seed: 1337,
    });
    expect(panel).toEqual(result.swarmReview);
    expect(runSwarmOrchestrator({
      result: { ...core, swarmReview: undefined! },
      raw: DEMO_OBJECTIVE,
      seed: 1337,
    })).toEqual(result.swarmReview);
  });
});

describe("swarm map-reduce phases", () => {
  const core = runDiscoverCore(DEMO_OBJECTIVE, 1337);
  const ctx = {
    result: { ...core, swarmReview: undefined! },
    raw: DEMO_OBJECTIVE,
    seed: 1337,
  };

  it("map phase returns sorted lens reports with tiers", () => {
    const mapped = mapLenses(ctx, SWARM_LENSES);
    expect(mapped).toHaveLength(SWARM_LENS_COUNT);
    expect(mapped.every((l) => l.trustWeight > 0)).toBe(true);
    expect(mapped.map((l) => l.lens)).toEqual([...mapped.map((l) => l.lens)].sort());
  });

  it("reduce phase produces arbiter + severity-weighted verdict", () => {
    const mapped = mapLenses(ctx, SWARM_LENSES);
    const reduced = reduceLensReports(mapped, SWARM_LENSES);
    expect(reduced.arbiter.rationale).toMatch(/Severity-weighted consensus/);
    if (reduced.counts.blocker > 0) {
      expect(reduced.verdict).toBe("fail");
      expect(reduced.arbiter.requiredPatches.length).toBeGreaterThan(0);
    }
  });

  it("fingerprint is stable for identical inputs", () => {
    const a = stableFingerprint({ seed: 1337, text: "demo" });
    const b = stableFingerprint({ seed: 1337, text: "demo" });
    expect(a).toBe(b);
    expect(a).not.toBe(stableFingerprint({ seed: 9999, text: "demo" }));
  });
});

describe("swarm escalation", () => {
  it("escalates when two committee lenses warn on the same theme", () => {
    const reports = [
      {
        lens: "controls-reviewer",
        persona: "Controls",
        tier: "committee" as const,
        trustWeight: 75,
        verdict: "warn" as const,
        findings: [
          { severity: "warning" as const, message: "missing control A", theme: "controls" },
        ],
      },
      {
        lens: "quantum-sensing-physicist",
        persona: "Physicist",
        tier: "committee" as const,
        trustWeight: 70,
        verdict: "warn" as const,
        findings: [
          { severity: "warning" as const, message: "missing control B", theme: "controls" },
        ],
      },
    ];
    const reduced = reduceLensReports(reports, SWARM_LENSES);
    expect(reduced.escalations).toHaveLength(1);
    expect(reduced.escalations[0].theme).toBe("controls");
    expect(reduced.verdict).toBe("fail");
    expect(reduced.counts.blocker).toBeGreaterThan(0);
  });
});
