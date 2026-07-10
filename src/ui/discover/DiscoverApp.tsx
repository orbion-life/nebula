/**
 * Nebula Discover — the backend-connected discovery experience.
 *
 * State machine: objective → running → workspace. A run is started explicitly
 * (never on keystroke), streamed via SSE with a polling fallback, cancellable, and
 * its immutable result is shown in the workspace. All data is real: the objective is
 * compiled server-side, candidates are real public accessions, physics is computed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelRun,
  createRun,
  getHealth,
  getRun,
  streamRun,
  type Health,
  type ObjectiveSpec,
  type RunEvent,
  type RunState,
} from "../../api/client";
import { ObjectivePanel } from "./ObjectivePanel";
import { RunProgress } from "./RunProgress";
import { Workspace } from "./Workspace";

type Phase = "objective" | "running" | "workspace";

export function DiscoverApp() {
  const [phase, setPhase] = useState<Phase>("objective");
  const [health, setHealth] = useState<Health | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("queued");
  const [stage, setStage] = useState("queued");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    return () => cleanupRef.current?.();
  }, []);

  const start = useCallback(async (spec: ObjectiveSpec) => {
    setError(null);
    setEvents([]);
    setRun(null);
    setStatus("queued");
    setStage("queued");
    setPhase("running");
    try {
      const created = await createRun(spec);
      setRunId(created.run_id);
      setStatus(created.status);
      // if idempotent-cached and already complete, jump straight to the result
      const first = await getRun(created.run_id);
      applyState(first);
      if (["completed", "failed", "cancelled"].includes(first.status)) {
        if (first.status === "completed") setPhase("workspace");
        return;
      }
      cleanupRef.current?.();
      cleanupRef.current = streamRun(created.run_id, {
        onEvent: (e) => {
          setEvents((prev) => [...prev, e]);
          if (e.to_status) setStatus(e.to_status);
          if (e.stage) setStage(e.stage);
        },
        onState: applyState,
        onDone: (s) => {
          applyState(s);
          if (s.status === "completed") setTimeout(() => setPhase("workspace"), 350);
        },
        onError: (err) => setError(err.message),
      });
    } catch (err) {
      setError((err as Error).message);
      setStatus("failed");
    }
    function applyState(s: RunState) {
      setRun(s);
      setStatus(s.status);
      setStage(s.current_stage);
      if (s.events?.length) setEvents(s.events);
    }
  }, []);

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      const s = await cancelRun(runId);
      setStatus(s.status);
      setRun(s);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [runId]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPhase("objective");
    setRun(null);
    setRunId(null);
    setEvents([]);
    setError(null);
  }, []);

  return (
    <div className="discover">
      <header className="disc-top">
        <div className="disc-brand">
          <span className="disc-mark" aria-hidden>◊</span>
          <span className="disc-name">Nebula Discover</span>
          <span className="disc-tag">public-protein counterfactual discovery</span>
        </div>
        <div className="disc-health">
          {health ? (
            <span className={`hz ${health.offline ? "offline" : "live"}`}>
              {health.offline ? "offline · fixtures" : "live · public APIs"}
            </span>
          ) : (
            <span className="hz down">API unreachable</span>
          )}
        </div>
      </header>

      {phase === "objective" && (
        <div className="disc-stage disc-objective">
          <ObjectivePanel onRun={start} />
        </div>
      )}

      {phase === "running" && (
        <div className="disc-stage disc-running">
          <RunProgress status={status} stage={stage} events={events} run={run} onCancel={cancel} />
          {status === "completed" && run && (
            <button className="btn-run" onClick={() => setPhase("workspace")}>open results →</button>
          )}
          {error && <div className="disc-error">error: {error} <button className="btn-ghost" onClick={reset}>reset</button></div>}
        </div>
      )}

      {phase === "workspace" && run && (
        <div className="disc-stage disc-workspace">
          <Workspace run={run} onReset={reset} />
        </div>
      )}

      <footer className="disc-foot">
        Outputs are <strong>unvalidated public-protein candidate hypotheses</strong>. Computation is not validation; no
        working sensor is claimed. Physics traces are synthetic assumption sweeps unless marked candidate-specific.
      </footer>
    </div>
  );
}
