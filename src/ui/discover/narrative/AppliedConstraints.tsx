/**
 * Per-candidate constraint "progress report" (brief Ask E) + the run-level decision-active
 * vs handoff-only split (the literal claim firewall: which objective inputs actually shaped
 * the discovery, and which are carried for the collaborator handoff only).
 *
 * Everything here is REAL data the backend already computes: the seven DiscoveryScore axes,
 * the physics-eligibility tier, and exploration.physical_constraints_satisfied /
 * assumptions_remaining. Nothing is a probability, a confidence, or a performance number,
 * the header says so, verbatim, so a normalized axis can never be misread as a measurement.
 */
import type { CandidateDossier, DiscoveryScore, RunState } from "../../../api/client";
import { claimLabel } from "../dossierExport";
import { Metric } from "./Metric";

const KIND_LABEL: Record<string, string> = {
  real_spin_dynamics: "spin dynamics",
  qm_cluster_assumption: "QM cluster · assumption",
  analytic_proxy_only: "analytic proxy",
  ineligible: "no candidate QM",
};

function humanLevel(level?: string): string {
  if (!level) return "unassigned";
  const [tag, ...rest] = level.split("_");
  return `${tag} · ${rest.join(" ")}`.trim();
}

export function AppliedConstraints({ score, dossier }: { score?: DiscoveryScore; dossier?: CandidateDossier }) {
  if (!score) return null;
  const kind = dossier?.physics_eligibility?.kind;
  const ex = score.exploration;
  const satisfied = ex?.physical_constraints_satisfied ?? [];
  const remaining = ex?.assumptions_remaining ?? [];
  return (
    <div className="atlas-constraints">
      <header className="atlas-constraints-head">
        <span className="atlas-eyebrow">applied constraints</span>
        <p>Uncalibrated triage axes, not probabilities, confidence, or performance. Each is a normalized 0 to 100 heuristic used only to order candidates against this objective.</p>
      </header>
      <div className="atlas-constraints-axes">
        <Metric label="mechanism support" value={score.P_plausibility} />
        <Metric label="measurability" value={score.M_measurability} />
        <Metric label="developability" value={score.D_developability} />
        <Metric label="novelty" value={score.N_novelty} />
        <Metric label="information gain" value={score.IG_information_gain} />
        <Metric label="uncertainty" value={score.U_uncertainty} inverse />
        <Metric label="cost" value={score.C_cost} inverse />
      </div>
      <div className="atlas-constraints-ledger">
        <div className="acon-col">
          <span className="acon-head">physics tier</span>
          <span className={`acon-kind acon-kind-${kind ?? "unknown"}`}>{kind ? KIND_LABEL[kind] ?? kind : "unassigned"}</span>
          <span className="acon-sub">exploration {humanLevel(ex?.level)} · {claimLabel(ex?.claim_ceiling)}</span>
        </div>
        <div className="acon-col">
          <span className="acon-head acon-ok">constraints satisfied · {satisfied.length}</span>
          {satisfied.length ? (
            <ul className="acon-list acon-list-ok">{satisfied.map((s, i) => <li key={i}>{s}</li>)}</ul>
          ) : (
            <p className="acon-none">No physical constraints were recorded as satisfied for this candidate.</p>
          )}
        </div>
        <div className="acon-col">
          <span className="acon-head acon-warn">assumptions remaining · {remaining.length}</span>
          {remaining.length ? (
            <ul className="acon-list acon-list-warn">{remaining.map((s, i) => <li key={i}>{s}</li>)}</ul>
          ) : (
            <p className="acon-none">No open assumptions were flagged. Absence of a flag is not validation.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Run-level honesty strip: the objective builder marks which fields are decision-active
 * (they shaped retrieval/ranking) vs handoff-only (context carried for the bench, but which
 * did NOT rank anything). Showing the split stops a user reading temperature or material as
 * if it moved the shortlist.
 */
export function ObjectiveSplit({ run }: { run: RunState }) {
  const active = run.objective.decision_active_fields ?? [];
  const handoff = run.objective.handoff_only_fields ?? [];
  if (!active.length && !handoff.length) return null;
  const human = (f: string) => f.replace(/_/g, " ");
  return (
    <div className="atlas-split">
      <div className="atlas-split-col atlas-split-active">
        <span>shaped the discovery</span>
        <div className="atlas-split-chips">{active.map((f) => <span key={f}>{human(f)}</span>)}</div>
      </div>
      <div className="atlas-split-col atlas-split-handoff">
        <span>carried for your handoff only</span>
        <div className="atlas-split-chips">{handoff.length ? handoff.map((f) => <span key={f}>{human(f)}</span>) : <em>none</em>}</div>
      </div>
    </div>
  );
}
