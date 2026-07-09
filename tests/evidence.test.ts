import { describe, expect, it } from "vitest";
import { EVIDENCE_CARDS } from "../src/core/fixtures/evidenceCards";
import { MECHANISM_ROUTES } from "../src/core/fixtures/routes";

/**
 * Evidence credibility tests.
 *
 * Enforce that public evidence is anchored to REAL, checkable citations (DOIs),
 * not literature-flavored placeholders, and that demo assumptions are honestly
 * flagged and carry no citation.
 */
const DOI_RE = /^10\.\d{4,9}\/\S+$/;

describe("evidence cards", () => {
  it("every public_literature card has >=1 citation with a well-formed DOI", () => {
    const publicCards = EVIDENCE_CARDS.filter(
      (c) => c.provenance === "public_literature",
    );
    expect(publicCards.length).toBeGreaterThanOrEqual(7);
    for (const c of publicCards) {
      expect(c.citations.length).toBeGreaterThanOrEqual(1);
      for (const cite of c.citations) {
        expect(cite.doi).toMatch(DOI_RE);
        expect(cite.authors.length).toBeGreaterThan(0);
        expect(cite.year).toBeGreaterThan(1990);
        expect(cite.venue.length).toBeGreaterThan(0);
      }
    }
  });

  it("demo_assumption cards are honest: no citations, no fake DOI", () => {
    const demo = EVIDENCE_CARDS.filter((c) => c.provenance === "demo_assumption");
    expect(demo.length).toBeGreaterThanOrEqual(1);
    for (const c of demo) {
      expect(c.citations).toHaveLength(0);
      expect(c.title.toLowerCase()).toContain("demo assumption");
    }
  });

  it("every route public anchor resolves to a real evidence card", () => {
    const ids = new Set(EVIDENCE_CARDS.map((c) => c.id));
    for (const route of MECHANISM_ROUTES) {
      for (const anchor of route.publicAnchors) {
        expect(ids.has(anchor)).toBe(true);
      }
    }
  });
});
