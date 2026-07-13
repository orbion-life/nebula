/**
 * Post-bench discovery experience.
 *
 * A completed run opens two visible paths: public proteins found in nature and
 * de novo backbones generated for the mission. The interface stays decision-led:
 * select a candidate, inspect its evidence, compare the generated frontier, then
 * leave with one falsifiable measurement handoff.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { getStructure, type CandidateDossier, type CandidateRecord, type DiscoveryScore, type RunState, type StructureResponse } from "../../../api/client";
import { GeneratedBackboneViewer } from "../GeneratedBackboneViewer";
import { StructureViewer } from "../StructureViewer";
import { UniverseHero } from "../universe/UniverseHero";
import { claimLabel, dossierBriefHtml, dossierMarkdown } from "../dossierExport";
import { ObjectiveSplit } from "./AppliedConstraints";
import { CandidateDossierPanel } from "./CandidateDossierPanel";
import { GENERATE_PRECEDENT } from "./FieldPrecedent";

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

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // move focus to the section heading so keyboard + screen-reader users land where they jumped
    const heading = el.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  };

  // Markdown fallback (used only if the print window is blocked or the brief fails to build).
  const downloadMarkdown = () => {
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

  // Branded PDF: render the self-contained Nebula Discovery brief into a window and hand it to
  // the browser's own print → "Save as PDF" (vector-crisp, exact brand fonts, no dependency).
  const downloadHandoff = () => {
    if (!selected) return;
    let html: string;
    try {
      html = dossierBriefHtml(selected, dossier, run, {
        score,
        frontier,
        design,
        generatedAt: new Date().toISOString().slice(0, 10),
      });
    } catch {
      downloadMarkdown();
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      downloadMarkdown(); // popup blocked → deliver the Markdown brief instead
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onafterprint = () => { try { w.close(); } catch { /* already closed */ } };
    window.setTimeout(() => {
      try {
        const ready = w.document.fonts?.ready ?? Promise.resolve();
        ready.then(() => { w.focus(); w.print(); }, () => { w.focus(); w.print(); });
      } catch { /* window closed by the user */ }
    }, 500);
  };

  return (
    <div className="atlas" ref={scope}>
      <div className="atlas-progress" aria-hidden><div className="atlas-progress-fill" /></div>
      <nav className="atlas-nav" aria-label="discovery result sections">
        <button onClick={() => jumpTo("atlas-outcome")}>outcome</button>
        <button onClick={() => jumpTo("atlas-nature")}>discover</button>
        <button onClick={() => jumpTo("atlas-dossier")}>rationale</button>
        <button onClick={() => jumpTo("atlas-generate")}>generate</button>
      </nav>

      <section className="atlas-scene atlas-hero" id="atlas-outcome">
        <div className="atlas-reveal atlas-hero-grid">
          <div className="atlas-hero-copy">
          <span className="atlas-eyebrow">mission resolved</span>
          <h1>The search opened<br /><em>two paths.</em></h1>
          <p>{run.objective.sensed_quantity_or_state?.replace(/-/g, " ") ?? "Your sensing objective"}, translated into candidates that exist and structures that could.</p>
          <div className="atlas-paths">
            <button className="atlas-path atlas-path-natural" onClick={() => jumpTo("atlas-nature")}>
              <svg className="atlas-path-glyph" viewBox="0 0 44 44" aria-hidden>
                <line x1="8" y1="30" x2="22" y2="11" /><line x1="22" y1="11" x2="36" y2="27" /><line x1="22" y1="11" x2="17" y2="35" />
                <circle cx="8" cy="30" r="2.3" /><circle cx="22" cy="11" r="3" /><circle cx="36" cy="27" r="2.3" /><circle cx="17" cy="35" r="1.9" />
              </svg>
              <strong className="atlas-path-count">{uniqueAccessions}</strong>
              <span className="atlas-path-text">
                <b>found in nature</b>
                <small>public protein{uniqueAccessions === 1 ? "" : "s"} inspected</small>
              </span>
              <span className="atlas-path-arrow" aria-hidden>→</span>
            </button>
            <button className="atlas-path atlas-path-generated" onClick={() => jumpTo("atlas-generate")}>
              <svg className="atlas-path-glyph" viewBox="0 0 44 44" aria-hidden>
                <ellipse cx="22" cy="22" rx="16" ry="6.5" transform="rotate(32 22 22)" /><ellipse cx="22" cy="22" rx="16" ry="6.5" transform="rotate(-32 22 22)" />
                <circle cx="22" cy="22" r="3" />
              </svg>
              <strong className="atlas-path-count">{realBackbones || designs.length}</strong>
              <span className="atlas-path-text">
                <b>generated beyond nature</b>
                <small>{realBackbones ? "RFdiffusion backbones" : "de novo design briefs"}</small>
              </span>
              <span className="atlas-path-arrow" aria-hidden>→</span>
            </button>
          </div>
          <p className="atlas-honesty">Nothing here is a proven sensor. Everything here is a clearer next experiment.</p>
          </div>
          <div className="atlas-hero-universe">
            <UniverseHero run={run} settled selectedId={selected?.candidate_id ?? null} onSelect={(id) => { setSelectedId(id); jumpTo("atlas-dossier"); }} interactive />
            <span className="atlas-hero-hint" aria-hidden>select a star to open its case ↓</span>
          </div>
        </div>
      </section>

      <section className="atlas-scene atlas-nature" id="atlas-nature">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">01 · discover</span><h2>What nature already built.</h2></div>
            <p>Public proteins filtered by mechanism support, measurement fit, and developability context. Select one to open its full rationale.</p>
          </header>
          <ObjectiveSplit run={run} />
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

      <section className="atlas-scene atlas-dossier" id="atlas-dossier">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">02 · rationale</span><h2>{selected ? `The case for ${selected.uniprot?.primary_accession ?? selected.title.split(" — ")[0]}.` : "The case for the candidate."}</h2></div>
            <p>Everything specific to this protein in one place: why it ranked, its own physics, the public evidence, the constraints, and the one measurement that could prove it wrong.</p>
          </header>
          <CandidateDossierPanel candidate={selected} dossier={dossier} score={score} frontier={frontier} run={run} />
        </div>
      </section>

      <section className="atlas-scene atlas-generate" id="atlas-generate">
        <div className="atlas-reveal">
          <header className="atlas-section-head">
            <div><span className="atlas-eyebrow">03 · generate</span><h2>Then search beyond nature.</h2></div>
            <p>RFdiffusion proposes new backbone geometry for the same sensing mission, each linked to a shortlisted protein's cofactor motif. Coordinates are a starting point, not a finished construct.</p>
          </header>
          <div className="atlas-generator">
            <div className="atlas-design-list" role="list" aria-label="generated design directions">
              {designs.map((item, index) => {
                const active = index === designIndex;
                return (
                  <button key={`${item.label}-${index}`} className={`atlas-design ${active ? "on" : ""}`} onClick={() => setDesignIndex(index)} aria-pressed={active}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.label}</strong>
                    <small>{item.invented_from_accession ? `→ ${item.invented_from_accession}` : item.backbone_pdb ? `${item.n_residues ?? "de novo"} residue backbone` : "generation brief"}</small>
                  </button>
                );
              })}
            </div>
            <div className="atlas-design-stage">
              <GeneratedBackboneViewer pdb={design?.backbone_pdb ?? null} label={design?.label ?? "generation frontier"} residues={design?.n_residues} />
              <div className="atlas-design-meta">
                <span>{design?.generator ?? "generation unavailable"}</span>
                <strong>{design?.invented_from_accession ? `targeting ${design.invented_from_accession}` : design?.invented_for ?? run.objective.sensed_quantity_or_state ?? "the mission"}</strong>
                {design?.motif_note ? <small className="atlas-design-motif">{design.motif_note}</small> : null}
                {design?.design_rationale ? <p className="atlas-design-rationale">{design.design_rationale}</p> : null}
                <small>{design?.backbone_pdb ? "Backbone coordinates produced. Sequence design and validation remain downstream." : "The adapter returned a design direction without coordinates in this run."}</small>
              </div>
            </div>
          </div>
          <aside className="atlas-gen-precedent" aria-label="generation frontier precedent">
            <span className="atlas-eyebrow">frontier engine · precedent</span>
            <strong>{GENERATE_PRECEDENT.title}</strong>
            <p>{GENERATE_PRECEDENT.shows}</p>
            <a href={`https://doi.org/${GENERATE_PRECEDENT.doi}`} target="_blank" rel="noopener noreferrer">{GENERATE_PRECEDENT.venue} {GENERATE_PRECEDENT.year} · doi:{GENERATE_PRECEDENT.doi}</a>
          </aside>
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
