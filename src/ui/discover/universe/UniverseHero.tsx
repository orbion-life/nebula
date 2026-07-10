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

/** Project the run into universe nodes: lane, rank, score, candidate-specific flag. */
export function buildNodes(run: RunState): UNode[] {
  const evidence = run.evidence_shortlist ?? [];
  const frontier = run.frontier_experiments ?? [];
  const scoreById = new Map<string, DiscoveryScore>((run.discovery_scores ?? []).map((s) => [s.candidate_id, s]));
  const dossierById = new Map((run.dossiers ?? []).map((d) => [d.candidate.candidate_id, d]));
  const laneOf = (id: string): UNode["lane"] =>
    evidence.includes(id) ? "evidence" : frontier.some((f) => f.candidate_id === id) ? "frontier" : "excluded";
  const rankIn = (id: string, lane: UNode["lane"]): number =>
    lane === "evidence" ? evidence.indexOf(id) : lane === "frontier" ? frontier.findIndex((f) => f.candidate_id === id) : 0;
  return (run.candidates ?? []).map((c) => {
    const lane = laneOf(c.candidate_id);
    const s = scoreById.get(c.candidate_id);
    const score = lane === "frontier" ? s?.IG_information_gain ?? 0.3 : s?.P_plausibility ?? 0.3;
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
}

export function UniverseHero({ run, selectedId, onSelect }: Props) {
  const nodes = useMemo(() => buildNodes(run), [run]);
  const reduced = prefersReducedMotion();
  if (nodes.length === 0) return null;

  const fallback = <DomFallback nodes={nodes} selectedId={selectedId} onSelect={onSelect} />;
  return (
    <div className="universe" aria-label="candidate universe — proteins positioned by discovery lane and rank">
      <div className="universe-legend">
        <span className="ul-ev">● evidence</span>
        <span className="ul-fr">● frontier</span>
        <span className="ul-qm">◎ candidate-specific QM</span>
      </div>
      <WebGLBoundary fallback={fallback}>
        <Suspense fallback={<div className="universe-loading">assembling candidate universe…</div>}>
          <CandidateUniverse nodes={nodes} selectedId={selectedId} onSelect={onSelect} reducedMotion={reduced} />
        </Suspense>
      </WebGLBoundary>
    </div>
  );
}

/** Accessible, WebGL-free equivalent: the same nodes as a labelled, selectable list. */
function DomFallback({ nodes, selectedId, onSelect }: { nodes: UNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const lanes: UNode["lane"][] = ["evidence", "frontier", "excluded"];
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
