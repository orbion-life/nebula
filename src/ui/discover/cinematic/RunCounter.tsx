/**
 * The run counter — the reference's 0→100% ring, but bound to the REAL discovery
 * progress (RunEvent.progress). The backend emits a coarse 7-step fraction; we tween
 * the displayed value toward it every frame so the descent reads as buttery, never
 * faked. During retrieval the fraction plateaus, so the "N proteins retrieved" line
 * (driven by the real candidate count) carries the motion instead.
 */
import { useEffect, useRef, useState } from "react";

const R = 78;
const CIRC = 2 * Math.PI * R;

export function RunCounter({ fraction, stage, candidateCount }: { fraction: number; stage: string; candidateCount: number }) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const target = useRef(fraction);
  target.current = fraction;
  const [shown, setShown] = useState(fraction);

  useEffect(() => {
    if (reduced) {
      setShown(target.current);
      return;
    }
    let raf = 0;
    const tick = () => {
      setShown((s) => (Math.abs(target.current - s) < 0.002 ? target.current : s + (target.current - s) * 0.07));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const pct = Math.round(shown * 100);
  return (
    <div className="runcounter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`discovery pipeline ${pct} percent complete`}>
      <div className="rc-ring">
        <svg viewBox="0 0 180 180" aria-hidden>
          <circle cx="90" cy="90" r={R} className="rc-track" />
          <circle cx="90" cy="90" r={R} className="rc-fill" style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - shown) }} />
        </svg>
        <span className="rc-pct">{pct}<span className="rc-unit">%</span></span>
      </div>
      <div className="rc-stage">{stage.replace(/_/g, " ")}</div>
      {candidateCount > 0 && <div className="rc-cands">{candidateCount} real public proteins retrieved</div>}
    </div>
  );
}

/** Progress fraction 0–1 from a run's events (last numeric RunEvent.progress), with a
 * stage-index fallback so the counter always has a sane value. */
const STAGE_ORDER = [
  "queued", "compiling_objective", "retrieving_evidence", "assessing_physics",
  "simulating", "ranking", "planning", "completed",
];
export function progressOf(events: Array<{ progress?: number | null }>, stage: string): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const p = events[i]?.progress;
    if (typeof p === "number") return p;
  }
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx / (STAGE_ORDER.length - 1) : 0;
}
