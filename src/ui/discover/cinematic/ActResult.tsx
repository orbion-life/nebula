/**
 * Act III — The Result. The completed run IS the scroll experience: the seven-chapter
 * scroll-scrubbed narrative (lazy-loaded so its GSAP/ScrollTrigger code stays out of the
 * initial bundle). This is the default landing after a run; the calm workspace is one
 * tap away via onEnterWorkspace.
 */
import { Suspense, lazy } from "react";
import type { RunState } from "../../../api/client";

const NarrativeReplay = lazy(() => import("../narrative/NarrativeReplay").then((m) => ({ default: m.NarrativeReplay })));

export function ActResult({ run, onEnterWorkspace }: { run: RunState; onEnterWorkspace: () => void }) {
  return (
    <section className="act act-result">
      <Suspense fallback={<div className="disc-loading">loading the discovery story…</div>}>
        <NarrativeReplay run={run} onEnterWorkspace={onEnterWorkspace} />
      </Suspense>
    </section>
  );
}
