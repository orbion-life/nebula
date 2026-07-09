import { describe, expect, it } from "vitest";
import { allAdapterProbes } from "../src/adapters";
import { esmAnalogSearch } from "../src/adapters/retrieval/esm";
import { faissSearch } from "../src/adapters/retrieval/faiss";
import { radicalPySimulate } from "../src/adapters/physics/radicalpy";
import { qutipSimulate } from "../src/adapters/physics/qutip";
import { pyscfCompute } from "../src/adapters/physics/pyscf";
import { rfdiffusionGenerate } from "../src/adapters/design/rfdiffusion";
import { ligandMpnnDesign } from "../src/adapters/design/ligandmpnn";
import { proteinMpnnDesign } from "../src/adapters/design/proteinmpnn";
import { boltzPredict } from "../src/adapters/design/boltz";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";

describe("core independence", () => {
  it("core pipeline runs with no research adapter configured", () => {
    const result = runDiscover(DEMO_OBJECTIVE, 1337);
    expect(result.product).toBe("Nebula Discover");
    expect(result.hypotheses.length).toBeGreaterThanOrEqual(3);
  });
});

describe("adapters fail gracefully", () => {
  const probes = allAdapterProbes();

  it("covers all 13 named adapters", () => {
    expect(probes).toHaveLength(13);
  });

  it("every adapter is unavailable and returns the required graceful fields", () => {
    for (const p of probes) {
      expect(p.available).toBe(false);
      expect(p.wouldDo.length).toBeGreaterThan(0);
      expect(p.requiredSetup.length).toBeGreaterThan(0);
      expect(p.claimBoundary.length).toBeGreaterThan(0);
      expect(p.fixtureFallback).toBeDefined();
    }
  });
});

describe("retrieval = public analog search only", () => {
  it("esm + faiss claim boundaries say analog search only", () => {
    for (const fn of [esmAnalogSearch, faissSearch]) {
      const r = fn("blue-light flavin sensor");
      expect(r.claimBoundary.toLowerCase()).toContain("analog search only");
      expect(Array.isArray(r.fixtureFallback.hits)).toBe(true);
    }
  });

  it("fallback analog search returns deterministic public hits", () => {
    const a = esmAnalogSearch("radical pair magnetic field");
    const b = esmAnalogSearch("radical pair magnetic field");
    expect(a.fixtureFallback.hits).toEqual(b.fixtureFallback.hits);
    expect(a.fixtureFallback.hits.length).toBeGreaterThan(0);
  });
});

describe("physics = synthetic assumption sweeps", () => {
  it("physics adapters label output synthetic and reference assumptions", () => {
    for (const fn of [radicalPySimulate, qutipSimulate, pyscfCompute]) {
      const r = fn();
      expect(r.fixtureFallback.label).toBe("synthetic assumption sweep, not prediction");
      expect(r.claimBoundary.toLowerCase()).toMatch(/synthetic|assumption|unless|model output/);
    }
  });
});

describe("design adapters = safe public handoffs", () => {
  it("emit only PUBLIC-DEMO-STUB artifacts, never a real sequence or validated sensor", () => {
    for (const fn of [rfdiffusionGenerate, ligandMpnnDesign, proteinMpnnDesign, boltzPredict]) {
      const r = fn();
      expect(r.fixtureFallback.publicDemoOnly).toBe(true);
      expect(r.fixtureFallback.artifactPreview.startsWith("PUBLIC-DEMO-STUB")).toBe(true);
      // never an amino-acid-sequence-looking string
      expect(r.fixtureFallback.artifactPreview).not.toMatch(/\b[ACDEFGHIKLMNPQRSTVWY]{12,}\b/);
    }
  });
});
