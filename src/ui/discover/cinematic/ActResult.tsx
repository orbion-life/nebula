/**
 * Act III — The Result. The completed run IS the scroll experience: the seven chapter
 * scroll scrubbed narrative (lazy loaded so its GSAP/ScrollTrigger code stays out of the
 * initial bundle). This is the single result view. There is no separate workspace window;
 * the expert handoff downloads straight from the final chapter.
 */
import { Suspense, lazy } from "react";
import type { RunState } from "../../../api/client";

const NarrativeReplay = lazy(() => import("../narrative/NarrativeReplay").then((m) => ({ default: m.NarrativeReplay })));

export function ActResult({ run }: { run: RunState }) {
  return (
    <section className="act act-result">
      <Suspense fallback={<div className="disc-loading">loading the discovery story…</div>}>
        <NarrativeReplay run={run} />
      </Suspense>
    </section>
  );
}
