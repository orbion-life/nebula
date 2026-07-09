import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { buildRationale } from "../src/core/rationale";

describe("falsification criteria", () => {
  it("adds a falsification card to rationale", () => {
    const result = runDiscover(DEMO_OBJECTIVE, 1337);
    const hyp = result.hypotheses.find((h) => h.id === result.selectedHypothesisId)!;
    const cards = buildRationale(hyp, result.selectedRoute);
    const falsify = cards.find((c) => c.kind === "falsification_criteria");
    expect(falsify).toBeDefined();
    expect(falsify!.bullets.length).toBeGreaterThanOrEqual(2);
    expect(falsify!.bullets.join(" ")).toMatch(/abandon|falsif|discard|downgrade/i);
  });
});
