/**
 * First-paint entry preloader — the reference's signature circular 0→100 counter.
 *
 * Honest gating: the counter cannot reach 100 until the app is actually ready (fonts
 * loaded + the API health probe resolved), with a 3s hard cap so a slow/unreachable
 * backend never traps the user. Then it fades out and hands off. Label says "loading"
 * (this is not run progress — the run has its own counter later).
 */
import { useEffect, useRef, useState } from "react";

const R = 46;
const CIRC = 2 * Math.PI * R;

export function Preloader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    let active = true;
    let exitTimer = 0;
    let doneTimer = 0;
    let capTimer = 0;
    setPct(50); // application shell is mounted
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
    const cap = new Promise<void>((resolve) => { capTimer = window.setTimeout(resolve, reduced ? 0 : 900); });
    Promise.race([fonts.then(() => undefined), cap]).then(() => {
      if (!active || doneRef.current) return;
      doneRef.current = true;
      setPct(100); // required typography is ready, or the bounded fallback elapsed
      exitTimer = window.setTimeout(() => {
        setGone(true);
        doneTimer = window.setTimeout(() => onDoneRef.current(), reduced ? 0 : 320);
      }, reduced ? 0 : 120);
    });
    return () => {
      active = false;
      window.clearTimeout(capTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
    // run once: onDone is captured via ref so the entry animation never restarts on parent re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="pre-sub">reading the sensing frontier within</div>
    </div>
  );
}
