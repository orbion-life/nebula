/**
 * CinematicShell — maps the run state machine to the three Acts, plus the calm
 * workspace. DiscoverApp still owns all run state + handlers; this only chooses and
 * frames the active Act and keeps scroll sane across transitions (useRunScroll).
 *
 *   phase "objective"           → Act I  (ActObjective)
 *   phase "running"             → Act II (ActSearch, run-driven)
 *   phase "workspace" + cinematic → Act III (ActResult = scroll narrative) [default]
 *   phase "workspace" + workspace → Workspace (expert surface)
 */
import { Workspace } from "../Workspace";
import { ActObjective } from "./ActObjective";
import { ActSearch } from "./ActSearch";
import { ActResult } from "./ActResult";
import { useRunScroll } from "./useRunScroll";
import type { ObjectiveSpec, RunEvent, RunState } from "../../../api/client";

interface Props {
  phase: "objective" | "running" | "workspace";
  view: "cinematic" | "workspace";
  status: string;
  stage: string;
  events: RunEvent[];
  run: RunState | null;
  error: string | null;
  offline: boolean;
  onRun: (spec: ObjectiveSpec) => void;
  onCancel: () => void;
  onReset: () => void;
  setView: (v: "cinematic" | "workspace") => void;
}

export function CinematicShell(props: Props) {
  const act = props.phase === "objective" ? "objective" : props.phase === "running" ? "search" : props.view;
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
  // workspace phase
  if (props.run && props.view === "cinematic") {
    return <ActResult run={props.run} onEnterWorkspace={() => props.setView("workspace")} />;
  }
  if (props.run) {
    return <Workspace run={props.run} onReset={props.onReset} onPlayStory={() => props.setView("cinematic")} />;
  }
  return null;
}
