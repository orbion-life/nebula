/**
 * Streamed run progress — the "search the protein universe" chapter.
 *
 * Renders the real SSE event stream from the discovery service as a stage tracker
 * with a live narration line and a spatial candidate field that fills in as real
 * accessions arrive. Simulation happens BEFORE ranking (the stage order is fixed by
 * the server state machine). Cancellable at any point. Reduced-motion safe: the
 * field still fills, just without the entrance transition.
 */
import type { RunEvent, RunState } from "../../api/client";

const STAGES: Array<{ key: string; label: string }> = [
  { key: "compiling_objective", label: "compile objective" },
  { key: "retrieving_evidence", label: "search protein universe" },
  { key: "assessing_physics", label: "physics eligibility + candidate QM" },
  { key: "simulating", label: "simulate under instrument" },
  { key: "ranking", label: "rank · evidence vs frontier" },
  { key: "planning", label: "decisive next experiment" },
  { key: "completed", label: "done" },
];

interface Props {
  status: string;
  stage: string;
  events: RunEvent[];
  run: RunState | null;
  onCancel: () => void;
}

export function RunProgress({ status, stage, events, run, onCancel }: Props) {
  const reached = new Set<string>(events.map((e) => e.to_status ?? ""));
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const note = events[events.length - 1]?.note ?? "starting…";
  const candidates = run?.candidates ?? [];
  const failed = status === "failed";
  const cancelled = status === "cancelled";

  return (
    <div className="runp" role="region" aria-label="discovery run progress" aria-live="polite">
      <div className="runp-head">
        <div>
          <div className="runp-status">{status.replace(/_/g, " ")}</div>
          <div className="runp-note">{note}</div>
        </div>
        {status !== "completed" && !failed && !cancelled && (
          <button className="btn-ghost" onClick={onCancel}>cancel run</button>
        )}
      </div>

      <ol className="runp-stages">
        {STAGES.map((s, i) => {
          const done = reached.has(s.key) && i < currentIdx;
          const active = s.key === stage || (status === "completed" && s.key === "completed");
          return (
            <li key={s.key} className={`runp-stage ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <span className="runp-dot" aria-hidden />
              <span className="runp-lab">{s.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="runp-field" aria-label={`${candidates.length} candidate proteins retrieved`}>
        {candidates.map((c, i) => (
          <span
            key={c.candidate_id}
            className="runp-node"
            style={{ animationDelay: `${Math.min(i * 40, 600)}ms` }}
            title={`${c.uniprot?.primary_accession ?? c.candidate_id} · ${c.route_class}`}
          >
            {c.uniprot?.primary_accession ?? "•"}
          </span>
        ))}
        {candidates.length === 0 && <span className="runp-empty">retrieving real public proteins…</span>}
      </div>

      {failed && <div className="runp-error">run failed — {run?.errors?.[0] ?? "unknown error"}</div>}
      {cancelled && <div className="runp-error">run cancelled.</div>}
    </div>
  );
}
