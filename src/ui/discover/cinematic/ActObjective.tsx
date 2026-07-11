/**
 * Act I — Objective. A quiet, full-viewport opening scene: one large question, then the
 * editable objective. The real input UI (ObjectivePanel) is embedded unchanged; this
 * only frames it cinematically (minimal text, generous space).
 */
import { ObjectivePanel } from "../ObjectivePanel";
import type { ObjectiveSpec } from "../../../api/client";

export function ActObjective({ onRun, offline }: { onRun: (spec: ObjectiveSpec) => void; offline: boolean }) {
  return (
    <section className="act act-objective">
      <div className="act-inner">
        <div className="act-kicker"><span className="act-n">01</span>objective</div>
        <h1 className="act-h">What should a protein sense — and how would you measure it?</h1>
        <ObjectivePanel onRun={onRun} offline={offline} />
      </div>
    </section>
  );
}
