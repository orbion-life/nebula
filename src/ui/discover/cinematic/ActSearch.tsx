/**
 * Act II — The Search. The run executes; this scene advances ITSELF from real run
 * state (not scroll). The candidate universe fills as real accessions stream in, the
 * ring counter tweens toward the real progress fraction, and on completion the shell
 * delivers the user into Act III. Failure/cancel/abstention resolve honestly here.
 */
import { RunCounter, progressOf } from "./RunCounter";
import { UniverseHero } from "../universe/UniverseHero";
import { ScanningNature } from "./ScanningNature";
import { ActAbstention } from "./ActAbstention";
import type { RunEvent, RunState } from "../../../api/client";

interface Props {
  status: string;
  stage: string;
  events: RunEvent[];
  run: RunState | null;
  error: string | null;
  onCancel: () => void;
  onReset: () => void;
}

export function ActSearch({ status, stage, events, run, error, onCancel, onReset }: Props) {
  const progress = progressOf(events, stage);
  const cands = new Set((run?.candidates ?? []).map((candidate) => candidate.uniprot?.primary_accession ?? candidate.candidate_id)).size;
  const terminalBad = status === "failed" || status === "cancelled";
  const note = events[events.length - 1]?.note ?? "compiling objective…";

  // a 422 for an unsupported sensing target is an abstention, not a crash — hand it the elegant scene.
  const unsupported = status === "failed" && /cannot search|supported sensing target/i.test(error ?? "");
  if (unsupported) return <ActAbstention kind="unsupported" run={run} error={error} onReset={onReset} />;

  return (
    <section className="act act-search">
      {run && cands > 0 && (
        <div className="act-search-bg" aria-hidden>
          <UniverseHero run={run} settled={status === "completed"} selectedId={null} onSelect={() => {}} fieldProgress={progress} interactive={false} />
        </div>
      )}
      <div className="act-inner act-search-inner">
        <div className="act-kicker"><span className="act-n">02</span>searching the protein universe</div>
        <RunCounter fraction={progress} stage={stage} candidateCount={cands} />
        <p className="act-search-note" aria-live="polite">{note}</p>
        {!terminalBad && <ScanningNature stage={stage} run={run} />}
        {!terminalBad && status !== "completed" && (
          <button className="btn-ghost act-cancel" onClick={onCancel}>cancel run</button>
        )}
        {terminalBad && (
          <div className="act-terminal">
            run {status}{error ? `: ${error}` : ""}. <button className="btn-ghost" onClick={onReset}>← new objective</button>
          </div>
        )}
      </div>
    </section>
  );
}
