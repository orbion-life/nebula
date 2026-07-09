import { evidenceById } from "../../core/fixtures/evidenceCards";
import { routeById } from "../../core/fixtures/routes";
import type { DiscoverResult } from "../../core/types";

interface Props {
  result: DiscoverResult;
  selectedId: string;
  setSelectedId: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Explain({ result, selectedId, setSelectedId, onBack, onContinue }: Props) {
  const hyp = result.hypotheses.find((h) => h.id === selectedId)!;
  const route = routeById(hyp.mechanismRouteId)!;
  const evidence = result.simulationEvidence.find((e) => e.hypothesisId === selectedId)!;
  const anchored = route.causalSteps.filter((s) => s.support === "public_anchor").length;
  const unresolved = route.causalSteps.length - anchored;

  return (
    <section className="screen">
      <p className="eyebrow">Explain</p>
      <h1>Evidence, then the mechanism it can and can’t support.</h1>
      <p className="lede">
        Each route is a causal chain from cofactor to readout. Steps are tagged{" "}
        <b>anchored</b> (public literature), <b>assumed</b>, or <b>unknown</b> — so
        the honest gap is visible before any measurement.
      </p>

      <div className="two-col">
        <div className="card">
          <h2>Candidate routes (ranked)</h2>
          <table className="rank-mini">
            <tbody>
              {result.ranking.map((r) => {
                const h = result.hypotheses.find((x) => x.id === r.hypothesisId)!;
                const ev = result.simulationEvidence.find((e) => e.hypothesisId === r.hypothesisId)!;
                return (
                  <tr key={r.hypothesisId} className={r.hypothesisId === selectedId ? "top" : ""}
                    onClick={() => setSelectedId(r.hypothesisId)} style={{ cursor: "pointer" }}>
                    <td className="r">#{r.rank}</td>
                    <td>
                      {h.scaffoldFamily.replace(/_/g, " ")}{" "}
                      <span className="tag-assume" title={r.evidenceSource}>
                        {r.evidenceSource === "generated_artifact" ? "physics" : "proxy"}
                      </span>
                    </td>
                    <td className={ev.observable ? "obs" : "noobs"}>{ev.observable ? "observable" : "below floor"}</td>
                    <td className="sc">{r.score.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">Click a route to inspect its mechanism. Ranking = experiment value on the chosen instrument, not predicted performance.</p>
        </div>

        <div className="card">
          <h2>{route.name}</h2>
          <div className="map">
            {route.causalSteps.map((s, i) => (
              <div className="chain-step" key={i}>
                <span className="idx">{i + 1}</span>
                <span className="body">
                  {s.step}
                  {s.failureMode && <div className="fail">✕ {s.failureMode}</div>}
                </span>
                <span className={`support-tag ${s.support}`}>{s.support.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
          <p className="hint">
            {anchored} anchored · {unresolved} assumed/unknown · max claim:{" "}
            <b>{route.maxClaimLevel.replace(/_/g, " ")}</b> · signature{" "}
            {(evidence.signatureMetric * 100).toFixed(evidence.signatureMetric < 0.1 ? 1 : 0)}% ΔF/F
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Public evidence anchors</h2>
        {route.publicAnchors.map((id) => {
          const c = evidenceById(id);
          if (!c) return null;
          const doi = c.citations[0]?.doi;
          return (
            <div className="evrow" key={id}>
              <span style={{ flex: 1 }}>{c.title}</span>
              {c.provenance === "demo_assumption" ? (
                <span className="tag-assume">demo assumption</span>
              ) : doi ? (
                <a className="doi" href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">doi:{doi}</a>
              ) : null}
            </div>
          );
        })}
        <p className="hint">A citation supports the plausibility of a mechanism class — never that this construct is a working sensor.</p>
      </div>

      <div className="nav">
        <button className="btn ghost" onClick={onBack}>← Ask</button>
        <span className="spacer" />
        <button className="btn" onClick={onContinue}>Simulate the physics →</button>
      </div>
    </section>
  );
}
