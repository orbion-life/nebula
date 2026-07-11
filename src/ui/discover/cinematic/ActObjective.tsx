/**
 * Act I — Objective. A quiet, full viewport opening scene: one large question, then the
 * gamified Mission Bench (the default) with the free text ObjectivePanel one click away.
 */
import { useState } from "react";
import { ObjectivePanel } from "../ObjectivePanel";
import { MissionBench } from "../objective/MissionBench";
import type { ObjectiveSpec } from "../../../api/client";

export function ActObjective({ onRun, offline }: { onRun: (spec: ObjectiveSpec) => void; offline: boolean }) {
  const [expert, setExpert] = useState(false);
  return (
    <section className="act act-objective">
      <div className="act-inner">
        <div className="act-kicker"><span className="act-n">01</span>objective</div>
        <h1 className="act-h">What are you building? What must it sense?</h1>
        {expert ? (
          <>
            <ObjectivePanel onRun={onRun} offline={offline} />
            <button className="mb-type" onClick={() => setExpert(false)} style={{ marginTop: 14 }}>
              back to the bench
            </button>
          </>
        ) : (
          <MissionBench onRun={onRun} offline={offline} onTypeInstead={() => setExpert(true)} />
        )}
      </div>
    </section>
  );
}
