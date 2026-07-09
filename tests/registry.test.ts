import { describe, expect, it } from "vitest";
import {
  LIBRARY_REGISTRY,
  librariesByLayer,
} from "../src/core/libraryRegistry";

/**
 * Registry completeness + claim-boundary tests.
 */

// Every library/source named in the task must be represented in the registry.
const REQUIRED = [
  "Vite",
  "React",
  "TypeScript",
  "zod",
  "recharts",
  "3Dmol",
  "Fuse.js",
  "SQLite",
  "Deterministic",
  "UniProt",
  "RCSB",
  "AlphaFold",
  "FPbase",
  "Biopython",
  "RDKit",
  "gemmi",
  "biotite",
  "ESM-2",
  "ESM-C",
  "FAISS",
  "hnswlib",
  "sentence-transformers",
  "RadicalPy",
  "QuTiP",
  "PySCF",
  "solve_ivp",
  "JAX",
  "NumPyro",
  "RFdiffusion",
  "LigandMPNN",
  "Boltz",
  "ProteinMPNN",
];

describe("library registry", () => {
  const allNames = LIBRARY_REGISTRY.map((l) => l.name).join(" | ");

  it("includes every named library / data source", () => {
    for (const needle of REQUIRED) {
      expect(allNames.includes(needle)).toBe(true);
    }
  });

  it("every entry has a non-empty claim boundary, purpose, and url", () => {
    for (const l of LIBRARY_REGISTRY) {
      expect(l.claimBoundary.length).toBeGreaterThan(0);
      expect(l.purpose.length).toBeGreaterThan(0);
      expect(l.whyItMattersForDiscover.length).toBeGreaterThan(0);
      expect(l.url.startsWith("http")).toBe(true);
    }
  });

  it("no entry affirmatively claims validation or spin/property prediction", () => {
    // These affirmative phrases must never appear; negated forms are worded to
    // avoid them (e.g. 'do NOT predict spin response').
    const AFFIRMATIVE_BAD = [
      /\bis validated\b/i,
      /\bvalidated sensor\b/i,
      /\bpredicts spin\b/i,
      /\bpredicts magnetic\b/i,
      /\bdetermines spin\b/i,
    ];
    for (const l of LIBRARY_REGISTRY) {
      for (const re of AFFIRMATIVE_BAD) {
        expect(`${l.purpose} ${l.claimBoundary} ${l.whyItMattersForDiscover}`).not.toMatch(re);
      }
    }
  });

  it("core layer marks the running stack as installed", () => {
    const core = librariesByLayer("core");
    const installed = core.filter((l) => l.currentStatus === "installed");
    expect(installed.map((l) => l.name)).toEqual(
      expect.arrayContaining(["Vite", "React", "TypeScript"]),
    );
  });

  it("retrieval entries describe embeddings as public analog search, not prediction", () => {
    const retrieval = librariesByLayer("retrieval");
    expect(retrieval.length).toBeGreaterThanOrEqual(2);
    for (const l of retrieval) {
      expect(`${l.purpose} ${l.claimBoundary}`.toLowerCase()).toMatch(
        /analog|search|retriev|similar/,
      );
    }
  });

  it("design adapters are framed as handoffs, not the discovery engine", () => {
    const design = librariesByLayer("design_adapter");
    expect(design.map((l) => l.name)).toEqual(
      expect.arrayContaining(["RFdiffusion", "LigandMPNN", "ProteinMPNN", "Boltz"]),
    );
    for (const l of design) {
      expect(l.claimBoundary.toLowerCase()).toContain("handoff");
    }
  });
});
