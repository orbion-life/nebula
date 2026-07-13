/**
 * Claim-firewall coverage for the SHIPPED dossier export.
 *
 * The legacy boundary test only ran the retired src/core export through the firewall;
 * the artifact a judge/collaborator actually downloads is Workspace's dossier Markdown.
 * This runs that exact export (worst case: a computed spin value + the highest
 * claim ceiling) through the affirmative-claim firewall and the private-path leak scan.
 */
import { describe, expect, it } from "vitest";
import { exportAffirmativeViolations } from "../src/core/claimFirewall";
import { dossierBriefHtml, dossierMarkdown } from "../src/ui/discover/dossierExport";
import type { CandidateDossier, CandidateRecord, RunState } from "../src/api/client";

const candidate = {
  candidate_id: "cand_Q8LPD9_LOV_flavin_radical_pair",
  title: "Phototropin-2 LOV2 (Arabidopsis thaliana) — LOV_flavin candidate",
  status: "public_hypothesis_not_validated",
  private_candidate: false,
  route_class: "LOV_flavin_radical_pair",
  claim_ceiling: "partner_ready_dossier", // worst case: highest ceiling
  uniprot: { primary_accession: "Q8LPD9" },
  why_it_might_work: ["FMN cofactor annotated in UniProt — the redox/photo-active center this route needs."],
  why_it_might_fail: ["No candidate-specific spin-dynamics artifact; effect may be below the instrument noise floor."],
  required_controls: ["Illuminated no-field control", "Oxygen level control"],
} as unknown as CandidateRecord;

const dossier = {
  candidate,
  status: "public_hypothesis_not_validated",
  disclaimers: [
    "Unvalidated public-protein candidate hypothesis; requires experimental measurement.",
    "Computation is not validation; no working sensor is claimed.",
  ],
  physics_eligibility: {
    qm_cluster_plan: { candidate_specific: true },
    assumptions: [{ name: "candidate_isoalloxazine_max_spin_density", value: 1.0706, range: [0, 1], uncertainty: "high" }],
  },
} as unknown as CandidateDossier;

const run = {
  run_id: "run_deadbeef",
  seed: 1337,
  offline: false,
  input_fingerprint: "abc123",
} as unknown as RunState;

describe("shipped dossier export boundary", () => {
  const md = dossierMarkdown(candidate, dossier, run);

  it("triggers no affirmative claim-firewall violations", () => {
    expect(exportAffirmativeViolations(md)).toEqual([]);
  });

  it("leaks no private path", () => {
    expect(md.includes("/Users/")).toBe(false);
  });

  it("carries the unvalidated + computation-is-not-validation boundary", () => {
    expect(md).toContain("unvalidated public-protein candidate hypothesis");
    expect(md).toContain("Computation is not validation");
  });

  it("includes the requested contact details", () => {
    expect(md).toContain("Aniruddh Goteti");
    expect(md).toContain("aniruddh.goteti@orbion.life");
    expect(md).toContain("www.orbion.life");
  });

  it("qualifies the computed spin number so it cannot be quoted as a performance figure", () => {
    expect(md).toMatch(/NOT a performance or spin-response prediction/);
  });

  it("humanizes the claim ceiling, never the raw partner_ready_dossier token", () => {
    expect(md).not.toContain("partner_ready_dossier");
    expect(md).toContain("measurement collaborator handoff");
  });

  it("sanitizes unsafe text arriving from a public record before export", () => {
    const hostile = { ...candidate, title: "A validated sensor" } as CandidateRecord;
    const exported = dossierMarkdown(hostile, { ...dossier, candidate: hostile } as CandidateDossier, run);
    expect(exported).not.toContain("validated sensor");
    expect(exportAffirmativeViolations(exported)).toEqual([]);
  });
});

describe("branded PDF brief (dossierBriefHtml)", () => {
  const html = dossierBriefHtml(candidate, dossier, run, { generatedAt: "2026-07-12" });

  it("is a self-contained branded HTML document with the accession", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Nebula Brief, Q8LPD9");
    expect(html).toContain("Cormorant Garamond"); // the brand display serif
    expect(html).toContain("nebula"); // wordmark
  });

  it("triggers no affirmative claim-firewall violations and leaks no private path", () => {
    expect(exportAffirmativeViolations(html)).toEqual([]);
    expect(html.includes("/Users/")).toBe(false);
  });

  it("carries the unvalidated boundary and humanizes the claim ceiling", () => {
    expect(html).toContain("Unvalidated public-protein candidate hypothesis");
    expect(html).not.toContain("partner_ready_dossier");
    expect(html).toContain("measurement collaborator handoff");
  });

  it("includes the requested contact details", () => {
    expect(html).toContain("Aniruddh Goteti");
    expect(html).toContain("aniruddh.goteti@orbion.life");
    expect(html).toContain("www.orbion.life");
  });

  it("escapes and sanitizes hostile public-record text before it reaches the document", () => {
    const hostile = { ...candidate, title: "<script>alert(1)</script> a validated sensor" } as CandidateRecord;
    const exported = dossierBriefHtml(hostile, { ...dossier, candidate: hostile } as CandidateDossier, run);
    expect(exported).not.toContain("<script>alert(1)</script>"); // escaped, not injected
    expect(exported).not.toContain("validated sensor"); // firewall-rewritten
    expect(exportAffirmativeViolations(exported)).toEqual([]);
  });
});
