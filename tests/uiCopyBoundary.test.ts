/**
 * Claim-boundary guard for ON-SCREEN UI copy (not just the downloaded dossier).
 *
 * The bold discoverer voice is free to say "discover" / "invent" about proteins, but the
 * enforced firewall phrases (a validated/working/proven SENSOR, sensor discovery, magnetic
 * response PREDICTION) must never appear affirmatively in the shipped React copy. This scans
 * the source of the primary discover surfaces and fails if any affirmative overclaim slips in.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportAffirmativeViolations } from "../src/core/claimFirewall";

const FILES = [
  "src/ui/discover/DiscoverApp.tsx",
  "src/ui/discover/narrative/NarrativeReplay.tsx",
  "src/ui/discover/narrative/AppliedConstraints.tsx",
  "src/ui/discover/narrative/Metric.tsx",
  "src/ui/discover/objective/MissionBench.tsx",
  "src/ui/discover/cinematic/ActObjective.tsx",
  "src/ui/discover/world/WorldCanvas.tsx",
  "src/ui/discover/Traces.tsx",
];

describe("UI copy stays inside the claim boundary", () => {
  for (const f of FILES) {
    it(`${f} makes no affirmative overclaim`, () => {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
      const violations = exportAffirmativeViolations(src).map((re) => re.source);
      expect(violations, `affirmative overclaim in ${f}`).toEqual([]);
    });
  }
});
