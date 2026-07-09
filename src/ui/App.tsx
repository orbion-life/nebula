import { useMemo, useState } from "react";
import { runDiscover, DEMO_OBJECTIVE } from "../core/pipeline";
import { ObjectiveValidationError } from "../core/discoverCore";
import { DEFAULT_INSTRUMENT_ID } from "../core/fixtures/instruments";
import type { DiscoverResult } from "../core/types";
import { Ask } from "./screens/Ask";
import { Explain } from "./screens/Explain";
import { Simulate } from "./screens/Simulate";
import { MeasureNext } from "./screens/MeasureNext";

const STEPS = ["Ask", "Explain", "Simulate", "Measure next"];
const SEED = 1337;

export function App() {
  const [objectiveText, setObjectiveText] = useState(DEMO_OBJECTIVE.objectiveText);
  const [instrumentId, setInstrumentId] = useState(DEFAULT_INSTRUMENT_ID);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { result, error } = useMemo((): {
    result: DiscoverResult | null;
    error: string[] | null;
  } => {
    try {
      return { result: runDiscover({ objectiveText }, SEED, instrumentId), error: null };
    } catch (e) {
      if (e instanceof ObjectiveValidationError) return { result: null, error: e.issues };
      return { result: null, error: [(e as Error).message] };
    }
  }, [objectiveText, instrumentId]);

  const activeId = selectedId ?? result?.selectedHypothesisId ?? "";
  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  return (
    <div className="studio">
      <header className="rail">
        <div className="rail-top">
          <span className="wordmark">Nebula <span>Discover</span></span>
          <span className="honest">
            Diagnostic only · synthetic assumption sweeps, not measured data · public evidence only
          </span>
        </div>
        <nav className="steps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <button
              key={s}
              className={`step-pill ${i === step ? "active" : i < step ? "done" : ""}`}
              disabled={i > 0 && !result}
              aria-current={i === step ? "step" : undefined}
              onClick={() => go(i)}
            >
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              {s}
            </button>
          ))}
        </nav>
      </header>

      {step === 0 && (
        <Ask
          objectiveText={objectiveText}
          setObjectiveText={setObjectiveText}
          instrumentId={instrumentId}
          setInstrumentId={setInstrumentId}
          result={result}
          error={error}
          onContinue={() => go(1)}
        />
      )}
      {step === 1 && result && (
        <Explain
          result={result}
          selectedId={activeId}
          setSelectedId={setSelectedId}
          onBack={() => go(0)}
          onContinue={() => go(2)}
        />
      )}
      {step === 2 && result && (
        <Simulate
          result={result}
          selectedId={activeId}
          seed={SEED}
          instrumentId={instrumentId}
          setInstrumentId={setInstrumentId}
          onBack={() => go(1)}
          onContinue={() => go(3)}
        />
      )}
      {step === 3 && result && (
        <MeasureNext result={result} selectedId={activeId} seed={SEED} onBack={() => go(2)} />
      )}
    </div>
  );
}
