/**
 * The per-protein rationale dossier, one cohesive "why THIS candidate" panel for the selected
 * protein, folding what used to be the standalone physics + measure scenes into one place:
 *   why it earned a place (the real DiscoveryScore.rationale, previously hidden) →
 *   candidate-led physics (its OWN computed spin + route, with the generic MARY demoted to a clearly
 *     labelled reference) → route evidence → applied constraints → the decisive measurement + falsifier.
 * Everything is specific to this search; the reference model and route precedent are visibly separated
 * from any claim about this protein.
 */
import { Suspense, lazy, useState } from "react";
import type { CandidateDossier, CandidateRecord, DiscoveryScore, RunState } from "../../../api/client";
import { claimLabel, computedSpinParam, isCandidateSpecific, isSpinDynamics, routeLabel, sentenceCase } from "../dossierExport";
import { AppliedConstraints } from "./AppliedConstraints";
import { FieldPrecedent } from "./FieldPrecedent";
import { RationaleConstellation, type Facet, type FacetId } from "./RationaleConstellation";

const Traces = lazy(() => import("../Traces").then((m) => ({ default: m.Traces })));

type Frontier = NonNullable<RunState["frontier_experiments"]>[number];
type Measurement = NonNullable<RunState["measurement_proposals"]>[number];
type MfeSensitivity = NonNullable<NonNullable<NonNullable<CandidateDossier["physics_eligibility"]>["radical_pair"]>["magnetic_field_effect"]>;

