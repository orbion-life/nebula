/**
 * Act I — Objective. A cinematic, guided mission builder:
 * the first screen must teach beginners and still expose enough control for experts.
 */
import { MissionBench } from "../objective/MissionBench";
import type { ObjectiveSpec } from "../../../api/client";

export function ActObjective({ onRun, offline }: { onRun: (spec: ObjectiveSpec) => void; offline: boolean }) {
  return (
    <section className="act act-objective">
      <div className="act-inner">
        <h1 className="act-h">Search biology&rsquo;s quantum sensing frontier.</h1>
        <p className="act-lede">Nebula is a discovery physics engine: map a sensing objective to public protein hypotheses, compute only inside the evidence boundary, and export a falsifiable next experiment. It does not measure proteins or predict a working sensor.</p>
        <MissionBench onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
