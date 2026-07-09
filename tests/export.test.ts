import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { buildRationale } from "../src/core/rationale";
import { generateParameterSpace } from "../src/core/physics";
import { simulate } from "../src/core/simulator";
import { routeById } from "../src/core/fixtures/routes";
import { exportMarkdown } from "../src/core/export";

describe("measurement handoff export", () => {
  const result = runDiscover(DEMO_OBJECTIVE, 1337);
  const second = result.ranking[1];
  const hyp2 = result.hypotheses.find((h) => h.id === second.hypothesisId)!;
  const route2 = routeById(hyp2.mechanismRouteId)!;
  const space2 = generateParameterSpace(route2);
  const sim2 = simulate(route2, space2, 1337);
  const rat2 = buildRationale(hyp2, route2);

  it("includes falsification, parameter space, and swarm sections", () => {
    const md = exportMarkdown(result);
    expect(md).toMatch(/Falsification criteria/i);
    expect(md).toMatch(/Assumption parameter space/i);
    expect(md).toMatch(/Mandatory swarm review/i);
    expect(md).toMatch(/Mechanism route \(causal chain\)/i);
  });

  it("exports the UI-selected hypothesis when options provided", () => {
    const md = exportMarkdown(result, {
      hypothesisId: hyp2.id,
      rationale: rat2,
      simulation: sim2,
      parameterSpace: space2,
      route: route2,
    });
    expect(md).toMatch(new RegExp(hyp2.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(md).toMatch(new RegExp(`rank #${second.rank}`));
    expect(md).not.toMatch(/Exported for:.*rank #1/);
  });
});
