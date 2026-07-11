/**
 * Nebula Discover — the backend-connected discovery experience.
 *
 * State machine: objective → running → workspace. A run is started explicitly
 * (never on keystroke), streamed via SSE with a polling fallback, cancellable, and
 * its immutable result is shown in the workspace. All data is real: the objective is
 * compiled server-side, candidates are real public accessions, physics is computed.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
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
import { UniverseHero } from "./universe/UniverseHero";
import { SmoothScroll } from "./scroll/SmoothScroll";
import { Preloader } from "./Preloader";
import { AmbientAudio } from "./audio/AmbientAudio";

// opt-in cinematic replay — lazy so its gsap/ScrollTrigger code stays out of the initial bundle
const NarrativeReplay = lazy(() => import("./narrative/NarrativeReplay").then((m) => ({ default: m.NarrativeReplay })));

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
  const [cinematic, setCinematic] = useState(false); // scroll-narrative replay of the workspace run
  const [booted, setBooted] = useState(false); // dismissed once the entry preloader completes
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    return () => cleanupRef.current?.();
  }, []);

  // During a live run, poll the FULL run state so the universe fills in as real
  // accessions arrive (SSE only carries stage events, not the growing candidate list).
  useEffect(() => {
    if (phase !== "running" || !runId) return;
    if (["completed", "failed", "cancelled"].includes(status)) return;
    const id = window.setInterval(() => {
      getRun(runId).then(setRun).catch(() => {});
    }, 700);
    return () => window.clearInterval(id);
  }, [phase, runId, status]);

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
    setCinematic(false);
  }, []);

  return (
    <SmoothScroll>
      {!booted && <Preloader onDone={() => setBooted(true)} />}
      <div className="discover">
      <header className="disc-top">
        <div className="disc-brand">
          <span className="disc-mark" aria-hidden>◊</span>
          <span className="disc-name">Nebula Discover</span>
          <span className="disc-tag">public-protein counterfactual discovery</span>
        </div>
        <div className="disc-health">
          <AmbientAudio />
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
          <ObjectivePanel onRun={start} offline={health?.offline ?? false} />
        </div>
      )}

      {phase === "running" && (
        <div className="disc-stage disc-running">
          {run && (run.candidates?.length ?? 0) > 0 && (
            <UniverseHero run={run} settled={status === "completed"} selectedId={null} onSelect={() => {}} />
          )}
          <RunProgress status={status} stage={stage} events={events} run={run} onCancel={cancel} />
          {status === "completed" && run && (
            <button className="btn-run" onClick={() => setPhase("workspace")}>open results →</button>
          )}
          {(status === "failed" || status === "cancelled") && (
            <div className="disc-error">
              run {status}. <button className="btn-ghost" onClick={reset}>← new objective</button>
            </div>
          )}
          {error && <div className="disc-error">error: {error} <button className="btn-ghost" onClick={reset}>reset</button></div>}
        </div>
      )}

      {phase === "workspace" && run && (
        <div className="disc-stage disc-workspace">
          {cinematic ? (
            <Suspense fallback={<div className="disc-loading">loading discovery story…</div>}>
              <NarrativeReplay run={run} onEnterWorkspace={() => setCinematic(false)} />
            </Suspense>
          ) : (
            <Workspace run={run} onReset={reset} onPlayStory={() => setCinematic(true)} />
          )}
        </div>
      )}

      <footer className="disc-foot">
        Outputs are <strong>unvalidated public-protein candidate hypotheses</strong>. Computation is not validation; no
        working sensor is claimed. Physics traces are synthetic assumption sweeps unless marked candidate-specific.
      </footer>
      </div>
    </SmoothScroll>
  );
}
