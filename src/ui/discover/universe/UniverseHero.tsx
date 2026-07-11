/**
 * Public wrapper for the candidate universe. Lazy-loads the heavy R3F/three bundle
 * (kept out of the initial app chunk), degrades to an accessible DOM node list if
 * WebGL is unavailable or the scene throws, and respects prefers-reduced-motion.
 */
import { Component, Suspense, lazy, useMemo, type ReactNode } from "react";
import type { DiscoveryScore, RunState } from "../../../api/client";
import type { UNode } from "./CandidateUniverse";

const CandidateUniverse = lazy(() => import("./CandidateUniverse"));

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Project the run into universe nodes: lane, rank, score, candidate-specific flag.
 * Until the run has ranked (settled), every retrieved candidate is `pending` — a loose
 * cloud — so the run phase reads as "searching the universe" before the lanes resolve. */
export function buildNodes(run: RunState, settled: boolean): UNode[] {
  const evidence = run.evidence_shortlist ?? [];
  const frontier = run.frontier_experiments ?? [];
  const scoreById = new Map<string, DiscoveryScore>((run.discovery_scores ?? []).map((s) => [s.candidate_id, s]));
  const dossierById = new Map((run.dossiers ?? []).map((d) => [d.candidate.candidate_id, d]));
  const laneOf = (id: string): UNode["lane"] =>
    !settled ? "pending" : evidence.includes(id) ? "evidence" : frontier.some((f) => f.candidate_id === id) ? "frontier" : "excluded";
  const rankIn = (id: string, lane: UNode["lane"]): number =>
    lane === "evidence" ? evidence.indexOf(id) : lane === "frontier" ? frontier.findIndex((f) => f.candidate_id === id) : 0;
  return (run.candidates ?? []).map((c) => {
    const lane = laneOf(c.candidate_id);
    const s = scoreById.get(c.candidate_id);
    const score = lane === "frontier" ? s?.IG_information_gain ?? 0.3 : s?.P_plausibility ?? 0.35;
    return {
      id: c.candidate_id,
      accession: c.uniprot?.primary_accession ?? c.candidate_id.slice(0, 8),
      lane,
      rank: Math.max(0, rankIn(c.candidate_id, lane)),
      score: Math.max(0, Math.min(1, score)),
      candidateSpecific: Boolean(dossierById.get(c.candidate_id)?.physics_eligibility?.qm_cluster_plan?.candidate_specific),
    };
  });
}

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface Props {
  run: RunState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  settled?: boolean; // default true (workspace); pass false during a live run
  fieldProgress?: number; // quantum-field intensity (real run fraction in Act II)
}

function isSmallViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 700px)").matches === true;
}

export function UniverseHero({ run, selectedId, onSelect, settled = true, fieldProgress = 0.45 }: Props) {
  const nodes = useMemo(() => buildNodes(run, settled), [run, settled]);
  const reduced = prefersReducedMotion();
  const effects = !reduced && !isSmallViewport(); // bloom off for reduced-motion/mobile (+ software-GL, gated in Effects)
  if (nodes.length === 0) return null;

  const fallback = <DomFallback nodes={nodes} selectedId={selectedId} onSelect={onSelect} />;
  return (
    <div className="universe" aria-label="candidate universe — proteins positioned by discovery lane and rank">
      <div className="universe-legend">
        {settled ? (
          <>
            <span className="ul-ev">● evidence</span>
            <span className="ul-fr">● frontier</span>
            <span className="ul-qm">◎ candidate-specific QM</span>
          </>
        ) : (
          <span className="ul-searching">searching the protein universe — {nodes.length} retrieved</span>
        )}
      </div>
      <WebGLBoundary fallback={fallback}>
        <Suspense fallback={<div className="universe-loading">assembling candidate universe…</div>}>
          <CandidateUniverse nodes={nodes} selectedId={selectedId} onSelect={onSelect} reducedMotion={reduced} fieldProgress={fieldProgress} effects={effects} />
        </Suspense>
      </WebGLBoundary>
    </div>
  );
}

/** Accessible, WebGL-free equivalent: the same nodes as a labelled, selectable list. */
function DomFallback({ nodes, selectedId, onSelect }: { nodes: UNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const lanes: UNode["lane"][] = ["pending", "evidence", "frontier", "excluded"];
  return (
    <div className="universe-dom" role="list">
      {lanes.map((lane) => {
        const items = nodes.filter((n) => n.lane === lane).sort((a, b) => a.rank - b.rank);
        if (!items.length) return null;
        return (
          <div key={lane} className={`udom-lane udom-${lane}`}>
            <span className="udom-lane-title">{lane}</span>
            {items.map((n) => (
              <button key={n.id} role="listitem" className={`udom-node ${n.id === selectedId ? "on" : ""}`} onClick={() => onSelect(n.id)}>
                {n.accession}{n.candidateSpecific ? " ◎" : ""}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
