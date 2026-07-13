/**
 * Nebula Discover, the backend-connected discovery experience.
 *
 * State machine: objective → running → workspace. A run is started explicitly
 * (never on keystroke), streamed via SSE with a polling fallback, cancellable, and
 * its immutable result is shown in the workspace. Public records, deterministic
 * heuristics, computed cluster values, and synthetic references stay differentiated.
 */
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { SmoothScroll } from "./scroll/SmoothScroll";
import { Preloader } from "./Preloader";
import { AmbientAudio } from "./audio/AmbientAudio";
import { CinematicShell } from "./cinematic/CinematicShell";
import { canUseWebGL } from "./render/webgl";

const WorldCanvas = lazy(() => import("./world/WorldCanvas").then((module) => ({ default: module.WorldCanvas })));

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="world-fallback" aria-hidden /> : this.props.children; }
}

class ExperienceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="experience-error" role="alert">
        <h1>The discovery view could not render.</h1>
        <p>Your objective was not changed. Reload the local application to recover the view.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>reload view</button>
      </section>
    );
  }
}

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
  const [booted, setBooted] = useState(false); // dismissed once the entry preloader completes
  const cleanupRef = useRef<(() => void) | null>(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    return () => cleanupRef.current?.();
  }, []);

  const start = useCallback(async (spec: ObjectiveSpec) => {
    const generation = ++requestGeneration.current;
    const startedAt = performance.now();
    cleanupRef.current?.();
    cleanupRef.current = null;
    setError(null);
    setEvents([]);
    setRun(null);
    setStatus("queued");
    setStage("queued");
    setPhase("running");
    try {
      const created = await createRun(spec);
      if (generation !== requestGeneration.current) return;
      setRunId(created.run_id);
      setStatus(created.status);
      // if idempotent-cached and already complete, jump straight to the result
      const first = await getRun(created.run_id);
      if (generation !== requestGeneration.current) return;
      applyState(first);
      if (["completed", "failed", "cancelled"].includes(first.status)) {
        if (first.status === "completed") {
          const isFreshRun = created.status === "queued";
          const wait = isFreshRun ? Math.max(0, 1500 - (performance.now() - startedAt)) : 0;
          window.setTimeout(() => {
            if (generation === requestGeneration.current) setPhase("workspace");
          }, wait);
        }
        return;
      }
      cleanupRef.current = streamRun(created.run_id, {
        onEvent: (e) => {
          if (generation !== requestGeneration.current) return;
          setEvents((prev) => [...prev, e]);
          if (e.to_status) setStatus(e.to_status);
          if (e.stage) setStage(e.stage);
        },
        onState: (s) => generation === requestGeneration.current && applyState(s),
        onDone: (s) => {
          if (generation !== requestGeneration.current) return;
          applyState(s);
          if (s.status === "completed") {
            // minimum dwell so the Act II search beat is visible even when a run finishes fast
            const wait = Math.max(0, 1500 - (performance.now() - startedAt));
            window.setTimeout(() => { if (generation === requestGeneration.current) setPhase("workspace"); }, wait);
          }
        },
        onError: (err) => generation === requestGeneration.current && setError(err.message),
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
    requestGeneration.current += 1;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPhase("objective");
    setRun(null);
    setRunId(null);
    setEvents([]);
    setError(null);
  }, []);

  return (
    <SmoothScroll>
      {!booted && <Preloader onDone={() => setBooted(true)} />}
      <div className="discover">
      <a className="skip-link" href="#main-content">skip to discovery workspace</a>
      {booted && canUseWebGL() ? (
        <VisualBoundary>
          <Suspense fallback={<div className="world-fallback" aria-hidden />}>
            <WorldCanvas />
          </Suspense>
        </VisualBoundary>
      ) : <div className="world-fallback" aria-hidden />}
      <div className="disc-content">
      <header className="disc-top">
        <button className="disc-home" onClick={reset} aria-label="nebula discovery, back to objective">
          <span className="disc-nebula-star" aria-hidden />
          <span className="disc-nebula">nebula</span>
          <span className="disc-tag">discovery</span>
        </button>
        <div className="disc-health">
          {phase === "workspace" && (
            <button className="disc-reset" onClick={reset}>
              <span className="disc-reset-icon" aria-hidden>↺</span>new objective
            </button>
          )}
          <AmbientAudio />
          {/* No live/offline chrome in the header, provenance is surfaced where it matters (the scan
              and the brief). Only a genuinely UNREACHABLE API earns a quiet warning here: a "degraded"
              status (e.g. one public source like FPbase down) is not offline, the app runs on the
              rest, and per-source state is shown in the scan, so it must not raise this alarm. */}
          {!health && (
            <span className="disc-status" role="status" title="Discovery API unreachable, check the backend service">
              <span className="disc-status-dot" aria-hidden />API offline
            </span>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
      <ExperienceBoundary>
      <CinematicShell
        phase={phase}
        status={status}
        stage={stage}
        events={events}
        run={run}
        error={error}
        offline={health?.offline ?? false}
        onRun={start}
        onCancel={cancel}
        onReset={reset}
      />
      </ExperienceBoundary>
      </main>

      <footer className="disc-foot">
        A candidate is a discovery to prove at the bench, not a proven sensor.
      </footer>
      </div>
      </div>
    </SmoothScroll>
  );
}
