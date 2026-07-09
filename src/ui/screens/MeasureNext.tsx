import { useMemo, useState } from "react";
import { routeById } from "../../core/fixtures/routes";
import { generateParameterSpace } from "../../core/physics";
import { simulate } from "../../core/simulator";
import { buildRationale } from "../../core/rationale";
import { buildMeasurementPlan } from "../../core/measurementPlan";
import { exportJson, exportMarkdown } from "../../core/export";
import type { DiscoverResult } from "../../core/types";

interface Props {
  result: DiscoverResult;
  selectedId: string;
  seed: number;
  onBack: () => void;
}

export function MeasureNext({ result, selectedId, seed, onBack }: Props) {
  const hyp = result.hypotheses.find((h) => h.id === selectedId)!;
  const route = routeById(hyp.mechanismRouteId)!;
  const evidence = result.simulationEvidence.find((e) => e.hypothesisId === selectedId)!;
  const rank = result.ranking.find((r) => r.hypothesisId === selectedId)!;
  const [tab, setTab] = useState<"markdown" | "json">("markdown");

  const mp = useMemo(
    () =>
      selectedId === result.selectedHypothesisId
        ? result.measurementPlan
        : buildMeasurementPlan(hyp, route, evidence, result.instrument, rank.rank),
    [selectedId, result, hyp, route, evidence, rank],
  );

  const exportOpts = useMemo(() => {
    const space = generateParameterSpace(route);
    return {
      hypothesisId: selectedId,
      rationale: buildRationale(hyp, route),
      simulation: simulate(route, space, seed),
      parameterSpace: space,
      route,
    };
  }, [selectedId, hyp, route, seed]);

  const text = tab === "markdown" ? exportMarkdown(result, exportOpts) : exportJson(result, exportOpts);

  function download() {
    const blob = new Blob([text], { type: tab === "markdown" ? "text/markdown" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nebula-discover-handoff.${tab === "markdown" ? "md" : "json"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="screen">
      <p className="eyebrow">Measure next</p>
      <h1>One decisive experiment — and the result that would kill it.</h1>

      <div className="decisive">
        <div className="headline">{mp.whatToMeasure}</div>
        <div className="sub">
          {hyp.scaffoldFamily.replace(/_/g, " ")} · rank #{rank.rank} on {result.instrument.label} ·{" "}
          {evidence.observable ? "observable" : "not observable on this instrument"}
        </div>
        <div className="mp-grid">
          <div className="mp-item"><div className="k">Expected signature</div><div className="v">{mp.expectedSignature}</div></div>
          <div className="mp-item"><div className="k">Expected uncertainty</div><div className="v">{mp.expectedUncertainty}</div></div>
          <div className="mp-item"><div className="k">Null expectation</div><div className="v">{mp.nullExpectation}</div></div>
          <div className="mp-item"><div className="k">Information gained</div><div className="v">{mp.informationGained}</div></div>
          <div className="mp-item">
            <div className="k">Positive controls</div>
            <ul>{mp.positiveControls.map((c, i) => <li key={i}>{c}</li>)}{mp.positiveControls.length === 0 && <li>—</li>}</ul>
          </div>
          <div className="mp-item">
            <div className="k">Negative controls</div>
            <ul>{mp.negativeControls.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="mp-item">
            <div className="k">Competing explanations</div>
            <ul>{mp.competingExplanations.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
          <div className="mp-item kill">
            <div className="k">Kill criterion (falsification)</div>
            <div className="v">{mp.killCriterion}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Claim firewall (live)</h2>
        <div className="firewall">
          <div className="claim-box claim-blocked">
            <span className="lbl">blocked</span>
            <span style={{ textDecoration: "line-through" }}>{result.blockedClaimExample.input}</span>
          </div>
          <div className="arrow">→</div>
          <div className="claim-box claim-safe">
            <span className="lbl">rewritten</span>
            <span>{result.blockedClaimExample.rewrite}</span>
          </div>
        </div>
        <p className="hint">Patterns: {result.blockedClaimExample.matchedPatterns.join("; ")}. Exports are scanned so no affirmative validation claim can leave the tool.</p>
      </div>

      <div className="card">
        <h2>Collaborator handoff</h2>
        <div className="dl-row">
          <button className={`dl-tab ${tab === "markdown" ? "active" : ""}`} onClick={() => setTab("markdown")}>Markdown</button>
          <button className={`dl-tab ${tab === "json" ? "active" : ""}`} onClick={() => setTab("json")}>JSON</button>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn" onClick={download}>Download handoff</button>
        </div>
        <pre className="export">{text.slice(0, 1400)}{text.length > 1400 ? "\n…(full brief in the download)" : ""}</pre>
      </div>

      <details className="disclose">
        <summary>Release audit (deterministic, not live agents)</summary>
        <div className="disclose-body">
          <p className="hint" style={{ marginTop: 0 }}>
            A deterministic in-code review panel runs on every result as a release gate —{" "}
            <b>{result.swarmReview.verdict.toUpperCase()}</b>, {result.swarmReview.lenses.length} lenses,{" "}
            {result.swarmReview.counts.blocker} blocker(s). These are synchronous code checks, not live Claude agents.
            Real Claude review artifacts are committed under <code>artifacts/claude/</code>.
          </p>
        </div>
      </details>

      <div className="nav">
        <button className="btn ghost" onClick={onBack}>← Simulate</button>
        <span className="spacer" />
        <span className="honest">Diagnostic only · requires validation by a measurement collaborator.</span>
      </div>
    </section>
  );
}
