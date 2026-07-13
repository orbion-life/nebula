import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { cwd } from "process";
import { describe, expect, it } from "vitest";
import { runDiscover, DEMO_OBJECTIVE } from "../src/core/pipeline";
import { exportAffirmativeViolations } from "../src/core/claimFirewall";
import { exportJson, exportMarkdown } from "../src/core/export";

/**
 * Boundary / leak tests.
 *
 * Enforce the IP firewall in CI. The PUBLIC repo deliberately does NOT hardcode
 * the exact private strings (home paths, company domain, retired codenames);
 * doing so would itself be a leak. Instead:
 *   - generic markers below are committed and always checked;
 *   - the exact private strings live in a gitignored `.leak-terms.local.json`
 *     and are only scanned when that local file is present (developer machine).
 */

// Generic, public-safe markers. "/Users/" catches any absolute home path and
// reveals nothing private on its own. All private specifics (memory-vault names,
// company domain, retired codenames) live in .leak-terms.local.json.
const GENERIC_PRIVATE_MARKERS = ["/Users/"];
// These exact strings are intentional public contact details, requested for the app and
// exported dossier. Keep this list exact: the local domain marker must still catch any
// unrelated occurrence elsewhere in the public repository.
const PUBLIC_CONTACT_STRINGS = [
  "aniruddh.goteti@orbion.life",
  "https://www.orbion.life",
  "www.orbion.life",
];

function localTerms(): string[] {
  const path = join(cwd(), ".leak-terms.local.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed.terms) ? parsed.terms : [];
  } catch {
    return [];
  }
}

describe("generated output boundary", () => {
  const result = runDiscover(DEMO_OBJECTIVE, 1337);
  const blobs = [exportMarkdown(result), exportJson(result)];

  it("design adapter output is public-demo-only with warnings", () => {
    expect(result.designAdapter.publicDemoOnly).toBe(true);
    expect(result.designAdapter.warnings.length).toBeGreaterThan(0);
    expect(result.designAdapter.artifactPreview).toMatch(/PUBLIC-DEMO-STUB/);
  });

  it("exports contain no generic or local private strings", () => {
    const terms = [...GENERIC_PRIVATE_MARKERS, ...localTerms()];
    for (const blob of blobs) {
      for (const term of terms) {
        expect(blob.includes(term)).toBe(false);
      }
    }
  });

  it("exports never make an affirmative validation/discovery claim", () => {
    for (const blob of blobs) {
      expect(exportAffirmativeViolations(blob)).toEqual([]);
    }
  });
});

describe("repository source boundary", () => {
  const root = cwd();
  const scanExts = [".ts", ".tsx", ".md", ".json", ".html", ".css"];
  // Allow the files whose JOB is to define/scan the boundary (they legitimately
  // contain scan vocabulary such as the generic "/Users/" path marker).
  const allowFiles = [
    "IP_BOUNDARY.md",
    "boundary.test.ts",
    "exportBoundary.test.ts", // scans the shipped export for "/Users/" — legitimately holds the marker
    ".leak-terms.local.json",
    "commands/audit-submit.md",
    "audit-submit/SKILL.md",
    "claim-boundary-auditor.md",
  ];

  function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (["node_modules", ".git", "dist", ".vite", "coverage"].includes(entry))
        continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (scanExts.some((e) => full.endsWith(e))) acc.push(full);
    }
    return acc;
  }

  it("no source file leaks private paths, memory, or local audit terms", () => {
    const terms = [...GENERIC_PRIVATE_MARKERS, ...localTerms()];
    const files = walk(root);
    const leaks: string[] = [];
    for (const f of files) {
      if (allowFiles.some((a) => f.endsWith(a))) continue;
      const text = PUBLIC_CONTACT_STRINGS.reduce(
        (source, allowed) => source.replaceAll(allowed, ""),
        readFileSync(f, "utf8"),
      );
      for (const term of terms) {
        if (text.includes(term)) leaks.push(`${f}: ${term}`);
      }
    }
    expect(leaks).toEqual([]);
  });
});
