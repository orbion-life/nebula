/**
 * First-paint entry preloader — the reference's signature circular 0→100 counter.
 *
 * Honest gating: the counter cannot reach 100 until the app is actually ready (fonts
 * loaded + the API health probe resolved), with a 3s hard cap so a slow/unreachable
 * backend never traps the user. Then it fades out and hands off. Label says "loading"
 * (this is not run progress — the run has its own counter later).
 */
import { useEffect, useRef, useState } from "react";
import { getHealth } from "../../api/client";

const R = 46;
const CIRC = 2 * Math.PI * R;

export function Preloader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let ready = false;
    let raf = 0;
    const start = performance.now();
    Promise.allSettled([
      (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve(),
      getHealth().catch(() => null),
    ]).then(() => {
      ready = true;
    });
    const cap = window.setTimeout(() => {
      ready = true;
    }, 3000);

    const tick = (t: number) => {
      const elapsed = t - start;
      const ceil = ready ? 100 : 92; // can't fake completion before readiness
      const value = Math.min(ceil, (elapsed / 1600) * 100);
      setPct(Math.round(value));
      if (ready && value >= 100 && !doneRef.current) {
        doneRef.current = true;
        window.setTimeout(() => {
          setGone(true);
          window.setTimeout(onDone, 520);
        }, 220);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cap);
    };
  }, [onDone]);

  return (
    <div className={`preloader ${gone ? "gone" : ""}`} role="status" aria-label={`loading ${pct}%`}>
      <div className="pre-ring">
        <svg viewBox="0 0 110 110" aria-hidden>
          <circle cx="55" cy="55" r={R} className="pre-track" />
          <circle
            cx="55"
            cy="55"
            r={R}
            className="pre-fill"
            style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - pct / 100) }}
          />
        </svg>
        <span className="pre-pct">{pct}%</span>
      </div>
      <div className="pre-word">NEBULA DISCOVER</div>
      <div className="pre-sub">entering the quantum within</div>
    </div>
  );
}
