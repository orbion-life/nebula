/**
 * Post-bench discovery experience.
 *
 * A completed run opens two visible paths: public proteins found in nature and
 * de novo backbones generated for the mission. The interface stays decision-led:
 * select a candidate, inspect its evidence, compare the generated frontier, then
 * leave with one falsifiable measurement handoff.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { getStructure, type CandidateDossier, type CandidateRecord, type DiscoveryScore, type RunState, type StructureResponse } from "../../../api/client";
import { GeneratedBackboneViewer } from "../GeneratedBackboneViewer";
import { StructureViewer } from "../StructureViewer";
import { claimLabel, computedSpinParam, dossierMarkdown, isCandidateSpecific, isSpinDynamics, routeLabel } from "../dossierExport";

// the physics trace is heavy (raw SVG + the versioned RadicalPy artifact); lazy-load it so it
// only enters the bundle when a completed run actually reaches the compute scene.
const Traces = lazy(() => import("../Traces").then((m) => ({ default: m.Traces })));

interface Props { run: RunState }

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function NarrativeReplay({ run }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = reducedMotion();
  const initialId = run.selected_candidate_id ?? run.evidence_shortlist?.[0] ?? run.frontier_experiments?.[0]?.candidate_id ?? run.candidates?.[0]?.candidate_id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [designIndex, setDesignIndex] = useState(0);
  const [structure, setStructure] = useState<StructureResponse | null>(null);
  const [structureStatus, setStructureStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const candidates = run.candidates ?? [];
  const scores = run.discovery_scores ?? [];
  const designs = run.generative_frontier ?? [];
  const selected = useMemo(() => candidates.find((c) => c.candidate_id === selectedId) ?? candidates[0], [candidates, selectedId]);
  const dossier = useMemo(() => (run.dossiers ?? []).find((d) => d.candidate.candidate_id === selected?.candidate_id), [run.dossiers, selected]);
  const score = scores.find((s) => s.candidate_id === selected?.candidate_id);
  const frontier = (run.frontier_experiments ?? []).find((f) => f.candidate_id === selected?.candidate_id);
  const design = designs[designIndex] ?? designs[0] ?? null;
  const realBackbones = designs.filter((d) => Boolean(d.backbone_pdb)).length;
  // physics scene: only radical-pair routes carry a spin-dynamics reference; everything else
  // shows the honest "no candidate-specific quantum chemistry" note (never physics theater).
  const spinParam = computedSpinParam(dossier);
  const spinEligible = isSpinDynamics(dossier);
  const candidateSpecificPhysics = isCandidateSpecific(dossier);
  const selectedLabel = selected?.uniprot?.primary_accession ?? selected?.title ?? "this protein";
  const uniqueAccessions = new Set(candidates.map((c) => c.uniprot?.primary_accession ?? c.candidate_id)).size;
  const shortlistIds = new Set([...(run.evidence_shortlist ?? []), ...(run.frontier_experiments ?? []).map((f) => f.candidate_id)]);
  const shortlist = candidates
    .filter((c) => shortlistIds.has(c.candidate_id))
    .sort((a, b) => rankOf(a.candidate_id, run) - rankOf(b.candidate_id, run));
  const visibleCandidates = shortlist.length ? shortlist : candidates.slice(0, 6);

  useEffect(() => {
    if (!selected?.candidate_id) {
      setStructure(null);
      setStructureStatus("unavailable");
      return;
    }
    let live = true;
    setStructure(null);
    setStructureStatus("loading");
    getStructure(selected.candidate_id)
      .then((next) => {
        if (!live) return;
        setStructure(next);
        setStructureStatus("ready");
      })
      .catch(() => {
        if (!live) return;
        setStructure(null);
        setStructureStatus("unavailable");
      });
    return () => { live = false; };
  }, [selected?.candidate_id]);

  useGSAP(() => {
    if (reduced || !scope.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const scenes = gsap.utils.toArray<HTMLElement>(".atlas-scene", scope.current);
    scenes.forEach((scene) => {
      const reveal = scene.querySelector(".atlas-reveal");
      if (!reveal) return;
      gsap.from(reveal, {
        opacity: 0,
        y: 42,
        scale: 0.985,
        scrollTrigger: { trigger: scene, start: "top 82%", end: "top 38%", scrub: 0.55 },
      });
    });
    const fill = scope.current.querySelector(".atlas-progress-fill");
    if (fill) {
      gsap.to(fill, {
        scaleX: 1,
        ease: "none",
        transformOrigin: "left",
        scrollTrigger: { trigger: scope.current, start: "top top", end: "bottom bottom", scrub: true },
      });
    }
  }, { scope, dependencies: [run.run_id] });

  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  const downloadHandoff = () => {
    if (!selected) return;
    const base = dossierMarkdown(selected, dossier, run);
    const generated = design
      ? `\n\n## Generated design path\n\n- ${design.label}\n- Generator: ${design.generator}\n- Coordinates returned: ${design.backbone_pdb ? "yes" : "no"}\n- Sequence returned: no\n- Status: unvalidated design hypothesis\n`
      : "";
    const blob = new Blob([base + generated], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nebula-discovery-${selected.uniprot?.primary_accession ?? selected.candidate_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="atlas" ref={scope}>
      <div className="atlas-progress" aria-hidden><div className="atlas-progress-fill" /></div>
      <nav className="atlas-nav" aria-label="discovery result sections">
        <button onClick={() => jumpTo("atlas-outcome")}>outcome</button>
        <button onClick={() => jumpTo("atlas-nature")}>discover</button>
        <button onClick={() => jumpTo("atlas-compute")}>physics</button>
        <button onClick={() => jumpTo("atlas-generate")}>generate</button>
        <button onClick={() => jumpTo("atlas-decision")}>measure</button>
      </nav>

      <section className="atlas-scene atlas-hero" id="atlas-outcome">
        <div className="atlas-reveal">
          <span className="atlas-eyebrow">mission resolved</span>
          <h1>The search opened<br /><em>two paths.</em></h1>
          <p>{run.objective.sensed_quantity_or_state?.replace(/-/g, " ") ?? "Your sensing objective"}, translated into candidates that exist and structures that could.</p>
          <div className="atlas-paths">
            <button className="atlas-path atlas-path-natural" onClick={() => jumpTo("atlas-nature")}>
              <span>found in nature</span>
              <strong>{uniqueAccessions}</strong>
              <small>public protein{uniqueAccessions === 1 ? "" : "s"} inspected</small>
            </button>
            <button className="atlas-path atlas-path-generated" onClick={() => jumpTo("atlas-generate")}>
              <span>generated for this mission</span>
              <strong>{realBackbones || designs.length}</strong>
              <small>{realBackbones ? "RFdiffusion backbones" : "generation briefs"}</small>
            </button>
          </div>
          <p className="atlas-honesty">Nothing here is a proven sensor. Everything here is a clearer next experiment.</p>
        </div>
      </section>

      <section className="atlas-scene atlas-nature" id="atlas-nature">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">01 · discover</span><h2>What nature already built.</h2></div>
            <p>Public proteins filtered by mechanism support, measurement fit, and developability context.</p>
          </header>
          <CandidateConstellation candidates={candidates} scores={scores} selectedId={selected?.candidate_id ?? null} onSelect={setSelectedId} />
          <div className="atlas-inspector">
            <div className="atlas-candidate-list" role="list" aria-label="candidate shortlist">
              {visibleCandidates.map((candidate, index) => {
                const candidateScore = scores.find((item) => item.candidate_id === candidate.candidate_id);
                const active = candidate.candidate_id === selected?.candidate_id;
                return (
                  <button key={candidate.candidate_id} className={`atlas-candidate ${active ? "on" : ""}`} onClick={() => setSelectedId(candidate.candidate_id)} aria-pressed={active}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{candidate.uniprot?.primary_accession ?? candidate.title.split(" — ")[0]}</strong>
                    <small>{humanRoute(candidate.route_class)}</small>
                    <i style={{ "--metric": candidateScore?.M_measurability ?? 0 } as CSSProperties} />
                  </button>
                );
              })}
            </div>
            <div className="atlas-candidate-stage">
              <StructureViewer structure={structure} loading={structureStatus === "loading"} cofactorLabel={selected?.cofactors?.[0]?.name ?? null} />
              <CandidateCaption candidate={selected} dossier={dossier} score={score} />
            </div>
          </div>
        </div>
      </section>

      <section className="atlas-scene atlas-compute" id="atlas-compute">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">02 · physics</span><h2>The spin physics, laid bare.</h2></div>
            <p>A reference radical-pair spin-dynamics calculation with its counterfactual controls and every assumption it rests on. A synthetic assumption sweep, not a prediction of this protein.</p>
          </header>
          {spinEligible ? (
            <div className="atlas-compute-body">
              <Suspense fallback={<div className="atlas-compute-loading" aria-live="polite">composing the spin dynamics trace…</div>}>
                <Traces spin={spinParam} candidateSpecific={candidateSpecificPhysics} candidateLabel={selectedLabel} />
              </Suspense>
              <p className="atlas-compute-foot">
                {spinParam
                  ? `${selectedLabel} carries a candidate-specific max Mulliken spin population (isolated neutral-doublet cluster, ${candidateSpecificPhysics ? "structure-extracted" : "generic template"}), shown on its own axis — basis-dependent, HIGH uncertainty, not a probability and not a response prediction.`
                  : `No candidate-specific spin value was produced for this flavin radical-pair candidate; a generic isoalloxazine template applies. The reference sweep above stands as mechanism context, not a prediction.`}
              </p>
            </div>
          ) : (
            <div className="atlas-compute-none">
              <p>No candidate-specific quantum chemistry for this route. {routeLabel(selected?.route_class ?? "")} is a frontier hypothesis; only the flavin radical-pair route computes candidate-specific spin in this build. This candidate is scored on public annotation and measurement value alone.</p>
            </div>
          )}
        </div>
      </section>

      <section className="atlas-scene atlas-generate" id="atlas-generate">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">03 · generate</span><h2>Then search beyond nature.</h2></div>
            <p>RFdiffusion proposes new backbone geometry for the same sensing mission. Coordinates are a starting point, not a finished construct.</p>
          </header>
          <div className="atlas-generator">
            <div className="atlas-design-list" role="list" aria-label="generated design directions">
              {designs.map((item, index) => {
                const active = index === designIndex;
                return (
                  <button key={`${item.label}-${index}`} className={`atlas-design ${active ? "on" : ""}`} onClick={() => setDesignIndex(index)} aria-pressed={active}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.label}</strong>
                    <small>{item.backbone_pdb ? `${item.n_residues ?? "de novo"} residue backbone` : "generation brief"}</small>
                  </button>
                );
              })}
            </div>
            <div className="atlas-design-stage">
              <GeneratedBackboneViewer pdb={design?.backbone_pdb ?? null} label={design?.label ?? "generation frontier"} residues={design?.n_residues} />
              <div className="atlas-design-meta">
                <span>{design?.generator ?? "generation unavailable"}</span>
                <strong>{design?.invented_for ?? run.objective.sensed_quantity_or_state ?? "the mission"}</strong>
                <small>{design?.backbone_pdb ? "Backbone coordinates produced. Sequence design and validation remain downstream." : "The adapter returned a design direction without coordinates in this run."}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="atlas-scene atlas-decision" id="atlas-decision">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">04 · measure</span><h2>Choose what earns bench time.</h2></div>
            <p>Nebula does not choose a winner by one score. It exposes the trade: support, measurability, developability, and uncertainty.</p>
          </header>
          {selected ? (
            <div className="atlas-decision-grid">
              <div className="atlas-decision-candidate">
                <span>measurement priority</span>
                <h3>{selected.uniprot?.primary_accession ?? selected.title}</h3>
                <p>{humanRoute(selected.route_class)}</p>
                <div className="atlas-metrics">
                  <Metric label="mechanism" value={score?.P_plausibility} />
                  <Metric label="measurable" value={score?.M_measurability} />
                  <Metric label="developable" value={score?.D_developability} />
                  <Metric label="uncertainty" value={score?.U_uncertainty} inverse />
                </div>
              </div>
              <div className="atlas-measurement">
                <span>decisive next measurement</span>
                <h3>{frontier?.discriminating_experiment?.what_to_measure ?? "Test the proposed readout against its mechanism-specific controls."}</h3>
                <dl>
                  <div><dt>instrument</dt><dd>{(score?.suggested_instrument_id ?? frontier?.discriminating_experiment?.instrument_id ?? run.instrument_id ?? "route-compatible measurement bench").replace(/_/g, " ")}</dd></div>
                  <div><dt>reject when</dt><dd>{frontier?.falsifier ?? selected.why_it_might_fail?.[0] ?? "the mechanism-specific control is indistinguishable from the candidate"}</dd></div>
                  <div><dt>claim ceiling</dt><dd>{claimLabel(selected.claim_ceiling)}</dd></div>
                </dl>
              </div>
            </div>
          ) : <p className="atlas-empty">No candidate passed into measurement planning.</p>}
          {selected && <EvidenceLedger candidate={selected} dossier={dossier} score={score} />}
        </div>
      </section>

      <section className="atlas-scene atlas-handoff" id="atlas-handoff">
        <div className="atlas-reveal">
          <span className="atlas-eyebrow">handoff</span>
          <h2>Take the next experiment with you.</h2>
          <p>One selected public candidate, one generated design direction, the assumptions, and the experiment that can prove the idea wrong.</p>
          <button className="atlas-download" onClick={downloadHandoff} disabled={!selected}>download discovery brief <span>↓</span></button>
          <small>Evidence is public. Generated coordinates, when present, are unvalidated RFdiffusion output with no sequence.</small>
        </div>
      </section>
    </div>
  );
}

function CandidateCaption({ candidate, dossier, score }: { candidate?: CandidateRecord; dossier?: CandidateDossier; score?: DiscoveryScore }) {
  if (!candidate) return null;
  const candidateSpecific = Boolean(dossier?.physics_eligibility?.qm_cluster_plan?.candidate_specific);
  return (
    <div className="atlas-candidate-caption">
      <div><span>selected public protein</span><strong>{candidate.uniprot?.primary_accession ?? candidate.title}</strong></div>
      <div><span>cofactor context</span><strong>{candidate.cofactors?.map((c) => c.name).join(" + ") || "not annotated"}</strong></div>
      <div><span>physics provenance</span><strong>{candidateSpecific ? "candidate-specific QM" : "route-level evidence"}</strong></div>
      <div><span>current ceiling</span><strong>{claimLabel(dossier?.claim_ceiling ?? candidate.claim_ceiling)}</strong></div>
      <div><span>lane</span><strong>{score?.lane ?? "unassigned"}</strong></div>
    </div>
  );
}

function EvidenceLedger({ candidate, dossier, score }: { candidate?: CandidateRecord; dossier?: CandidateDossier; score?: DiscoveryScore }) {
  if (!candidate) return null;
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

function Metric({ label, value = 0, inverse = false }: { label: string; value?: number; inverse?: boolean }) {
  const display = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="atlas-metric">
      <span>{label}</span><strong>{display}</strong>
      <i><b style={{ width: `${inverse ? 100 - display : display}%` }} /></i>
    </div>
  );
}

function CandidateConstellation({ candidates, scores, selectedId, onSelect }: {
  candidates: CandidateRecord[];
  scores: DiscoveryScore[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // honest scatter: x = mechanism support (P_plausibility), y = measurement value (information gain).
  // Positions are the real triage axes, not a decorative layout, so the axis labels are truthful.
  const scoreById = new Map(scores.map((s) => [s.candidate_id, s]));
  const visible = candidates.filter((c) => scoreById.has(c.candidate_id)).slice(0, 12);
  const pos = (c: CandidateRecord): [number, number] => {
    const s = scoreById.get(c.candidate_id);
    const x = 10 + (s?.P_plausibility ?? 0.35) * 80;       // left→right = mechanism support
    const y = 86 - (s?.IG_information_gain ?? 0.3) * 70;    // bottom→top = measurement value
    return [Math.round(x), Math.round(y)];
  };
  return (
    <div className="atlas-field" role="group" aria-label="candidate scatter: horizontal is mechanism support, vertical is measurement value">
      <div className="atlas-field-rings" aria-hidden><i /><i /><i /></div>
      <div className="atlas-field-core" aria-hidden><b /><span>nebula</span></div>
      <svg className="atlas-field-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {visible.map((candidate) => {
          const [x, y] = pos(candidate);
          return <line key={candidate.candidate_id} x1="50" y1="50" x2={x} y2={y} />;
        })}
      </svg>
      {visible.map((candidate) => {
        const [x, y] = pos(candidate);
        const candidateScore = scoreById.get(candidate.candidate_id);
        const active = candidate.candidate_id === selectedId;
        return (
          <button
            key={candidate.candidate_id}
            className={`atlas-field-node atlas-field-node-${candidateScore?.lane ?? "unassigned"} ${active ? "on" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, "--node-score": candidateScore?.P_plausibility ?? 0.35 } as CSSProperties}
            onClick={() => onSelect(candidate.candidate_id)}
            aria-pressed={active}
          >
            <span>{candidate.uniprot?.primary_accession ?? candidate.candidate_id.slice(0, 8)}</span>
            <small>{candidateScore?.lane ?? "candidate"}</small>
          </button>
        );
      })}
      <div className="atlas-field-axis atlas-field-axis-x" aria-hidden>mechanism support →</div>
      <div className="atlas-field-axis atlas-field-axis-y" aria-hidden>measurement value →</div>
    </div>
  );
}

function rankOf(candidateId: string, run: RunState): number {
  const evidence = run.evidence_shortlist?.indexOf(candidateId) ?? -1;
  if (evidence >= 0) return evidence;
  const frontier = run.frontier_experiments?.findIndex((f) => f.candidate_id === candidateId) ?? -1;
  return frontier >= 0 ? 100 + frontier : 1000;
}

function humanRoute(route: string): string {
  if (route === "RFP_flavin_photochemical") return "flavin photochemical light history";
  return route.replace(/_/g, " ").replace(/\bFAD\b/i, "FAD").replace(/\bLOV\b/i, "LOV");
}