export function CandidateDossierPanel({ candidate, dossier, score, frontier, measurement, run }: {
  candidate?: CandidateRecord;
  dossier?: CandidateDossier;
  score?: DiscoveryScore;
  frontier?: Frontier;
  measurement?: Measurement;
  run: RunState;
}) {
  const [activeId, setActiveId] = useState<FacetId>("decisive");
  if (!candidate) return <p className="atlas-empty">No candidate passed into measurement planning.</p>;
  const accession = candidate.uniprot?.primary_accession ?? candidate.title;
  const spinParam = computedSpinParam(dossier);
  const spinEligible = isSpinDynamics(dossier);
  const candidateSpecific = isCandidateSpecific(dossier);
  const geometry = dossier?.physics_eligibility?.qm_cluster_plan?.geometry_source;
  const rp = dossier?.physics_eligibility?.radical_pair;
  const cofactors = candidate.cofactors?.map((c) => c.name).filter(Boolean).join(" + ") || "no annotated cofactor";
  const lane = score?.lane === "evidence" ? "evidence" : "frontier";
  const citations = dossier?.evidence_citations ?? [];
  const mfeSensitivity = rp?.magnetic_field_effect;
  const experiment = measurement?.discriminating_experiment ?? frontier?.discriminating_experiment;
  const falsifier = measurement?.falsifier ?? frontier?.falsifier;
  const physicsMetric = mfeSensitivity
    ? `${mfeSensitivity.lower_percent}–${mfeSensitivity.upper_percent}%`
    : spinParam ? spinParam.value.toFixed(2) : undefined;
  const facets: Facet[] = [
    { id: "why", label: "Rationale", takeaway: "why it ranked", tone: lane === "evidence" ? "evidence" : "frontier" },
    { id: "evidence", label: "Evidence", takeaway: citations.length ? "public support" : "rationale only", metric: String(citations.length), tone: "evidence" },
    { id: "physics", label: "Physics", takeaway: spinEligible ? (mfeSensitivity ? "model range" : "spin computed") : "route only", metric: physicsMetric, tone: "physics" },
    { id: "fit", label: "Fit", takeaway: "constraints", tone: "fit" },
    { id: "decisive", label: "Next test", takeaway: "separate routes", tone: "decisive" },
  ];

  return (
    <div className="dossier dossier-constellation">
      <p className="dossier-cluetip">The case for <strong>{accession}</strong>. Tap a star to open its detail.</p>
      <RationaleConstellation accession={accession} lane={lane} facets={facets} activeId={activeId} onSelect={setActiveId} />
      <div className="dossier-detail">

      {/* RATIONALE facet */}
      <div className="dossier-facet dossier-why" id="dossier-panel-why" role="tabpanel" aria-labelledby="dossier-tab-why" hidden={activeId !== "why"}>
        <span className="dossier-k">why {accession} earned a place</span>
        <p className="dossier-rationale">
          {`A ${routeLabel(candidate.route_class)} candidate carrying ${cofactors}, ranked ${score?.lane === "evidence" ? "onto the evidence lane" : "into the frontier"} for its mechanism support and measurement value against your objective.`}
        </p>
        {score?.rationale ? <p className="dossier-triage">{sentenceCase(score.rationale)}</p> : null}
        <div className="dossier-wf">
          {candidate.why_it_might_work?.length ? (
            <div><h4 className="dossier-wf-h dossier-wf-ok">why it might work</h4><ul>{candidate.why_it_might_work.map((x, i) => <li key={i}>{sentenceCase(x)}</li>)}</ul></div>
          ) : null}
          {candidate.why_it_might_fail?.length ? (
            <div><h4 className="dossier-wf-h dossier-wf-warn">why it might fail</h4><ul>{candidate.why_it_might_fail.map((x, i) => <li key={i}>{sentenceCase(x)}</li>)}</ul></div>
          ) : null}
        </div>
      </div>

      {/* PHYSICS facet: THIS protein's own number first; the generic MARY is a labelled reference */}
      <div className="dossier-facet dossier-physics" id="dossier-panel-physics" role="tabpanel" aria-labelledby="dossier-tab-physics" hidden={activeId !== "physics"}>
        <h3 tabIndex={-1}>{spinEligible ? `The spin physics behind ${accession}` : `What we can (and cannot) compute for ${accession}`}</h3>
        {mfeSensitivity ? (
          <div className="dossier-mfe">
            <div className="dossier-mfe-range">
              <span>{mfeSensitivity.lower_percent}</span><i>to</i><span>{mfeSensitivity.upper_percent}%</span>
            </div>
            <div className="dossier-mfe-cap">
              <strong>kinetic-sensitivity envelope</strong>
              <span>Modeled singlet-yield response across {mfeSensitivity.scenarios?.length ?? 0} named exchange-coupling and kinetic scenarios over 0–{mfeSensitivity.field_range_mT} mT. This structure supplies a D estimate and the starting J estimate; hyperfine, kinetics, environment, and optical transduction are not candidate-specific.</span>
              <small>reference scenario: {mfeSensitivity.baseline_percent}% · prioritization aid, not predicted performance</small>
            </div>
          </div>
        ) : !spinEligible ? (
          <p className="dossier-mfe-none">No magnetic field effect is modeled here — {routeLabel(candidate.route_class)} is a proxy route, not a flavin radical pair, so RadicalPy spin dynamics do not apply to it.</p>
        ) : null}
        {spinEligible ? (
          <>
            <p className="dossier-lead">
              {spinParam
                ? `${accession}'s own max Mulliken spin population is ${spinParam.value.toFixed(3)}, ${candidateSpecific ? "computed on structure-extracted coordinates" : `a ${geometry ?? "route-level isoalloxazine template, not yet extracted from this protein's structure"}`}. Basis-dependent, HIGH uncertainty; not a probability and not a response prediction.`
                : `No candidate-specific spin value was produced for ${accession}; a generic isoalloxazine template applies to its flavin radical-pair route. Its physics stands on the route reference, not on this protein's own coordinates.`}
            </p>
            {rp ? (
              <div className="dossier-rp">
                <span className="dossier-k dossier-k-teal">candidate-associated radical-pair geometry</span>
                <p className="dossier-rp-lead">
                  An aromatic-network heuristic assigns <strong>{rp.partner_residue}</strong> ({rp.partner_kind}) as the terminal partner, {rp.separation_angstrom} Å from the flavin by centroid distance.
                </p>
                <dl className="dossier-rp-vals">
                  <div><dt>separation</dt><dd>{rp.separation_angstrom} Å</dd></div>
                  <div><dt>dipolar D</dt><dd>{rp.dipolar_d_mT.toFixed(3)} mT <small>point-dipole estimate from centroid separation</small></dd></div>
                  <div><dt>exchange J</dt><dd>~{rp.exchange_j_mT.toExponential(1)} mT <small>distance-decay estimate; dominant uncertainty</small></dd></div>
                </dl>
                <p className="dossier-rp-note">Partner assignment, separation, D, and J are model-derived from this structure, not measured radical localization. The envelope varies J and generic rates; hyperfine, protonation, environment, and optical transduction remain unresolved.</p>
              </div>
            ) : null}
            {mfeSensitivity ? <MfeSensitivityChart model={mfeSensitivity} /> : null}
            <details className="dossier-reference" open>
              <summary>reference radical-pair model, a synthetic assumption sweep, not {accession}</summary>
              <Suspense fallback={<div className="atlas-compute-loading" aria-live="polite">composing the spin dynamics trace…</div>}>
                <Traces spin={spinParam} candidateSpecific={candidateSpecific} candidateLabel={accession} />
              </Suspense>
            </details>
          </>
        ) : (
          <p className="dossier-lead">
            No candidate-specific quantum chemistry runs for this route in this build. {accession} is scored on public
            annotation and measurement value, not on physics we did not compute.
          </p>
        )}
        <FieldPrecedent route={candidate.route_class} />
      </div>

      {/* EVIDENCE facet: public evidence + mechanism ladder + what we could not resolve */}
      <div className="dossier-facet" id="dossier-panel-evidence" role="tabpanel" aria-labelledby="dossier-tab-evidence" hidden={activeId !== "evidence"}>
        <EvidenceLedger candidate={candidate} dossier={dossier} score={score} />
      </div>

      {/* FIT facet: the uncalibrated triage axes + satisfied/remaining constraints */}
      <div className="dossier-facet" id="dossier-panel-fit" role="tabpanel" aria-labelledby="dossier-tab-fit" hidden={activeId !== "fit"}>
        <AppliedConstraints score={score} dossier={dossier} />
      </div>

      {/* MEASUREMENT facet: the lowest-cost discriminating measurement available in this build */}
      <div className="dossier-facet dossier-measure" id="dossier-panel-decisive" role="tabpanel" aria-labelledby="dossier-tab-decisive" hidden={activeId !== "decisive"}>
        <span className="dossier-k dossier-k-teal">next discriminating measurement</span>
        <h3 className="dossier-measure-what">{sentenceCase(experiment?.what_to_measure ?? "Test the proposed readout against its mechanism-specific controls.")}</h3>
        <dl>
          <div><dt>instrument</dt><dd>{sentenceCase((experiment?.instrument_id ?? score?.suggested_instrument_id ?? run.instrument_id ?? "route-compatible measurement bench").replace(/_/g, " "))}</dd></div>
          {experiment?.expected_signature ? <div><dt>candidate result</dt><dd>{sentenceCase(experiment.expected_signature)}</dd></div> : null}
          {experiment?.null_expectation ? <div><dt>null result</dt><dd>{sentenceCase(experiment.null_expectation)}</dd></div> : null}
          {experiment?.positive_controls?.length ? <div><dt>positive controls</dt><dd>{experiment.positive_controls.map(sentenceCase).join(" · ")}</dd></div> : null}
          {experiment?.negative_controls?.length ? <div><dt>nuisance controls</dt><dd>{experiment.negative_controls.map(sentenceCase).join(" · ")}</dd></div> : null}
          {experiment?.replicate_plan ? <div><dt>repeat plan</dt><dd>{sentenceCase(experiment.replicate_plan)}</dd></div> : null}
          {experiment?.acceptance_rule ? <div><dt>advance when</dt><dd>{sentenceCase(experiment.acceptance_rule)}</dd></div> : null}
          <div><dt>reject when</dt><dd>{sentenceCase(falsifier ?? candidate.why_it_might_fail?.[0] ?? "the mechanism-specific control is indistinguishable from the candidate")}</dd></div>
          {experiment?.information_gained ? <div><dt>decision earned</dt><dd>{sentenceCase(experiment.information_gained)}</dd></div> : null}
          {experiment?.approx_cost ? <div><dt>bench class</dt><dd>{sentenceCase(experiment.approx_cost)}</dd></div> : null}
          {run.objective?.missing_information?.length ? <div><dt>missing information</dt><dd>{run.objective.missing_information.map(sentenceCase).join(" · ")}</dd></div> : null}
          <div><dt>claim ceiling</dt><dd>{sentenceCase(claimLabel(measurement?.claim_ceiling ?? dossier?.claim_ceiling ?? candidate.claim_ceiling))}</dd></div>
        </dl>
      </div>

      </div>{/* dossier-detail */}
    </div>
  );
}

