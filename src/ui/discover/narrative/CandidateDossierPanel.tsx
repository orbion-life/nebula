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
import { claimLabel, computedSpinParam, isCandidateSpecific, isSpinDynamics, routeLabel } from "../dossierExport";
import { AppliedConstraints } from "./AppliedConstraints";
import { FieldPrecedent } from "./FieldPrecedent";
import { RationaleConstellation, type Facet, type FacetId } from "./RationaleConstellation";

const Traces = lazy(() => import("../Traces").then((m) => ({ default: m.Traces })));

type Frontier = NonNullable<RunState["frontier_experiments"]>[number];

export function CandidateDossierPanel({ candidate, dossier, score, frontier, run }: {
  candidate?: CandidateRecord;
  dossier?: CandidateDossier;
  score?: DiscoveryScore;
  frontier?: Frontier;
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
  const mfe = rp?.magnetic_field_effect_percent;
  const physicsMetric = mfe != null ? `~${mfe}%` : spinParam ? spinParam.value.toFixed(2) : undefined;
  const facets: Facet[] = [
    { id: "why", label: "Rationale", takeaway: "why it ranked", tone: lane === "evidence" ? "evidence" : "frontier" },
    { id: "evidence", label: "Evidence", takeaway: citations.length ? "public support" : "rationale only", metric: String(citations.length), tone: "evidence" },
    { id: "physics", label: "Physics", takeaway: spinEligible ? (mfe != null ? "field effect" : "spin computed") : "route only", metric: physicsMetric, tone: "physics" },
    { id: "fit", label: "Fit", takeaway: "constraints", tone: "fit" },
    { id: "decisive", label: "Decisive test", takeaway: "run this", tone: "decisive" },
  ];

  return (
    <div className="dossier dossier-constellation">
      <p className="dossier-cluetip">The case for <strong>{accession}</strong>. Tap a star to open its detail.</p>
      <RationaleConstellation accession={accession} lane={lane} facets={facets} activeId={activeId} onSelect={setActiveId} />
      <div className="dossier-detail">

      {/* RATIONALE facet */}
      <div className="dossier-facet dossier-why" hidden={activeId !== "why"}>
        <span className="dossier-k">why {accession} earned a place</span>
        <p className="dossier-rationale">
          {`A ${routeLabel(candidate.route_class)} candidate carrying ${cofactors}, ranked ${score?.lane === "evidence" ? "onto the evidence lane" : "into the frontier"} for its mechanism support and measurement value against your objective.`}
        </p>
        {score?.rationale ? <p className="dossier-triage">{score.rationale}</p> : null}
        <div className="dossier-wf">
          {candidate.why_it_might_work?.length ? (
            <div><h4 className="dossier-wf-h dossier-wf-ok">why it might work</h4><ul>{candidate.why_it_might_work.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          ) : null}
          {candidate.why_it_might_fail?.length ? (
            <div><h4 className="dossier-wf-h dossier-wf-warn">why it might fail</h4><ul>{candidate.why_it_might_fail.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          ) : null}
        </div>
      </div>

      {/* PHYSICS facet: THIS protein's own number first; the generic MARY is a labelled reference */}
      <div className="dossier-facet dossier-physics" hidden={activeId !== "physics"}>
        <h3 tabIndex={-1}>{spinEligible ? `The spin physics behind ${accession}` : `What we can (and cannot) compute for ${accession}`}</h3>
        {spinEligible ? (
          <>
            <p className="dossier-lead">
              {spinParam
                ? `${accession}'s own max Mulliken spin population is ${spinParam.value.toFixed(3)}, ${candidateSpecific ? "computed on structure-extracted coordinates" : `a ${geometry ?? "route-level isoalloxazine template, not yet extracted from this protein's structure"}`}. Basis-dependent, HIGH uncertainty; not a probability and not a response prediction.`
                : `No candidate-specific spin value was produced for ${accession}; a generic isoalloxazine template applies to its flavin radical-pair route. Its physics stands on the route reference, not on this protein's own coordinates.`}
            </p>
            {rp ? (
              <div className="dossier-rp">
                <span className="dossier-k dossier-k-teal">radical pair, read from {accession}'s structure</span>
                <p className="dossier-rp-lead">
                  Electron-transfer partner <strong>{rp.partner_residue}</strong> ({rp.partner_kind}), {rp.separation_angstrom} Å from the flavin along its aromatic hopping chain.
                </p>
                <dl className="dossier-rp-vals">
                  <div><dt>separation</dt><dd>{rp.separation_angstrom} Å</dd></div>
                  <div><dt>dipolar D</dt><dd>{rp.dipolar_d_mT.toFixed(3)} mT <small>point dipole, well constrained</small></dd></div>
                  <div><dt>exchange J</dt><dd>~{rp.exchange_j_mT.toExponential(1)} mT <small>tunnelling estimate, order of magnitude only</small></dd></div>
                  {rp.magnetic_field_effect_percent != null ? (
                    <div><dt>field effect</dt><dd>up to ~{rp.magnetic_field_effect_percent}% <small>coarse RadicalPy estimate, not validated</small></dd></div>
                  ) : null}
                </dl>
                <p className="dossier-rp-note">Partner, separation and D are per-protein, read from this structure. The magnetic field effect is a coarse RadicalPy model estimate under stated assumptions (class-level hyperfine, generic kinetics, no optical transduction), not a validated prediction and not a claim this protein works as a sensor.</p>
              </div>
            ) : null}
            <details className="dossier-reference" open>
              <summary>reference radical-pair model, a synthetic assumption sweep, not {accession}</summary>
              <Suspense fallback={<div className="atlas-compute-loading" aria-live="polite">composing the spin dynamics trace…</div>}>
                <Traces spin={spinParam} candidateSpecific={candidateSpecific} candidateLabel={accession} />
              </Suspense>
            </details>
          </>
        ) : (
          <p className="dossier-lead">
            No candidate-specific quantum chemistry for this route. {routeLabel(candidate.route_class)} is a frontier hypothesis;
            only the flavin radical-pair route computes candidate-specific spin in this build. {accession} is scored on public
            annotation and measurement value alone, no physics theater stands in for a computation we did not run.
          </p>
        )}
        <FieldPrecedent route={candidate.route_class} />
      </div>

      {/* EVIDENCE facet: public evidence + mechanism ladder + what we could not resolve */}
      <div className="dossier-facet" hidden={activeId !== "evidence"}>
        <EvidenceLedger candidate={candidate} dossier={dossier} score={score} />
      </div>

      {/* FIT facet: the uncalibrated triage axes + satisfied/remaining constraints */}
      <div className="dossier-facet" hidden={activeId !== "fit"}>
        <AppliedConstraints score={score} dossier={dossier} />
      </div>

      {/* DECISIVE facet: the one falsifiable measurement that earns bench time (default open) */}
      <div className="dossier-facet dossier-measure" hidden={activeId !== "decisive"}>
        <span className="dossier-k dossier-k-teal">decisive next measurement</span>
        <h3 className="dossier-measure-what">{frontier?.discriminating_experiment?.what_to_measure ?? "Test the proposed readout against its mechanism-specific controls."}</h3>
        <dl>
          <div><dt>instrument</dt><dd>{(score?.suggested_instrument_id ?? frontier?.discriminating_experiment?.instrument_id ?? run.instrument_id ?? "route-compatible measurement bench").replace(/_/g, " ")}</dd></div>
          <div><dt>reject when</dt><dd>{frontier?.falsifier ?? candidate.why_it_might_fail?.[0] ?? "the mechanism-specific control is indistinguishable from the candidate"}</dd></div>
          <div><dt>claim ceiling</dt><dd>{claimLabel(dossier?.claim_ceiling ?? candidate.claim_ceiling)}</dd></div>
        </dl>
      </div>

      </div>{/* dossier-detail */}
    </div>
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
              <li key={i} className={`ev-step ev-${p.knowledge.state}`}><b>{p.knowledge.state}</b><span>{p.detail}</span></li>
            ))}
          </ol>
        )}
      </div>
      <div className="ev-col">
        <span className="ev-head">what we could not resolve</span>
        {degradations.length ? (
          <ul className="ev-gaps">{degradations.map((d, i) => <li key={i}>{d}</li>)}</ul>
        ) : (
          <p className="ev-none">Retrieval and enrichment completed with no recorded gaps for this candidate.</p>
        )}
      </div>
    </div>
  );
}
