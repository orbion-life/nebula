/**
 * Cinematic scroll narrative — a GSAP + ScrollTrigger replay of a completed run.
 *
 * Seven scroll chapters replay the completed run: objective, retrieval, mechanism
 * routes, structure availability, explicitly bounded calculations, triage lanes, and
 * a measurement handoff. Public records, assumptions, and synthetic references remain
 * visually and verbally distinct.
 *
 * Reduced-motion: ScrollTrigger is not registered — the chapters render as a normal,
 * fully-visible tall scroll page with no scrubbed motion.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { getStructure, type RunState, type StructureResponse } from "../../../api/client";
import { StructureViewer } from "../StructureViewer";
import { Traces } from "../Traces";
import { UniverseHero } from "../universe/UniverseHero";
import { claimLabel, computedSpinParam, dossierMarkdown, isCandidateSpecific, isSpinDynamics } from "../dossierExport";

interface Props {
  run: RunState;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function NarrativeReplay({ run }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = reducedMotion();

  const topId = run.selected_candidate_id ?? run.evidence_shortlist?.[0] ?? run.frontier_experiments?.[0]?.candidate_id ?? null;
  const dossier = useMemo(() => (run.dossiers ?? []).find((d) => d.candidate.candidate_id === topId), [run, topId]);
  const candidate = dossier?.candidate;
  const score = (run.discovery_scores ?? []).find((s) => s.candidate_id === topId);
  const frontier = (run.frontier_experiments ?? []).find((f) => f.candidate_id === topId);
  const physicsDossier = useMemo(
    () => (run.dossiers ?? []).find((d) => isCandidateSpecific(d)) ?? dossier,
    [run, dossier],
  );
  const physicsCandidate = physicsDossier?.candidate;
  const physicsId = physicsCandidate?.candidate_id ?? null;

  const uniqueAccessions = useMemo(() => {
    const seen = new Set<string>();
    for (const c of run.candidates ?? []) seen.add(c.uniprot?.primary_accession ?? c.candidate_id);
    return [...seen];
  }, [run]);

  const routeMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of run.candidates ?? []) m.set(c.route_class, (m.get(c.route_class) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [run]);
  const maxRoute = Math.max(1, ...routeMix.map(([, n]) => n));

  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [structureStatus, setStructureStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [universeSelected, setUniverseSelected] = useState<string | null>(topId);
  useEffect(() => {
    if (!physicsId) {
      setStructure(null);
      setStructureStatus("unavailable");
      return;
    }
    let live = true;
    setStructure(null);
    setStructureStatus("loading");
    getStructure(physicsId)
      .then((s) => {
        if (!live) return;
        setStructure(s);
        setStructureStatus("ready");
      })
      .catch(() => {
        if (!live) return;
        setStructure(null);
        setStructureStatus("unavailable");
      });
    return () => { live = false; };
  }, [physicsId]);

  useGSAP(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const chapters = gsap.utils.toArray<HTMLElement>(".narr-chapter", scope.current);
    for (const [index, ch] of chapters.entries()) {
      const reveal = ch.querySelector(".narr-reveal");
      if (reveal) {
        gsap.from(reveal, {
          opacity: 0, x: index % 2 === 0 ? -24 : 24, y: 18,
          scrollTrigger: { trigger: ch, start: "top 80%", end: "top 35%", scrub: 0.6 },
        });
      }
    }
    const fill = scope.current.querySelector(".narr-progress-fill");
    if (fill) {
      gsap.to(fill, { scaleY: 1, ease: "none", transformOrigin: "top",
        scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom bottom", scrub: true } });
    }
  }, { scope, dependencies: [run.run_id] });

  const acc = candidate?.uniprot?.primary_accession;
  const physicsAcc = physicsCandidate?.uniprot?.primary_accession;
  const spin = computedSpinParam(physicsDossier);
  const cs = isCandidateSpecific(physicsDossier);
  const abstained = (run.evidence_shortlist?.length ?? 0) === 0 && (run.frontier_experiments?.length ?? 0) === 0;

  const downloadHandoff = () => {
    if (!candidate) return;
    const md = dossierMarkdown(candidate, dossier, run);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nebula-handoff-${acc ?? topId ?? "candidate"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="narr" ref={scope}>
      <div className="narr-progress" aria-hidden><div className="narr-progress-fill" /></div>

      <Chapter n="01" kicker="objective">
        <h1 className="narr-h">You brought the goal. We went looking.</h1>
        <p className="narr-obj">{run.objective.objective_text}</p>
        <div className="narr-chips">
          {run.objective.sensed_quantity_or_state && <span className="chip">sense: {run.objective.sensed_quantity_or_state.replace(/-/g, " ")}</span>}
          {(run.objective.desired_modalities ?? []).map((m) => <span className="chip" key={m}>{m.replace(/_/g, " ")}</span>)}
        </div>
      </Chapter>

      <Chapter n="02" kicker="search the protein universe">
        <h2 className="narr-h">{uniqueAccessions.length} public proteins. {(run.candidates ?? []).length} supported route hypotheses.</h2>
        <p className="narr-sub">
          {run.offline ? "Replayed from versioned public data fixtures." : "Retrieved from public protein and structure services."}
          {" "}A protein can enter only a route supported by its annotations.
        </p>
        <div className="narr-acc-grid">
          {uniqueAccessions.map((accession) => <span key={accession} className="narr-acc">{accession}</span>)}
        </div>
      </Chapter>

      <Chapter n="03" kicker="mechanism routes">
        <h2 className="narr-h">Public annotations constrain which mechanisms remain possible.</h2>
        <div className="narr-routes">
          {routeMix.map(([route, n]) => (
            <div className="narr-route" key={route}>
              <span className="narr-route-name">{humanRoute(route)}</span>
              <span className="narr-route-bar"><span style={{ width: `${(n / maxRoute) * 100}%` }} /></span>
              <span className="narr-route-n">{n}</span>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="04" kicker="structure gate">
        <h2 className="narr-h">{physicsAcc ? `${physicsAcc} · structure and cofactor context` : "No structure qualified for inspection."}</h2>
        <div className="narr-struct">
          {structureStatus === "unavailable" ? (
            <div className="narr-empty">No experimental or predicted structure was available for this route hypothesis.</div>
          ) : (
            <StructureViewer structure={structure} loading={structureStatus === "loading"} cofactorLabel={physicsCandidate?.cofactors?.[0]?.name ?? null} />
          )}
        </div>
      </Chapter>

      <Chapter n="05" kicker="compute">
        <h2 className="narr-h">A computed reference. Assumptions exposed.</h2>
        {physicsDossier && isSpinDynamics(physicsDossier) ? (
          <>
            <p className="narr-sub">
              {cs
                ? `An isolated neutral doublet isoalloxazine cluster was extracted from ${physicsAcc}. Its basis dependent Mulliken spin population is ${spin ? spin.value.toFixed(3) : "not available"}. Protein environment, radical partner and dynamics are omitted.`
                : "No candidate specific quantum chemistry completed. The curve below is a generic flavin radical pair assumption sweep."}
            </p>
            <div className="narr-trace"><Traces spin={spin} candidateSpecific={cs} candidateLabel={physicsAcc ?? physicsCandidate?.title} /></div>
          </>
        ) : (
          <p className="narr-sub">This route has no candidate specific spin dynamics model in the current build. It remains an experimental hypothesis, not a computed spin result.</p>
        )}
      </Chapter>

      <Chapter n="06" kicker="rank · evidence vs frontier">
        <h2 className="narr-h">Evidence and exploration answer different questions.</h2>
        {abstained ? (
          <p className="narr-sub">Evidence backed abstention. No public protein was eligible under this objective. The honest answer, not a manufactured winner.</p>
        ) : (
          <div className="narr-universe"><UniverseHero run={run} selectedId={universeSelected} onSelect={setUniverseSelected} /></div>
        )}
        {score && (
          <>
            <div className="narr-score-words">
              <span>mechanism support <strong>{scoreBand(score.P_plausibility)}</strong></span>
              <span>measurement fit <strong>{scoreBand(score.M_measurability)}</strong></span>
              <span>annotation based developability <strong>{scoreBand(score.D_developability)}</strong></span>
            </div>
            <details className="narr-metrics">
              <summary>expert triage axes</summary>
              <p>P={score.P_plausibility.toFixed(2)} · M={score.M_measurability.toFixed(2)} · D={score.D_developability.toFixed(2)} · IG={score.IG_information_gain.toFixed(2)}</p>
              <small>Uncalibrated prioritization heuristics. They are not probabilities or predicted performance.</small>
            </details>
          </>
        )}
      </Chapter>

      <Chapter n="07" kicker="measure next">
        {candidate ? (
          <>
            <h2 className="narr-h">Best supported next measurement under these assumptions: {acc}.</h2>
            <p className="narr-plan-line"><strong>Route compatible measurement scenario:</strong> {(score?.suggested_instrument_id ?? frontier?.discriminating_experiment?.instrument_id ?? run.instrument_id ?? "benchtop_field_fluorimeter").replace(/_/g, " ")}</p>
            <p className="narr-plan-line"><strong>{claimLabel(candidate.claim_ceiling)}</strong></p>
            {candidate.why_it_might_work?.[0] && <p className="narr-plan-line"><strong>Why it remains:</strong> {candidate.why_it_might_work[0]}</p>}
            <p className="narr-plan-line narr-fals">
              <strong>Falsification:</strong>{" "}
              {frontier?.falsifier ?? `if the mechanism specific control shows the same signal change as the construct, the ${humanRoute(candidate.route_class)} hypothesis for ${acc} is rejected.`}
            </p>
          </>
        ) : (
          <h2 className="narr-h">No candidate to measure yet. Broaden the objective.</h2>
        )}
        {candidate && (
          <button className="btn-run" onClick={downloadHandoff}>download the handoff ↓</button>
        )}
        {(run.generative_frontier ?? []).length > 0 && (
          <details className="narr-unmade-details">
            <summary>speculative design frontier</summary>
            <p>These are design directions only. No sequence or orderable construct is produced.</p>
            <div className="narr-unmade">
              {(run.generative_frontier ?? []).map((g) => (
                <div className="unmade-card" key={g.label}>
                  <span className="unmade-name">{g.label}</span>
                  <span className="unmade-for">invented for {g.invented_for}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </Chapter>
    </div>
  );
}

function humanRoute(route: string): string {
  if (route === "RFP_flavin_photochemical") return "flavin photochemical light history";
  return route.replace(/_/g, " ").replace(/\bFAD\b/i, "FAD").replace(/\bLOV\b/i, "LOV");
}

function scoreBand(value: number): string {
  if (value < 0.34) return "low";
  if (value < 0.67) return "moderate";
  return "higher within this run";
}

function Chapter({ n, kicker, children }: { n: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="narr-chapter">
      <div className="narr-reveal">
        <div className="narr-kicker"><span className="narr-n">{n}</span>{kicker}</div>
        {children}
      </div>
    </section>
  );
}