function MfeSensitivityChart({ model }: { model: MfeSensitivity }) {
  const fields = model.fields_mT ?? [];
  const lower = model.lower_curve_percent ?? [];
  const baseline = model.baseline_curve_percent ?? [];
  const upper = model.upper_curve_percent ?? [];
  if (fields.length < 2 || lower.length !== fields.length || baseline.length !== fields.length || upper.length !== fields.length) return null;
  const W = 680, H = 205, L = 44, R = 18, T = 22, B = 34;
  const xMin = Math.min(...fields), xMax = Math.max(...fields);
  const yMin = Math.min(0, ...lower), yMax = Math.max(0.01, ...upper);
  const x = (v: number) => L + ((v - xMin) / Math.max(1e-9, xMax - xMin)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / Math.max(1e-9, yMax - yMin)) * (H - T - B);
  const line = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(fields[i]).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = [
    ...upper.map((v, i) => `${i ? "L" : "M"}${x(fields[i]).toFixed(2)},${y(v).toFixed(2)}`),
    ...lower.map((_, reverseIndex) => {
      const i = lower.length - 1 - reverseIndex;
      return `L${x(fields[i]).toFixed(2)},${y(lower[i]).toFixed(2)}`;
    }),
    "Z",
  ].join(" ");
  const scenarios = model.scenarios ?? [];
  const jValues = scenarios.map((scenario) => scenario.exchange_j_mT);
  const rateValues = scenarios.flatMap((scenario) => [scenario.singlet_recombination_s, scenario.triplet_recombination_s, scenario.relaxation_s]);
  const jRange = jValues.length ? `${Math.min(...jValues).toPrecision(2)}–${Math.max(...jValues).toPrecision(2)} mT` : "not available";
  const rateRange = rateValues.length ? `${Math.min(...rateValues).toExponential(1)}–${Math.max(...rateValues).toExponential(1)} s⁻¹` : "not available";
  return (
    <figure className="mfe-chart">
      <figcaption><strong>Modeled singlet-yield response versus field</strong><span>band: J + rate sensitivity · line: geometry-J baseline rates</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Modeled singlet-yield magnetic-field-effect sensitivity from ${model.lower_percent} to ${model.upper_percent} percent over zero to ${model.field_range_mT} millitesla`}>
        <line className="mfe-axis" x1={L} y1={y(0)} x2={W - R} y2={y(0)} />
        <line className="mfe-axis" x1={L} y1={T} x2={L} y2={H - B} />
        <path className="mfe-band" d={area} />
        <path className="mfe-baseline" d={line(baseline)} />
        <text className="mfe-tick" x={L} y={H - 10}>0</text>
        <text className="mfe-tick" x={W - R} y={H - 10} textAnchor="end">{model.field_range_mT} mT</text>
        <text className="mfe-tick" x={8} y={T + 4}>{yMax.toFixed(1)}%</text>
        <text className="mfe-label" x={W - R} y={T + 10} textAnchor="end">assumption envelope</text>
      </svg>
      <p>Exchange J: {jRange} · kinetic rates: {rateRange} · class-level hyperfine held fixed.</p>
    </figure>
  );
}

// Moved from NarrativeReplay: the selected candidate's public evidence, mechanism ladder, and gaps.
function EvidenceLedger({ candidate, dossier, score }: { candidate: CandidateRecord; dossier?: CandidateDossier; score?: DiscoveryScore }) {
  const citations = dossier?.evidence_citations ?? [];
  const steps = score?.mechanism_graph?.primitives ?? [];
  const unresolved = steps.filter((p) => p.knowledge.state !== "known").length;
  const degradations = candidate.degradations ?? [];
  return (
    <div className="atlas-evidence">
      <div className="ev-col">
        <span className="ev-head">public evidence · supports mechanism plausibility</span>
        {citations.length ? (
          <ul className="ev-cites">
            {citations.map((c, i) => (
              <li key={c.doi + i}>
                <span className="ev-cite-meta">{c.authors.split(",")[0]} et al. {c.year}. {c.title}. <em>{c.venue}</em>.</span>
                <a className="ev-doi" href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer">doi:{c.doi}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ev-none">No public citation anchors this route in the current build. It stands on scientific rationale, not on literature.</p>
        )}
      </div>
      <div className="ev-col">
        <span className="ev-head">mechanism steps · {steps.length ? `${unresolved} of ${steps.length} unresolved` : "not composed"}</span>
        {steps.length > 0 && (
          <ol className="ev-steps">
            {steps.map((p, i) => (
              <li key={i} className={`ev-step ev-${p.knowledge.state}`}><b>{p.knowledge.state}</b><span>{sentenceCase(p.detail)}</span></li>
            ))}
          </ol>
        )}
      </div>
      <div className="ev-col">
        <span className="ev-head">what we could not resolve</span>
        {degradations.length ? (
          <ul className="ev-gaps">{degradations.map((d, i) => <li key={i}>{sentenceCase(d)}</li>)}</ul>
        ) : (
          <p className="ev-none">Retrieval and enrichment completed with no recorded gaps for this candidate.</p>
        )}
      </div>
    </div>
  );
}
