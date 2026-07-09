import type { ClaimAudit } from "./types";

/**
 * Claim firewall.
 *
 * Scans a claim string for unsafe language and, if blocked, returns a claim-safe
 * rewrite. This is the product's honesty layer: the demo shows an unsafe claim
 * being downgraded live while the plots stay visible.
 */

interface Rule {
  pattern: RegExp;
  label: string;
}

const BLOCKED_RULES: Rule[] = [
  { pattern: /\bdiscover(ed|s|y|ing)?\s+(a|an|the|new|working|our|this)\b[\w\s]{0,50}?\b(bio)?sensor/i, label: "claims sensor discovery" },
  { pattern: /predicts?\s+magnetic(\s+\w+)?\s+response/i, label: "claims magnetic-response prediction" },
  { pattern: /validated\s+sensor/i, label: "claims validation" },
  { pattern: /working\s+construct/i, label: "claims a working construct" },
  { pattern: /ready[- ]to[- ]test\s+sequence/i, label: "claims an orderable sequence" },
  { pattern: /(sequence|alphafold|esm)\s+.{0,24}(predicts?|determines?)\s+.{0,24}spin/i, label: "claims sequence/model predicts spin response" },
  { pattern: /nebula\s+ranking/i, label: "references private Nebula ranking" },
  { pattern: /astra\s+(score|output)/i, label: "references private Astra output" },
  { pattern: /private\s+candidate/i, label: "references a private candidate" },
  { pattern: /commercial\s+candidate/i, label: "presents output as a commercial candidate" },
  { pattern: /(proves?|guarantees?)\s+.{0,24}(sens(ing|es)|works?)/i, label: "claims proof/guarantee of sensing" },
];

const REWRITE_TERMS: Array<[RegExp, string]> = [
  [/discover(ed|s)?\s+(a\s+)?(working\s+)?(quantum\s+)?(bio)?sensor/i, "generated a public construct hypothesis"],
  [/predicts?\s+magnetic(\s+\w+)?\s+response/i, "simulates a synthetic assumption sweep of a possible field-linked response"],
  [/validated\s+sensor/i, "unvalidated public construct hypothesis"],
  [/working\s+construct/i, "candidate construct hypothesis requiring measurement"],
  [/ready[- ]to[- ]test\s+sequence/i, "public demo template (not an orderable sequence)"],
];

export function auditClaim(input: string): ClaimAudit {
  const matched = BLOCKED_RULES.filter((r) => r.pattern.test(input));

  if (matched.length === 0) {
    return {
      input,
      blocked: false,
      matchedPatterns: [],
      reason: "No unsafe patterns detected.",
      rewrite: input,
    };
  }

  let rewrite = input;
  for (const [re, replacement] of REWRITE_TERMS) {
    rewrite = rewrite.replace(re, replacement);
  }

  // If the rewrite still trips a rule, fall back to a fully safe template.
  const stillUnsafe = BLOCKED_RULES.some((r) => r.pattern.test(rewrite));
  if (stillUnsafe || rewrite === input) {
    rewrite =
      "Under transparent public assumptions, this construct route is plausible enough to plan a measurement, with explicit controls and failure modes. It is an unvalidated public hypothesis and requires experimental measurement.";
  }

  return {
    input,
    blocked: true,
    matchedPatterns: matched.map((m) => m.label),
    reason:
      "Blocked: this phrasing overclaims scientific validation or references private/proprietary logic.",
    rewrite,
  };
}

/** Convenience list used by tests and the auditor to scan repo strings. */
export const BLOCKED_PATTERNS = BLOCKED_RULES.map((r) => r.pattern);

/** Affirmative unsafe claims that must never appear in generated exports. */
export const EXPORT_AFFIRMATIVE_CLAIMS: RegExp[] = [
  /validated sensor/i,
  /discovered a (working )?(quantum )?biosensor/i,
  /predicts magnetic/i,
];

/** Return patterns that match an export blob affirmatively (negated disclaimers OK). */
export function exportAffirmativeViolations(text: string): RegExp[] {
  return EXPORT_AFFIRMATIVE_CLAIMS.filter((re) => re.test(text));
}
