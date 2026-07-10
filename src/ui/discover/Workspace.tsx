/**
 * Results workspace — the calm, repeat-use scientific surface after a run.
 *
 * Left rail: objective + lanes. Center: real interactive structure + physics.
 * Right: dossier (why it ranked / may fail), measurement plan + falsifier, export.
 * Two strictly-separate lanes are preserved: evidence (candidate-specific physics)
 * vs frontier (exploratory, never allowed to outrank evidence). Everything shown is
 * a real public accession with clickable provenance; nothing is a template family.
 *
 * The run embeds full dossiers, so physics eligibility / candidate-specific QM / the
 * computed spin value are read directly from run.dossiers (no extra fetch); only the
 * 3D coordinates are pulled on demand from /api/candidates/{id}/structure.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getStructure,
  type CandidateDossier,
  type CandidateRecord,
  type DiscoveryScore,
  type FrontierExperiment,
  type PhysicsEligibility,
  type RunState,
  type StructureResponse,
} from "../../api/client";
import { StructureViewer } from "./StructureViewer";
import { Traces } from "./Traces";
import {
  claimLabel,
  computedSpinParam,
  dossierMarkdown,
  isCandidateSpecific,
  isSpinDynamics,
} from "./dossierExport";

interface Props {
  run: RunState;
  onReset: () => void;
}

function eligibilityOf(d: CandidateDossier | undefined): PhysicsEligibility | undefined {
  return d?.physics_eligibility;
}

export function Workspace({ run, onReset }: Props) {
  const evidence = run.evidence_shortlist ?? [];
  const frontier = run.frontier_experiments ?? [];
  const scoreById = useMemo(() => new Map((run.discovery_scores ?? []).map((s) => [s.candidate_id, s])), [run]);
  const candById = useMemo(() => new Map((run.candidates ?? []).map((c) => [c.candidate_id, c])), [run]);
  const dossierById = useMemo(() => new Map((run.dossiers ?? []).map((d) => [d.candidate.candidate_id, d])), [run]);
  const frontierById = useMemo(() => new Map(frontier.map((f) => [f.candidate_id, f])), [run]);

  const [selected, setSelected] = useState<string | null>(
    run.selected_candidate_id ?? evidence[0] ?? frontier[0]?.candidate_id ?? null,
  );

  const abstained = evidence.length === 0 && frontier.length === 0;

  return (
    <div className="ws">
      <aside className="ws-rail">
        <div className="ws-obj">
          <div className="ws-obj-head">objective</div>
          <p>{run.objective.objective_text}</p>
          <div className="ws-meta">
            <span>run <code>{run.run_id.slice(0, 14)}</code></span>
            <span>seed {run.seed}</span>
            <span>{run.offline ? "offline (fixtures)" : "live retrieval"}</span>
            <span>fp <code>{run.input_fingerprint.slice(0, 10)}</code></span>
          </div>
          <button className="btn-ghost" onClick={onReset}>← new objective</button>
        </div>

        {abstained ? (
          <div className="ws-abstain">
            <strong>Evidence-backed abstention.</strong> No public protein was eligible for a computed candidate under
            this objective — the correct answer, not a manufactured winner. Broaden the objective, enable unreviewed
            exploration, or supply seed accessions.
          </div>
        ) : (
          <>
            {evidence.length === 0 && frontier.length > 0 && (
              <div className="ws-exploratory">
                <strong>Exploratory only — no evidence-grade candidate.</strong> Nothing cleared the evidence lane for
                this objective. What follows is a frontier (exploratory) hypothesis, not a recommended answer.
              </div>
            )}
            <Lane title="evidence lane" hint="candidate-specific physics · ranked P·M·D" kind="evidence"
              ids={evidence} scoreById={scoreById} candById={candById} dossierById={dossierById}
              selected={selected} onSelect={setSelected} />
            <Lane title="frontier lane" hint="exploratory · never outranks evidence" kind="frontier"
              ids={frontier.map((f) => f.candidate_id)} scoreById={scoreById} candById={candById}
              dossierById={dossierById} selected={selected} onSelect={setSelected} />
          </>
        )}
      </aside>

      <main className="ws-main">
        {selected && candById.get(selected) ? (
          <CandidateDetail
            candidateId={selected}
            candidate={candById.get(selected)!}
            dossier={dossierById.get(selected)}
            score={scoreById.get(selected)}
            frontier={frontierById.get(selected)}
            run={run}
          />
        ) : (
          <div className="ws-empty">select a candidate</div>
        )}
      </main>
    </div>
  );
}

function Lane(props: {
  title: string; hint: string; kind: "evidence" | "frontier";
  ids: string[];
  scoreById: Map<string, DiscoveryScore>;
  candById: Map<string, CandidateRecord>;
  dossierById: Map<string, CandidateDossier>;
  selected: string | null; onSelect: (id: string) => void;
}) {
  const { title, hint, kind, ids, scoreById, candById, dossierById, selected, onSelect } = props;
  return (
    <div className={`lane lane-${kind}`}>
      <div className="lane-head">
        <span className="lane-title">{title}</span>
        <span className="lane-hint">{hint}</span>
      </div>
      {ids.length === 0 && <div className="lane-empty">— none —</div>}
      {ids.map((id, i) => {
        const c = candById.get(id);
        const s = scoreById.get(id);
        const acc = c?.uniprot?.primary_accession;
        const cs = isCandidateSpecific(dossierById.get(id));
        return (
          <button key={id} className={`cand ${selected === id ? "on" : ""}`} onClick={() => onSelect(id)}
            aria-pressed={selected === id}>
            <div className="cand-top">
              <span className="cand-rank">{i + 1}</span>
              <span className="cand-acc">{acc ?? "—"}</span>
              {cs && <span className="badge cs" title="candidate-specific quantum chemistry on real coordinates">QM</span>}
            </div>
            <div className="cand-title">{c?.title ?? id}</div>
            {s && (
              <div className="cand-bars">
                {kind === "evidence" ? (
                  <><Bar label="P" v={s.P_plausibility} /><Bar label="M" v={s.M_measurability} /><Bar label="D" v={s.D_developability} /></>
                ) : (
                  // IG is the only "more = better" growth bar; N and U are neutral position
                  // markers — high novelty/uncertainty describe exploration value, not quality.
                  <><Bar label="IG" v={s.IG_information_gain} /><Bar label="N" v={s.N_novelty} neutral /><Bar label="U" v={s.U_uncertainty} neutral /></>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Bar({ label, v, neutral }: { label: string; v: number; neutral?: boolean }) {
  return (
    <span className={`bar ${neutral ? "bar-neutral" : ""}`} title={`${label}=${v.toFixed(2)}${neutral ? " (exploration value, not quality)" : ""}`}>
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        {neutral ? (
          <span className="bar-mark" style={{ left: `${Math.round(v * 100)}%` }} />
        ) : (
          <span className="bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
        )}
      </span>
    </span>
  );
}

function CandidateDetail({
  candidateId, candidate, dossier, score, frontier, run,
}: {
  candidateId: string; candidate: CandidateRecord; dossier?: CandidateDossier;
  score?: DiscoveryScore; frontier?: FrontierExperiment; run: RunState;
}) {
  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [structLoading, setStructLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setStructLoading(true);
    setStructure(null);
    getStructure(candidateId)
      .then((s) => live && setStructure(s))
      .catch(() => live && setStructure(null))
      .finally(() => live && setStructLoading(false));
    return () => { live = false; };
  }, [candidateId]);

  const acc = candidate.uniprot?.primary_accession;
  const spinParam = computedSpinParam(dossier);
  const cs = isCandidateSpecific(dossier);
  const spinEligible = isSpinDynamics(dossier);
  const cofactor = candidate.cofactors?.[0]?.name ?? null;
  const elig = eligibilityOf(dossier);

  return (
    <div className="detail">
      <header className="detail-head">
        <div>
          <h2>{candidate.title}</h2>
          <div className="detail-sub">
            {acc && <a href={`https://www.uniprot.org/uniprotkb/${acc}`} target="_blank" rel="noreferrer" className="acc-link">UniProt {acc} ↗</a>}
            <span className="route">{candidate.route_class}</span>
            {score && <span className={`lane-badge ${score.lane}`}>{score.lane} lane</span>}
            <span className="claim">{claimLabel(candidate.claim_ceiling)}</span>
          </div>
        </div>
      </header>

      <div className="detail-grid">
        <section className="detail-struct">
          <StructureViewer structure={structure} loading={structLoading} cofactorLabel={cofactor} />
        </section>
        <section className="detail-physics">
          <h3>physics eligibility</h3>
          <div className={`phys-badge ${cs ? "cs" : "generic"}`}>
            {cs ? "candidate-specific QM on real coordinates" : "generic / template physics"}
          </div>
          {elig && <p className="phys-reason">{elig.reason}</p>}
          {spinParam != null && (
            <div className="phys-metric">
              max Mulliken spin density <strong>{spinParam.value.toFixed(3)}</strong>{" "}
              <span className="phys-note">computed (UHF) · high uncertainty · not a performance claim</span>
            </div>
          )}
          {spinEligible ? (
            <Traces spin={spinParam} candidateSpecific={cs} candidateLabel={acc ?? candidate.title} />
          ) : (
            <p className="phys-nospin">No spin-dynamics reference applies to this route ({candidate.route_class}); it is scored in the exploration lane on measurement value only.</p>
          )}
        </section>
      </div>

      <div className="detail-cols">
        <section className="detail-rationale">
          <h3>why it ranked · why it may fail</h3>
          {score && <p className="rationale-line">{score.rationale}</p>}
          <ReasonList title="why it might work" items={candidate.why_it_might_work} tone="pos" />
          <ReasonList title="why it might fail" items={candidate.why_it_might_fail} tone="neg" />
          {(candidate.confounders?.length ?? 0) > 0 && <ReasonList title="confounders" items={candidate.confounders} tone="warn" />}
        </section>
        <section className="detail-plan">
          <h3>measure next · falsification</h3>
          <MeasurementPlan candidate={candidate} frontier={frontier} instrument={run.instrument_id} />
          <ExportButtons candidate={candidate} dossier={dossier} run={run} />
        </section>
      </div>

      {dossier && <Provenance dossier={dossier} run={run} />}
    </div>
  );
}

function ReasonList({ title, items, tone }: { title: string; items?: string[]; tone: "pos" | "neg" | "warn" }) {
  if (!items?.length) return null;
  return (
    <div className={`reasons ${tone}`}>
      <span className="reasons-title">{title}</span>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function MeasurementPlan({ candidate, frontier, instrument }: { candidate: CandidateRecord; frontier?: FrontierExperiment; instrument?: string | null }) {
  const de = frontier?.discriminating_experiment;
  return (
    <div className="plan">
      <div className="plan-row"><span>instrument</span><b>{de?.instrument_id ?? instrument ?? "benchtop field fluorimeter"}</b></div>
      {de ? (
        <>
          <div className="plan-row"><span>measure</span><b>{de.what_to_measure}</b></div>
          <div className="plan-row"><span>expected</span><b>{de.expected_signature}</b></div>
          <div className="plan-row"><span>null</span><b>{de.null_expectation}</b></div>
          <div className="plan-kill"><span>kill criterion</span><b>{de.kill_criterion}</b></div>
          {frontier?.falsifier && <div className="plan-fals">{frontier.falsifier}</div>}
          <ControlList label="positive controls" items={de.positive_controls} />
          <ControlList label="negative controls" items={de.negative_controls} />
        </>
      ) : (
        <>
          <ControlList label="required controls" items={candidate.required_controls} />
          <div className="plan-fals">
            <strong>Falsification:</strong> if the paired mechanism-specific control (e.g. RF off/on, illuminated
            no-field) shows the same signal change as the construct, the {candidate.route_class} hypothesis for{" "}
            {candidate.uniprot?.primary_accession ?? "this protein"} is rejected.
          </div>
        </>
      )}
    </div>
  );
}

function ControlList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="ctrl">
      <span>{label}</span>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function Provenance({ dossier, run }: { dossier: CandidateDossier; run: RunState }) {
  return (
    <details className="prov">
      <summary>provenance & disclaimers ({(run.provider_calls ?? []).length} provider calls)</summary>
      <ul className="prov-disc">{(dossier.disclaimers ?? []).map((d, i) => <li key={i}>{d}</li>)}</ul>
      <ul className="prov-calls">
        {(run.provider_calls ?? []).slice(0, 12).map((p, i) => {
          const pc = p as { provider?: string; mode?: string; url?: string };
          return (
            <li key={i}>
              <code>{pc.provider ?? "provider"}</code> <span>{pc.mode ?? ""}</span>{" "}
              {pc.url && <a href={pc.url} target="_blank" rel="noreferrer">source ↗</a>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function ExportButtons({ candidate, dossier, run }: { candidate: CandidateRecord; dossier?: CandidateDossier; run: RunState }) {
  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const acc = candidate.uniprot?.primary_accession ?? candidate.candidate_id;
  return (
    <div className="export">
      <button className="btn-ghost" onClick={() => download(`dossier_${acc}.json`, JSON.stringify(dossier ?? candidate, null, 2), "application/json")} disabled={!dossier}>download JSON</button>
      <button className="btn-ghost" onClick={() => download(`dossier_${acc}.md`, dossierMarkdown(candidate, dossier, run), "text/markdown")}>download Markdown</button>
    </div>
  );
}

