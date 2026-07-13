/**
 * The transparent scan (brief Ask E): while Act II runs, show WHICH public databases are
 * being searched, in the fixed provider order, and reconcile each against the run's REAL
 * provenance (endpoint, retrieval mode, source release, HTTP status, licence). No invented
 * state, a database only reads "returned" once run.provider_calls records a real call for it;
 * otherwise it is queued or scanning off the live stage. Retrieval-only, never validation.
 */
import type { RunState } from "../../../api/client";

const PROVIDERS = [
  { id: "uniprot", name: "UniProt", role: "sequences · annotation" },
  { id: "interpro", name: "InterPro", role: "domains · families" },
  { id: "rcsb", name: "RCSB PDB", role: "experimental structures" },
  { id: "alphafold", name: "AlphaFold DB", role: "predicted structures" },
  { id: "fpbase", name: "FPbase", role: "fluorescent proteins" },
] as const;

// the run's coarse stage order; retrieval is where provider I/O happens.
const STAGES = ["queued", "compiling_objective", "retrieving_evidence", "assessing_physics", "simulating", "ranking", "planning", "completed"];

type CallState = "queued" | "scanning" | "returned" | "unavailable" | "skipped";

function shortHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    // fixture paths and non-URLs fall back to a trimmed tail
    return url.replace(/^.*[/](?=[^/]+[/]?$)/, "").slice(0, 28) || url.slice(0, 28);
  }
}

export function ScanningNature({ stage, run }: { stage: string; run: RunState | null }) {
  const stageIdx = Math.max(0, STAGES.indexOf(stage));
  const retrievalIdx = STAGES.indexOf("retrieving_evidence");
  const reached = stageIdx >= retrievalIdx;
  const passed = stageIdx > retrievalIdx || stage === "completed";
  const byProvider = new Map((run?.provider_calls ?? []).map((c) => [c.provider, c]));

  return (
    <div className="scan-dbs" role="group" aria-label="public databases being searched">
      <div className="scan-dbs-head">
        <span>searching the public record</span>
        <small>retrieval only · not validation</small>
      </div>
      <ul className="scan-db-list">
        {PROVIDERS.map((p) => {
          const call = byProvider.get(p.id);
          let state: CallState;
          if (call) state = call.mode === "unavailable" || (call.http_status ?? 200) >= 400 ? "unavailable" : "returned";
          else if (passed) state = "skipped";
          else if (reached) state = "scanning";
          else state = "queued";
          return (
            <li key={p.id} className={`scan-db scan-db-${state}`}>
              <span className="scan-db-dot" aria-hidden />
              <span className="scan-db-name">{p.name}</span>
              <span className="scan-db-role">{p.role}</span>
              <span className="scan-db-state">
                {state === "returned" && call ? (
                  <>
                    <b>{call.mode}</b>
                    {call.source_release ? <i>release {call.source_release}</i> : null}
                    {typeof call.http_status === "number" ? <i>HTTP {call.http_status}</i> : null}
                    <code>{shortHost(call.endpoint_url)}</code>
                  </>
                ) : state === "unavailable" ? (
                  <b className="scan-db-warn">no response</b>
                ) : state === "scanning" ? (
                  <b className="scan-db-live">querying…</b>
                ) : state === "skipped" ? (
                  <i>not queried</i>
                ) : (
                  <i>queued</i>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
