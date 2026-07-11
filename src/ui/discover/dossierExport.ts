/**
 * Pure dossier helpers + Markdown export (no React/WebGL imports) so the shipped
 * export can be run through the claim firewall + leak scan in tests — closing the
 * gap where only the retired src/core export was guarded.
 */
import type { CandidateDossier, CandidateRecord, RunState } from "../../api/client";
import { auditClaim, exportAffirmativeViolations } from "../../core/claimFirewall";

export const SPIN_PARAM = "candidate_isoalloxazine_max_spin_density";

// Humanize the claim-ceiling enum so the raw token (esp. "partner_ready_dossier") can
// never be screenshotted/exported as a commercial or validated claim. It is a CEILING
// (a cap), not an achievement.
export const CLAIM_LABELS: Record<string, string> = {
  diagnostic_only: "ceiling: diagnostic only",
  measurement_triage: "ceiling: measurement triage",
  partner_ready_dossier: "ceiling: measurement collaborator handoff",
};
export function claimLabel(c: string | undefined): string {
  return CLAIM_LABELS[c ?? ""] ?? `ceiling: ${c ?? "unknown"}`;
}

export function routeLabel(route: string): string {
  if (route === "RFP_flavin_photochemical") return "flavin photochemical light history";
  return route.replace(/_/g, " ");
}

export type SpinParam = { value: number; range: [number, number] | null; uncertainty: string | null };

export function computedSpinParam(d: CandidateDossier | undefined): SpinParam | null {
  const a = d?.physics_eligibility?.assumptions?.find((p) => p.name === SPIN_PARAM);
  if (typeof a?.value !== "number") return null;
  const r = a.range;
  return {
    value: a.value,
    range: Array.isArray(r) && r.length === 2 ? [r[0] as number, r[1] as number] : null,
    uncertainty: (a.uncertainty as string | undefined) ?? null,
  };
}
export function computedSpin(d: CandidateDossier | undefined): number | null {
  return computedSpinParam(d)?.value ?? null;
}
export function isCandidateSpecific(d: CandidateDossier | undefined): boolean {
  return Boolean(d?.physics_eligibility?.qm_cluster_plan?.candidate_specific);
}

// only radical-pair routes have a spin-dynamics reference; proxy/ineligible routes must
// NOT show the MARY curve (physics theater for a non-spin mechanism).
const SPIN_KINDS = new Set(["real_spin_dynamics", "qm_cluster_assumption"]);
export function isSpinDynamics(d: CandidateDossier | undefined): boolean {
  return SPIN_KINDS.has(d?.physics_eligibility?.kind ?? "");
}

export function dossierMarkdown(candidate: CandidateRecord, dossier: CandidateDossier | undefined, run: RunState): string {
  const acc = candidate.uniprot?.primary_accession;
  const L: string[] = [];
  const safe = (text: string) => auditClaim(text).rewrite;
  L.push(`# ${safe(candidate.title)}`, "");
  L.push(`**Status:** ${candidate.status} — unvalidated public-protein candidate hypothesis. Computation is not validation.`);
  if (acc) L.push(`**UniProt:** [${acc}](https://www.uniprot.org/uniprotkb/${acc})`);
  L.push(`**Route:** ${routeLabel(candidate.route_class)} · **Claim ${claimLabel(candidate.claim_ceiling)}**`);
  if (candidate.readout_modes?.length)
    L.push(`**Candidate readouts to test:** ${candidate.readout_modes.map((m) => m.replace(/_/g, " ")).join(", ")} — separate readouts the scaffold family can support, not measured together here and not a detectability claim.`);
  L.push(`**Run:** ${run.run_id} · seed ${run.seed} · ${run.offline ? "public fixtures (deterministic replay)" : "live retrieval"} · fingerprint ${run.input_fingerprint}`, "");
  const spin = computedSpin(dossier);
  if (spin != null)
    L.push(
      `**Candidate-specific QM:** max basis-dependent Mulliken spin population ${spin.toFixed(3)} ` +
        `(${isCandidateSpecific(dossier) ? "on candidate-associated structure coordinates" : "generic template"}) — ` +
        `isolated neutral-doublet cluster UHF value, HIGH uncertainty, NOT a performance or spin-response prediction; it is also not a probability and requires experimental measurement.`,
      "",
    );
  else if (isSpinDynamics(dossier))
    L.push(`**Candidate-specific QM:** not completed for this flavin radical pair candidate; a generic isoalloxazine template applies and no candidate specific spin value was produced. Computation is not validation.`, "");
  else
    L.push(`**No candidate-specific quantum chemistry:** ${routeLabel(candidate.route_class)} is a frontier hypothesis. Only the flavin radical pair route computes candidate specific quantum chemistry in this build; this route carries no candidate specific compute and is scored on public annotation and measurement value alone.`, "");
  if (candidate.why_it_might_work?.length) { L.push("## Why it might work"); candidate.why_it_might_work.forEach((x) => L.push(`- ${safe(x)}`)); L.push(""); }
  if (candidate.why_it_might_fail?.length) { L.push("## Why it might fail"); candidate.why_it_might_fail.forEach((x) => L.push(`- ${safe(x)}`)); L.push(""); }
  if (candidate.required_controls?.length) { L.push("## Controls"); candidate.required_controls.forEach((x) => L.push(`- ${safe(x)}`)); L.push(""); }
  if (dossier?.disclaimers?.length) { L.push("## Disclaimers"); dossier.disclaimers.forEach((x) => L.push(`- ${safe(x)}`)); }
  const output = L.join("\n");
  if (exportAffirmativeViolations(output).length > 0) {
    throw new Error("The claim boundary blocked this handoff export.");
  }
  return output;
}
