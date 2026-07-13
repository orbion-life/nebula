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
        <h1 className="act-h">Choose the protein hypothesis worth measuring next.</h1>
        <p className="act-lede">Select a sensing world, signal, and practical constraints. Nebula searches route-compatible public protein records, separates evidence from assumptions, and returns a falsifiable measurement brief. It does not predict a working sensor.</p>
        <MissionBench onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
