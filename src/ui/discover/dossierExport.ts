/**
 * Pure dossier helpers + Markdown export (no React/WebGL imports) so the shipped
 * export can be run through the claim firewall + leak scan in tests — closing the
 * gap where only the retired src/core export was guarded.
 */
import type { CandidateDossier, CandidateRecord, DiscoveryScore, RunState } from "../../api/client";
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

// ---- Branded PDF discovery brief -------------------------------------------------------
// A self-contained HTML document in the Nebula Discovery brand kit (navy + platinum + teal,
// Cormorant Garamond over Hanken Grotesk, the nebula star mark), rendered to PDF by the
// browser's own print engine (vector-crisp, no dependency, offline-consistent with the app).
// Same claim firewall as the Markdown export: every free-text field is run through auditClaim,
// and the finished document is refused if any affirmative overclaim survives.

type BriefExtras = {
  score?: DiscoveryScore;
  frontier?: { discriminating_experiment?: { what_to_measure?: string | null; instrument_id?: string | null } | null; falsifier?: string | null } | null;
  design?: { label?: string; generator?: string; backbone_pdb?: string | null; invented_for?: string | null; n_residues?: number | null } | null;
  generatedAt?: string;
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const AXES: [keyof DiscoveryScore, string, boolean][] = [
  ["P_plausibility", "mechanism support", false],
  ["M_measurability", "measurability", false],
  ["D_developability", "developability", false],
  ["N_novelty", "novelty", false],
  ["IG_information_gain", "information gain", false],
  ["U_uncertainty", "uncertainty", true],
  ["C_cost", "cost", true],
];

export function dossierBriefHtml(candidate: CandidateRecord, dossier: CandidateDossier | undefined, run: RunState, extras: BriefExtras = {}): string {
  const safe = (t: string) => esc(auditClaim(t).rewrite);
  const acc = candidate.uniprot?.primary_accession ?? candidate.candidate_id;
  const title = safe(candidate.title);
  const route = esc(routeLabel(candidate.route_class));
  const ceiling = esc(claimLabel(dossier?.claim_ceiling ?? candidate.claim_ceiling));
  const sensed = esc((run.objective?.sensed_quantity_or_state ?? "the sensing objective").replace(/-/g, " "));
  const spin = computedSpin(dossier);
  const candSpecific = isCandidateSpecific(dossier);
  const cofactors = candidate.cofactors?.map((c) => c.name).filter(Boolean).join(" + ") || "not annotated";
  const score = extras.score;
  const frontier = extras.frontier;
  const design = extras.design;
  const citations = dossier?.evidence_citations ?? [];
  const degradations = candidate.degradations ?? [];

  const li = (items: string[] | undefined) => (items?.length ? `<ul>${items.map((x) => `<li>${safe(x)}</li>`).join("")}</ul>` : "");
  const metaRow = (k: string, v: string) => `<div class="nb-meta-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;

  const qmBlock = spin != null
    ? `<p><span class="nb-k">candidate-specific QM</span> max basis-dependent Mulliken spin population <b>${spin.toFixed(3)}</b> (${candSpecific ? "on candidate-associated structure coordinates" : "generic template"}) — isolated neutral-doublet cluster UHF value, HIGH uncertainty. It is not a probability and not a response prediction; it requires experimental measurement.</p>`
    : isSpinDynamics(dossier)
      ? `<p><span class="nb-k">candidate-specific QM</span> not completed for this flavin radical-pair candidate; a generic isoalloxazine template applies. Computation is not validation.</p>`
      : `<p><span class="nb-k">no candidate-specific quantum chemistry</span> ${route} is a frontier hypothesis. Only the flavin radical-pair route computes candidate-specific spin in this build; this candidate is scored on public annotation and measurement value alone.</p>`;

  const axesBlock = score
    ? `<div class="nb-axes">${AXES.map(([key, label, inverse]) => {
        const v = Math.round(Math.max(0, Math.min(1, (score[key] as number) ?? 0)) * 100);
        const w = inverse ? 100 - v : v;
        return `<div class="nb-axis"><span class="nb-axis-l">${esc(label)}</span><span class="nb-axis-v">${v}</span><i><b style="width:${w}%"></b></i></div>`;
      }).join("")}</div><p class="nb-fine">Uncalibrated triage axes — not probabilities, confidence, or performance. Normalized 0–100 heuristics used only to order candidates against this objective.</p>`
    : "";

  const measureBlock = `
    <div class="nb-measure">
      <span class="nb-k nb-k-teal">decisive next measurement</span>
      <p class="nb-measure-what">${safe(frontier?.discriminating_experiment?.what_to_measure ?? "Test the proposed readout against its mechanism-specific controls.")}</p>
      <div class="nb-measure-grid">
        ${metaRow("instrument", esc((score?.suggested_instrument_id ?? frontier?.discriminating_experiment?.instrument_id ?? run.instrument_id ?? "route-compatible measurement bench").replace(/_/g, " ")))}
        ${metaRow("reject when", safe(frontier?.falsifier ?? candidate.why_it_might_fail?.[0] ?? "the mechanism-specific control is indistinguishable from the candidate"))}
        ${metaRow("claim ceiling", ceiling)}
      </div>
    </div>`;

  const citeBlock = citations.length
    ? `<ul class="nb-cites">${citations.map((c) => `<li><span>${esc(c.authors.split(",")[0])} et al. ${esc(String(c.year))}. ${esc(c.title)}. <em>${esc(c.venue)}</em>.</span><a href="https://doi.org/${esc(c.doi)}">doi:${esc(c.doi)}</a></li>`).join("")}</ul>`
    : `<p class="nb-fine">No public citation anchors this route in the current build. It stands on scientific rationale, not on literature.</p>`;

  const designBlock = design
    ? `<section><h2>Generated design path</h2><div class="nb-meta">${metaRow("direction", safe(design.label ?? "generation frontier"))}${metaRow("generator", esc(design.generator ?? "unavailable"))}${metaRow("coordinates", design.backbone_pdb ? `yes${design.n_residues ? ` · ${design.n_residues} residues` : ""}` : "no")}${metaRow("sequence", "no")}${metaRow("status", "unvalidated design hypothesis")}</div></section>`
    : "";

  const gapsBlock = degradations.length ? `<section><h2>What we could not resolve</h2>${li(degradations)}</section>` : "";
  const discBlock = dossier?.disclaimers?.length ? `<section><h2>Disclaimers</h2>${li(dossier.disclaimers)}</section>` : "";
  const generatedAt = esc(extras.generatedAt ?? "");

  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nebula Discovery Brief — ${esc(acc)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root{--bg:#070c18;--bg2:#0a1122;--panel:#0c1526;--ink:#eef1f6;--mut:#a9b3c4;--faint:#8b93a6;--line:#1b2a45;--plat:#c6ccd6;--platb:#e9edf3;--teal:#7f9bc0;--evi:#9bcbd1;--fro:#a78bd0;--red:#ef8a7a;--green:#bdf38a;
--serif:"Cormorant Garamond","Hoefler Text",Georgia,serif;--sans:"Hanken Grotesk",-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;--mono:"SF Mono",ui-monospace,Menlo,monospace;}
@page{size:A4;margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.nb-page{max-width:820px;margin:0 auto;padding:44px 52px 60px;background:
 radial-gradient(ellipse 60% 40% at 78% 8%, rgba(127,155,192,0.12), transparent 60%),
 linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh;}
.nb-top{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--line);}
.nb-star{position:relative;width:22px;height:22px;border-radius:50%;flex:0 0 auto;
 background:radial-gradient(circle,#e7ffd2 0 14%,var(--green) 15% 26%,rgba(189,243,138,0.16) 27% 50%,transparent 51%);}
.nb-star::before,.nb-star::after{content:"";position:absolute;inset:50% auto auto 50%;height:1px;width:34px;translate:-50% -50%;background:linear-gradient(90deg,transparent,rgba(189,243,138,0.72),transparent);}
.nb-star::after{rotate:90deg;width:26px;}
.nb-word{font-weight:800;letter-spacing:-0.045em;color:var(--green);font-size:20px;}
.nb-tag{color:var(--faint);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin-left:2px;}
.nb-doclabel{margin-left:auto;color:var(--plat);font:600 10px/1 var(--mono);letter-spacing:0.22em;text-transform:uppercase;}
.nb-hero{padding:30px 0 8px;}
.nb-eyebrow{color:var(--teal);font:600 10px/1 var(--mono);letter-spacing:0.2em;text-transform:uppercase;}
.nb-acc{font-family:var(--serif);font-weight:600;font-size:64px;line-height:0.95;margin:10px 0 6px;color:var(--ink);}
.nb-sub{color:var(--mut);font-size:15px;}
.nb-sub b{color:var(--plat);font-weight:600;}
.nb-status{margin:18px 0 26px;padding:12px 16px;border:1px solid var(--line);border-left:2px solid var(--fro);border-radius:10px;background:rgba(167,139,208,0.06);color:var(--mut);font-size:12.5px;line-height:1.5;}
section{margin:24px 0;break-inside:avoid;}
h2{font-family:var(--serif);font-weight:500;font-size:26px;margin:0 0 12px;color:var(--ink);letter-spacing:0.01em;}
p{margin:0 0 10px;color:var(--mut);font-size:13px;line-height:1.6;}
.nb-k{display:inline-block;color:var(--faint);font:700 9px/1 var(--mono);letter-spacing:0.12em;text-transform:uppercase;margin-right:8px;}
.nb-k-teal{color:var(--evi);}
.nb-meta{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;}
.nb-meta-row{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:9px 14px;background:var(--panel);align-items:baseline;}
.nb-meta-row dt{margin:0;color:var(--faint);font:600 8.5px/1.3 var(--mono);letter-spacing:0.1em;text-transform:uppercase;}
.nb-meta-row dd{margin:0;color:var(--mut);font-size:12px;word-break:break-word;}
.nb-meta-row a{color:var(--teal);text-decoration:none;}
.nb-measure{margin:6px 0 4px;padding:20px 22px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,rgba(155,203,209,0.05),rgba(12,21,38,0.5));}
.nb-measure-what{font-family:var(--serif);font-size:22px;line-height:1.15;color:var(--ink);margin:8px 0 16px;}
.nb-measure-grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.nb-measure-grid .nb-meta-row{grid-template-columns:110px 1fr;}
.nb-axes{display:grid;grid-template-columns:1fr 1fr;gap:12px 26px;margin:4px 0 10px;}
.nb-axis{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:baseline;}
.nb-axis-l{color:var(--faint);font:600 9px/1 var(--mono);letter-spacing:0.08em;text-transform:uppercase;}
.nb-axis-v{color:var(--mut);font:500 15px/1 var(--mono);}
.nb-axis i{grid-column:1/-1;height:2px;background:rgba(255,255,255,0.09);border-radius:2px;}
.nb-axis i b{display:block;height:100%;background:linear-gradient(90deg,var(--evi),var(--teal));border-radius:2px;}
.nb-fine{color:var(--faint);font-size:11px;line-height:1.5;}
ul{margin:0;padding-left:18px;}
li{color:var(--mut);font-size:12.5px;line-height:1.55;margin-bottom:5px;}
.nb-cites{list-style:none;padding:0;display:flex;flex-direction:column;gap:9px;}
.nb-cites li{display:flex;flex-direction:column;gap:2px;}
.nb-cites em{color:var(--faint);font-style:italic;}
.nb-cites a{color:var(--evi);font-family:var(--mono);font-size:11px;text-decoration:none;word-break:break-all;}
.nb-cols{display:grid;grid-template-columns:1fr 1fr;gap:26px;}
.nb-foot{margin-top:38px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;align-items:baseline;color:var(--faint);font-size:10.5px;}
.nb-foot b{color:var(--green);font-weight:800;letter-spacing:-0.03em;}
@media print{.nb-page{min-height:auto;}a{color:inherit;}}
</style></head>
<body><div class="nb-page">
  <header class="nb-top"><span class="nb-star"></span><span class="nb-word">nebula</span><span class="nb-tag">discovery</span><span class="nb-doclabel">discovery brief</span></header>
  <div class="nb-hero">
    <span class="nb-eyebrow">selected public candidate</span>
    <div class="nb-acc">${esc(acc)}</div>
    <p class="nb-sub"><b>${title}</b> · ${route} · ${ceiling}</p>
  </div>
  <div class="nb-status">Unvalidated public-protein candidate hypothesis for ${sensed}. Computation is not validation; this brief is a plan for a measurement, not a proven sensor.</div>

  <section>${measureBlock}</section>

  <section><h2>Physics &amp; scoring</h2>${qmBlock}${axesBlock}</section>

  <section><h2>Provenance</h2><div class="nb-meta">
    ${metaRow("uniprot", candidate.uniprot?.primary_accession ? `<a href="https://www.uniprot.org/uniprotkb/${esc(candidate.uniprot.primary_accession)}">${esc(candidate.uniprot.primary_accession)}</a>` : "de novo / unassigned")}
    ${metaRow("cofactor", esc(cofactors))}
    ${metaRow("lane", esc(score?.lane ?? "unassigned"))}
    ${metaRow("physics tier", esc(dossier?.physics_eligibility?.kind ?? "unassigned"))}
    ${metaRow("run", `${esc(run.run_id)} · seed ${esc(String(run.seed))}`)}
    ${metaRow("source", run.offline ? "public fixtures · deterministic replay" : "live public-API retrieval")}
  </div></section>

  <section class="nb-cols">
    <div>${candidate.why_it_might_work?.length ? `<h2>Why it might work</h2>${li(candidate.why_it_might_work)}` : ""}</div>
    <div>${candidate.why_it_might_fail?.length ? `<h2>Why it might fail</h2>${li(candidate.why_it_might_fail)}` : ""}</div>
  </section>
  ${candidate.required_controls?.length ? `<section><h2>Controls</h2>${li(candidate.required_controls)}</section>` : ""}

  <section><h2>Public evidence · supports mechanism plausibility</h2>${citeBlock}</section>
  ${gapsBlock}
  ${designBlock}
  ${discBlock}

  <footer class="nb-foot"><span>A candidate is a discovery to prove at the bench, not a proven sensor.</span><span><b>nebula</b> discovery${generatedAt ? ` · ${generatedAt}` : ""}</span></footer>
</div></body></html>`;

  if (exportAffirmativeViolations(body).length > 0) {
    throw new Error("The claim boundary blocked this handoff export.");
  }
  return body;
}
