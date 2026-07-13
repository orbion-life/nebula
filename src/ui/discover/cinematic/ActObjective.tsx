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
        <h1 className="act-h">Discover biology&rsquo;s quantum sensing frontier.</h1>
        <p className="act-lede">Explore nature&rsquo;s proteins, create new construct hypotheses, and define the decisive experiment that moves each possibility forward. Nebula shows the evidence and the unknowns; it does not predict a working sensor.</p>
        <MissionBench onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
