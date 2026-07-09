import { useMemo, useState } from "react";
import { INSTRUMENT_PROFILES, instrumentById } from "../../core/fixtures/instruments";
import { routeById } from "../../core/fixtures/routes";
import { generateParameterSpace } from "../../core/physics";
import { simulate } from "../../core/simulator";
import { RADICAL_PAIR_ARTIFACT } from "../../core/generated/radicalPair";
import type { DiscoverResult } from "../../core/types";
import { MaryChart } from "../components/MaryChart";
import { RfChart } from "../components/RfChart";
import { LineChart } from "../charts/LineChart";

interface Props {
  result: DiscoverResult;
  selectedId: string;
  seed: number;
  instrumentId: string;
  setInstrumentId: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

function transduction(): number {
  const p = RADICAL_PAIR_ARTIFACT.parameters.find((x) => x.name === "c_transduction_fluorescence");
  return typeof p?.value === "number" ? p.value : 0.5;
}

export function Simulate({ result, selectedId, seed, instrumentId, setInstrumentId, onBack, onContinue }: Props) {
  const hyp = result.hypotheses.find((h) => h.id === selectedId)!;
  const route = routeById(hyp.mechanismRouteId)!;
  const inst = instrumentById(instrumentId)!;
  const isRP = route.simulatorPlugin === "radical_pair_response_proxy";

  const [nuisanceLevel, setNuisanceLevel] = useState(0.4);
  const [showNuisance, setShowNuisance] = useState(true);
  const [collapse, setCollapse] = useState(false);

  const art = RADICAL_PAIR_ARTIFACT.data;
  const scale = transduction() * art.singletYield[0];
  const dff = useMemo(() => {
    const mfe = collapse ? art.controls.relaxation_dominated.mfePercent : art.mfePercent;
    return collapse ? mfe.map((m) => scale * (m / 100)) : art.dFF_assumptionDerived;
  }, [collapse, art, scale]);
  const meanDff = art.ensemble.meanMfePercent.map((m) => scale * (m / 100));
  const stdDff = art.ensemble.stdMfePercent.map((s) => scale * (s / 100));

  // Observability of the radical-pair signature under this instrument.
  const fieldMax = inst.staticFieldRange_mT[1];
  const peak = dff.reduce((mx, v, i) => (art.B0_mT[i] <= fieldMax ? Math.max(mx, Math.abs(v)) : mx), 0);
  const snr = peak / inst.minDetectableDeltaFOverF;
  const rpObservable = snr >= 1;

  const bench = result.benchmarkComparisons.find((b) => b.benchmarkId === "bm_flavoprotein_odmr");
  const sim = useMemo(() => simulate(route, generateParameterSpace(route), seed), [route, seed]);

  return (
    <section className="screen">
      <p className="eyebrow">Simulate</p>
      <h1>Would this experiment even be visible?</h1>
      <p className="lede">
        The trace below is <b>simulation</b>, not measured data. Change the instrument and the
        nuisances and watch observability — and the ranking — move.
      </p>

      <div className="control" style={{ maxWidth: 420, marginBottom: 16 }}>
        <label htmlFor="inst">Instrument</label>
        <select id="inst" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}>
          {INSTRUMENT_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {isRP ? (
        <div className="card sim-layout">
          <MaryChart
            b0={art.B0_mT}
            dff={dff}
            meanDff={meanDff}
            stdDff={stdDff}
            fieldMax={fieldMax}
            noiseFloor={inst.minDetectableDeltaFOverF}
            nuisanceLevel={nuisanceLevel}
            showNuisance={showNuisance}
          />
          <div className="legend">
            <span className="k"><span className="sw sim" /> ΔF/F simulation</span>
            <span className="k"><span className="sw ribbon" /> ensemble uncertainty</span>
            <span className="k"><span className="sw floor" /> instrument noise floor</span>
            {showNuisance && <span className="k"><span className="sw assume" /> nuisance drift</span>}
          </div>

          <div className="controls-row">
            <div className="control">
              <label>Nuisance drift (O₂ / bleach) <span className="val">{Math.round(nuisanceLevel * 5)}% </span></label>
              <input type="range" min={0} max={1} step={0.05} value={nuisanceLevel}
                onChange={(e) => setNuisanceLevel(Number(e.target.value))} aria-label="nuisance drift level" />
            </div>
            <div className="toggle-row">
              <button className={`toggle ${showNuisance ? "on" : ""}`} onClick={() => setShowNuisance((v) => !v)}>
                {showNuisance ? "nuisance shown" : "nuisance hidden"}
              </button>
              <button className={`toggle ${collapse ? "on" : ""}`} onClick={() => setCollapse((v) => !v)}>
                counterfactual: fast spin relaxation
              </button>
            </div>
          </div>

          <div className="observability">
            <span className={`obs-badge ${rpObservable ? "yes" : "no"}`}>
              {rpObservable ? "observable" : "below noise floor"}
            </span>
            <span>peak {(peak * 100).toFixed(2)}% ΔF/F · SNR ≈ {snr.toFixed(1)} on {inst.label}</span>
          </div>

          {inst.rfAvailable && !collapse && (
            <>
              <RfChart freq={art.rf.freq_MHz} contrast={art.rf.deltaYieldFraction} control={art.rf.control_b1_zero} />
              <p className="figcap">RF contrast is frequency-resolved from the spin Hamiltonian’s eigen-gaps — a real resonance, not a scalar gain. The RF-off control is flat.</p>
            </>
          )}

          {bench && (
            <div className="benchmark-note">
              <span className="lbl">Public benchmark — qualitative, no curve</span>
              <div className="q">{bench.measuredQualitative}</div>
              <div className="cite">doi:{bench.citation.doi} · {bench.residualUncertainty}</div>
            </div>
          )}

          <p className="figcap">
            {collapse
              ? "Counterfactual: with fast spin relaxation the magnetic field effect collapses toward zero and falls below the noise floor — the experiment stops being worth running. This is exactly why the physics drives the ranking."
              : "The low-field dip and high-field rise are the radical-pair signature. On a noisier instrument the same signal sinks below the red floor and the route loses rank."}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="charts" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
            {sim.traces.slice(0, 4).map((t) => (
              <div key={t.id}>
                <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600 }}>{t.title}</div>
                <LineChart trace={t} color={t.isControl ? "#2f6b3a" : t.isNuisance ? "#9a5b2f" : "#1a202c"} />
              </div>
            ))}
          </div>
          <p className="figcap">
            This route uses a transparent mechanism-shaped proxy (labeled assumption), not the radical-pair spin-dynamics artifact. Select a LOV/flavin or cryptochrome route to explore the deep physics path.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Ranking on this instrument (live)</h2>
        <table className="rank-mini">
          <tbody>
            {result.ranking.map((r) => {
              const h = result.hypotheses.find((x) => x.id === r.hypothesisId)!;
              const ev = result.simulationEvidence.find((e) => e.hypothesisId === r.hypothesisId)!;
              return (
                <tr key={r.hypothesisId} className={r.rank === 1 ? "top" : ""}>
                  <td className="r">#{r.rank}</td>
                  <td>{h.scaffoldFamily.replace(/_/g, " ")}</td>
                  <td className={ev.observable ? "obs" : "noobs"}>{ev.observable ? "observable" : "below floor"}</td>
                  <td className="sc">{r.score.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">Switching the instrument re-simulates every route and re-ranks. No trace here is measured data.</p>
      </div>

      <details className="disclose">
        <summary>Parameter provenance ({result.parameterEnsembles.find((e) => e.routeId === route.id)?.parameters.length ?? 0})</summary>
        <div className="disclose-body">
          <table className="prov-table">
            <thead>
              <tr><th>parameter</th><th>value / range</th><th>unit</th><th>source</th><th>uncertainty</th></tr>
            </thead>
            <tbody>
              {(result.parameterEnsembles.find((e) => e.routeId === route.id)?.parameters ?? []).map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{typeof p.value === "number" ? p.value : "—"} [{p.range[0]}–{p.range[1]}]</td>
                  <td>{p.unit}</td>
                  <td className={`src-${p.sourceType}`}>{p.sourceType}</td>
                  <td>{p.uncertainty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="nav">
        <button className="btn ghost" onClick={onBack}>← Explain</button>
        <span className="spacer" />
        <button className="btn" onClick={onContinue}>Measure this next →</button>
      </div>
    </section>
  );
}
