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
        <p className="act-lede">A protein that feels a magnetic field. A cell that reports its own redox chemistry. Choose the signal you want to sense, and the scan searches all of nature — and the generative frontier beyond it — for the candidate worth taking to a bench.</p>
        <MissionBench onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
