import { describe, expect, it } from "vitest";
import { auditClaim } from "../src/core/claimFirewall";

describe("claim firewall", () => {
  it("blocks 'discovered a quantum biosensor'", () => {
    const a = auditClaim("We discovered a quantum biosensor.");
    expect(a.blocked).toBe(true);
    expect(a.rewrite).not.toMatch(/discovered a quantum biosensor/i);
  });

  it("blocks magnetic-response prediction", () => {
    const a = auditClaim("This protein predicts magnetic fluorescence response.");
    expect(a.blocked).toBe(true);
  });

  it("blocks private Nebula/Astra references", () => {
    expect(auditClaim("See the Nebula ranking.").blocked).toBe(true);
    expect(auditClaim("Astra score is high.").blocked).toBe(true);
  });

  it("blocks sequence/AlphaFold predicting spin", () => {
    const a = auditClaim("The sequence alone predicts spin response.");
    expect(a.blocked).toBe(true);
  });

  it("allows claim-safe measurement language", () => {
    const safe = auditClaim(
      "This public construct hypothesis is measurement-worthy under synthetic assumptions and requires experimental validation.",
    );
    expect(safe.blocked).toBe(false);
    expect(safe.rewrite).toBe(safe.input);
  });

  it("always returns a safe rewrite that no longer trips the firewall", () => {
    const a = auditClaim("We discovered a validated working quantum biosensor.");
    expect(a.blocked).toBe(true);
    expect(auditClaim(a.rewrite).blocked).toBe(false);
  });
});
