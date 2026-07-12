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
        <span className="act-eyebrow">the objective</span>
        <h1 className="act-h">Begin a quantum biosensor.</h1>
        <p className="act-lede">Every quantum biosensor starts as one question. Choose the world where yours will live and the signal it must feel, and the scan turns your objective into real protein candidates to test at a bench.</p>
        <MissionBench onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
