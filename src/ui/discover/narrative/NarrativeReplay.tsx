/**
 * Cinematic scroll narrative — a GSAP + ScrollTrigger replay of a completed run.
 *
 * Seven pinned/scrubbed chapters (Objective → Search → Routes → Structure → Compute →
 * Rank → Measure next), each driven by the REAL run data (no canned copy): the objective
 * and its constraints, the real accessions retrieved, the mechanism-route mix, the top
 * candidate's actual structure + candidate-specific QM + Tufte trace, the two ranked
 * lanes, and the decisive next experiment. The calm workspace remains the repeat-use
 * surface (per the brief); this is the authored first read.
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
import { claimLabel, computedSpinParam, isCandidateSpecific, isSpinDynamics } from "../dossierExport";

interface Props {
  run: RunState;
  onEnterWorkspace: () => void;
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function NarrativeReplay({ run, onEnterWorkspace }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = reducedMotion();

  const topId = run.selected_candidate_id ?? run.evidence_shortlist?.[0] ?? run.frontier_experiments?.[0]?.candidate_id ?? null;
  const dossier = useMemo(() => (run.dossiers ?? []).find((d) => d.candidate.candidate_id === topId), [run, topId]);
  const candidate = dossier?.candidate;
  const score = (run.discovery_scores ?? []).find((s) => s.candidate_id === topId);
  const frontier = (run.frontier_experiments ?? []).find((f) => f.candidate_id === topId);

  const routeMix = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of run.candidates ?? []) m.set(c.route_class, (m.get(c.route_class) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [run]);
  const maxRoute = Math.max(1, ...routeMix.map(([, n]) => n));

  const [structure, setStructure] = useState<StructureResponse | null>(null);
  useEffect(() => {
    if (!topId) return;
    let live = true;
    getStructure(topId).then((s) => live && setStructure(s)).catch(() => live && setStructure(null));
    return () => { live = false; };
  }, [topId]);

  useGSAP(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const chapters = gsap.utils.toArray<HTMLElement>(".narr-chapter", scope.current);
    for (const ch of chapters) {
      const reveal = ch.querySelector(".narr-reveal");
      if (reveal) {
        gsap.from(reveal, {
          opacity: 0, y: 56,
          scrollTrigger: { trigger: ch, start: "top 80%", end: "top 35%", scrub: 0.6 },
        });
      }
    }
    const fill = scope.current.querySelector(".narr-progress-fill");
    if (fill) {
      gsap.to(fill, { scaleY: 1, ease: "none", transformOrigin: "top",
        scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom bottom", scrub: true } });
    }
    return () => ScrollTrigger.getAll().forEach((t) => t.kill());
  }, { scope, dependencies: [run.run_id] });

  const acc = candidate?.uniprot?.primary_accession;
  const spin = computedSpinParam(dossier);
  const cs = isCandidateSpecific(dossier);
  const abstained = (run.evidence_shortlist?.length ?? 0) === 0 && (run.frontier_experiments?.length ?? 0) === 0;

  return (
    <div className="narr" ref={scope}>
      <div className="narr-progress" aria-hidden><div className="narr-progress-fill" /></div>
      <button className="narr-skip btn-ghost" onClick={onEnterWorkspace}>skip to workspace →</button>

      <Chapter n="01" kicker="objective">
        <h1 className="narr-h">What should the protein report — and how would we measure it?</h1>
        <p className="narr-obj">{run.objective.objective_text}</p>
        <div className="narr-chips">
          {run.objective.sensed_quantity_or_state && <span className="chip">sense: {run.objective.sensed_quantity_or_state}</span>}
          {(run.objective.desired_modalities ?? []).map((m) => <span className="chip" key={m}>{m}</span>)}
        </div>
      </Chapter>

      <Chapter n="02" kicker="search the protein universe">
        <h2 className="narr-h">{(run.candidates ?? []).length} real public proteins retrieved.</h2>
        <p className="narr-sub">Live from UniProt · InterPro · RCSB · AlphaFold — real accessions, not template families.</p>
        <div className="narr-acc-grid">
          {(run.candidates ?? []).map((c) => (
            <span key={c.candidate_id} className="narr-acc">{c.uniprot?.primary_accession ?? c.candidate_id.slice(0, 8)}</span>
          ))}
        </div>
      </Chapter>

      <Chapter n="03" kicker="mechanism routes">
        <h2 className="narr-h">Each candidate is mapped to a spin-linked mechanism route.</h2>
        <div className="narr-routes">
          {routeMix.map(([route, n]) => (
            <div className="narr-route" key={route}>
              <span className="narr-route-name">{route}</span>
              <span className="narr-route-bar"><span style={{ width: `${(n / maxRoute) * 100}%` }} /></span>
              <span className="narr-route-n">{n}</span>
            </div>
          ))}
        </div>
      </Chapter>

      <Chapter n="04" kicker="structure gate">
        <h2 className="narr-h">{acc ? `${acc} — real structure, cofactor in focus` : "structure"}</h2>
        <div className="narr-struct"><StructureViewer structure={structure} loading={!structure} cofactorLabel={candidate?.cofactors?.[0]?.name ?? null} /></div>
      </Chapter>

      <Chapter n="05" kicker="compute">
        <h2 className="narr-h">Physics — computed, not assumed.</h2>
        {dossier && isSpinDynamics(dossier) ? (
          <>
            <p className="narr-sub">
              {cs
                ? `Candidate-specific UHF on this protein's real isoalloxazine — max Mulliken spin ${spin ? spin.value.toFixed(3) : "—"} (high uncertainty; not a performance claim).`
                : "Generic isoalloxazine template — not yet candidate-specific."}
            </p>
            <div className="narr-trace"><Traces spin={spin} candidateSpecific={cs} candidateLabel={acc ?? candidate?.title} /></div>
          </>
        ) : (
          <p className="narr-sub">No spin-dynamics reference applies to this route; it is scored on measurement value only.</p>
        )}
      </Chapter>

      <Chapter n="06" kicker="rank — evidence vs frontier">
        <h2 className="narr-h">Two strictly-separate lanes. Frontier never outranks evidence.</h2>
        {abstained ? (
          <p className="narr-sub">Evidence-backed abstention — no public protein was eligible under this objective. The honest answer, not a manufactured winner.</p>
        ) : (
          <div className="narr-universe"><UniverseHero run={run} selectedId={topId} onSelect={() => {}} /></div>
        )}
        {score && <p className="narr-rationale">P={score.P_plausibility.toFixed(2)} · M={score.M_measurability.toFixed(2)} · D={score.D_developability.toFixed(2)} · IG={score.IG_information_gain.toFixed(2)}</p>}
      </Chapter>

      <Chapter n="07" kicker="measure next">
        {candidate ? (
          <>
            <h2 className="narr-h">Test {acc} next.</h2>
            <p className="narr-plan-line"><strong>Instrument:</strong> {frontier?.discriminating_experiment?.instrument_id ?? run.instrument_id ?? "benchtop field fluorimeter"}</p>
            <p className="narr-plan-line"><strong>{claimLabel(candidate.claim_ceiling)}</strong></p>
            <p className="narr-plan-line narr-fals">
              <strong>Falsification:</strong>{" "}
              {frontier?.falsifier ?? `if the mechanism-specific control shows the same signal change as the construct, the ${candidate.route_class} hypothesis for ${acc} is rejected.`}
            </p>
            <p className="narr-disclaimer">Unvalidated public-protein candidate hypothesis. Computation is not validation; no working sensor is claimed.</p>
          </>
        ) : (
          <h2 className="narr-h">No candidate to measure — broaden the objective.</h2>
        )}
        <button className="btn-run" onClick={onEnterWorkspace}>open the workspace →</button>
      </Chapter>
    </div>
  );
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
