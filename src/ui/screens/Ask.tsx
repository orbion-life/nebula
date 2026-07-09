import { INSTRUMENT_PROFILES } from "../../core/fixtures/instruments";
import { DEMO_OBJECTIVE, STRESS_OBJECTIVE } from "../../core/pipeline";
import type { DiscoverResult } from "../../core/types";

interface Props {
  objectiveText: string;
  setObjectiveText: (s: string) => void;
  instrumentId: string;
  setInstrumentId: (s: string) => void;
  result: DiscoverResult | null;
  error: string[] | null;
  onContinue: () => void;
}

export function Ask({ objectiveText, setObjectiveText, instrumentId, setInstrumentId, result, error, onContinue }: Props) {
  const inst = INSTRUMENT_PROFILES.find((p) => p.id === instrumentId);
  return (
    <section className="screen">
      <p className="eyebrow">Ask</p>
      <h1>Given a public scaffold, what should we measure first?</h1>
      <p className="lede">
        Describe a protein-sensor objective in plain language. Nebula Discover compiles it, grounds it
        in public evidence, simulates the physics of each mechanism route, and returns the one
        measurement worth running next — with the exact result that would falsify it.
      </p>

      <div className="field">
        <label htmlFor="obj">Sensing / material objective</label>
        <textarea id="obj" className="objective" value={objectiveText}
          onChange={(e) => setObjectiveText(e.target.value)} />
        <div className="pick" style={{ marginTop: 8 }}>
          <button onClick={() => setObjectiveText(DEMO_OBJECTIVE.objectiveText)}>Load demo objective</button>
          <button onClick={() => setObjectiveText(STRESS_OBJECTIVE.objectiveText)}>Load stress-test objective</button>
        </div>
      </div>

      <div className="field">
        <label>Instrument — its limits gate what is observable</label>
        <div className="pick">
          {INSTRUMENT_PROFILES.map((p) => (
            <button key={p.id} className={p.id === instrumentId ? "on" : ""}
              onClick={() => setInstrumentId(p.id)}>{p.label}</button>
          ))}
        </div>
        <p className="hint">{inst?.notes}</p>
      </div>

      {error && (
        <div className="validation">
          Objective did not validate (Zod): {error.join("; ")}. Enter a non-empty objective under 5000 characters.
        </div>
      )}

      {result && (
        <div className="card">
          <h2>Compiled constraints</h2>
          <div className="two-col">
            <div><b>Readouts</b> · {result.objective.desiredReadouts.join(", ")}</div>
            <div><b>Material</b> · {result.objective.materialContext}</div>
            <div><b>Host</b> · {result.objective.expressionHost}</div>
            <div><b>Excitation</b> · {result.objective.excitationAllowed.join(", ") || "unspecified"}</div>
          </div>
          {result.objective.missingInformation.length > 0 && (
            <p className="hint">Missing / assumed: {result.objective.missingInformation.join("; ")}</p>
          )}
        </div>
      )}

      <div className="nav">
        <span className="spacer" />
        <button className="btn" disabled={!result} onClick={onContinue}>Explain the mechanisms →</button>
      </div>
    </section>
  );
}
