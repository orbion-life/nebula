/**
 * Elegant abstention (brief Ask E): failing to find a candidate should read as an honest,
 * intentional result, never a broken app. Two triggers:
 *   "empty"      , a SUPPORTED objective that completed with zero candidates (nature handed
 *                   us nothing that clears the mechanism / measurability gate).
 *   "unsupported", a 422 before the run: the objective sits outside what this build can search.
 * An absent candidate is information, and we say so, with the same cinematic restraint as a hit.
 */
import type { RunState } from "../../../api/client";

interface Props {
  kind: "empty" | "unsupported";
  run: RunState | null;
  error?: string | null;
  onReset: () => void;
}

export function ActAbstention({ kind, run, error, onReset }: Props) {
  const dbCount = new Set((run?.provider_calls ?? []).map((c) => c.provider)).size;
  const sensed = run?.objective.sensed_quantity_or_state?.replace(/-/g, " ") ?? "this objective";
  return (
    <section className="act act-abstention">
      <div className="act-inner act-abstention-inner">
        <span className="abstain-glyph" aria-hidden>
          <svg viewBox="0 0 80 80" width="100%" height="100%">
            <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 5" opacity="0.7" />
            <circle cx="40" cy="40" r="15" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          </svg>
        </span>

        {kind === "empty" ? (
          <>
            <span className="abstain-eyebrow">honest result</span>
            <h1 className="act-h">Nature did not hand us a candidate.</h1>
            <p className="abstain-lead">
              The scan searched {dbCount > 0 ? `${dbCount} public database${dbCount === 1 ? "" : "s"}` : "the public record"} for{" "}
              {sensed} and found no protein that clears the mechanism-support and measurability gates. An absent candidate is
              information, not a failure, the record simply does not carry one under these constraints.
            </p>
            <p className="abstain-sub">Loosen a constraint, choose a different world, or change the sensing target to open the search.</p>
          </>
        ) : (
          <>
            <span className="abstain-eyebrow">outside scope</span>
            <h1 className="act-h">This objective sits outside the scan.</h1>
            <p className="abstain-lead">{error ?? "This build cannot search the requested sensing target yet."}</p>
            <p className="abstain-sub">Pick a supported sensing target from the objective builder to run a real discovery.</p>
          </>
        )}

        <button className="btn-primary abstain-reset" onClick={onReset}>← rebuild the objective</button>
      </div>
    </section>
  );
}
