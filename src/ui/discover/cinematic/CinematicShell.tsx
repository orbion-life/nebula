/**
 * CinematicShell — maps the run state machine to the three Acts. DiscoverApp owns all run
 * state + handlers; this only chooses and frames the active Act and keeps scroll sane
 * across transitions (useRunScroll). There is one result view (no workspace toggle).
 *
 *   phase "objective" → Act I  (ActObjective)
 *   phase "running"   → Act II (ActSearch, run driven)
 *   phase "workspace" → Act III (ActResult = the single scroll narrative)
 */
import { ActObjective } from "./ActObjective";
import { ActSearch } from "./ActSearch";
import { ActResult } from "./ActResult";
import { useRunScroll } from "./useRunScroll";
import type { ObjectiveSpec, RunEvent, RunState } from "../../../api/client";

interface Props {
  phase: "objective" | "running" | "workspace";
  status: string;
  stage: string;
  events: RunEvent[];
  run: RunState | null;
  error: string | null;
  offline: boolean;
  onRun: (spec: ObjectiveSpec) => void;
  onCancel: () => void;
  onReset: () => void;
}

export function CinematicShell(props: Props) {
  const act = props.phase === "objective" ? "objective" : props.phase === "running" ? "search" : "result";
  useRunScroll(act);

  if (props.phase === "objective") {
    return <ActObjective onRun={props.onRun} offline={props.offline} />;
  }
  if (props.phase === "running") {
    return (
      <ActSearch
        status={props.status} stage={props.stage} events={props.events} run={props.run}
        error={props.error} onCancel={props.onCancel} onReset={props.onReset}
      />
    );
  }
  if (props.run) {
    return <ActResult run={props.run} />;
  }
  return null;
}
