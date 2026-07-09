import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { compileObjective } from "../src/core/objectiveCompiler";
import { generateHypotheses } from "../src/core/constructGenerator";
import { routeById } from "../src/core/fixtures/routes";
import { instrumentById } from "../src/core/fixtures/instruments";
import { computeSimulationEvidence } from "../src/core/simulationEvidence";
import { scoreExperiments } from "../src/core/experimentScore";
import { RADICAL_PAIR_ARTIFACT } from "../src/core/generated/radicalPair";

/**
 * MANDATORY acceptance test: changing the physics or the instrument constraints
 * changes the experiment ranking. Simulation happens before ranking, so the
 * ranking is a function of the simulated evidence and the instrument.
 */
describe("ranking sensitivity", () => {
  it("changing the instrument changes the ranking order", () => {
    const bench = runDiscover(DEMO_OBJECTIVE, 1337, "benchtop_field_fluorimeter")
      .ranking.map((r) => r.hypothesisId);
    const plate = runDiscover(DEMO_OBJECTIVE, 1337, "plate_reader_screen")
      .ranking.map((r) => r.hypothesisId);
    expect(bench).not.toEqual(plate); // a genuine reorder, not just score deltas
  });

  const objective = compileObjective({ objectiveText: DEMO_OBJECTIVE.objectiveText });
  const hyps = generateHypotheses(objective);
  const confocal = instrumentById("odmr_confocal")!;
  const collapsed = RADICAL_PAIR_ARTIFACT.data.controls.relaxation_dominated.mfePercent;

  function rankOrder(collapse: boolean): string[] {
    const inputs = hyps.map((h) => {
      const route = routeById(h.mechanismRouteId)!;
      const isRP = route.simulatorPlugin === "radical_pair_response_proxy";
      const evidence = computeSimulationEvidence(h, route, confocal, 1337, {
        radicalPairMfeOverride: isRP && collapse ? collapsed : undefined,
      });
      return { hypothesis: h, route, evidence };
    });
    return scoreExperiments(inputs, confocal, objective).map((r) => r.hypothesisId);
  }

  it("changing the physics changes the ranking order", () => {
    expect(rankOrder(false)).not.toEqual(rankOrder(true));
  });

  it("a radical-pair route loses rank when its simulated signature collapses", () => {
    const rp = "ch_01_LOV_flavin";
    const nominalRank = rankOrder(false).indexOf(rp);
    const collapsedRank = rankOrder(true).indexOf(rp);
    // Higher index == worse rank. Collapsing the spin-dynamics signature must
    // push the radical-pair route down.
    expect(collapsedRank).toBeGreaterThan(nominalRank);
  });

  it("the top-ranked hypothesis is observable on its instrument", () => {
    const result = runDiscover(DEMO_OBJECTIVE, 1337);
    const topEvidence = result.simulationEvidence.find(
      (e) => e.hypothesisId === result.selectedHypothesisId,
    )!;
    expect(topEvidence.observable).toBe(true);
  });
});
