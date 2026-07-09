import { Fragment, useMemo, useState } from "react";
import { runDiscover, DEMO_OBJECTIVE, STRESS_OBJECTIVE } from "../core/pipeline";
import { buildRationale } from "../core/rationale";
import { generateParameterSpace } from "../core/physics";
import { simulate } from "../core/simulator";
import { routeById } from "../core/fixtures/routes";
import { evidenceById } from "../core/fixtures/evidenceCards";
import { RANKING_WEIGHTS } from "../core/ranking";
import { auditClaim } from "../core/claimFirewall";
import { exportJson, exportMarkdown } from "../core/export";
import { vectorAnalogSearch } from "../core/analogIndex";
import type {
  ConstructHypothesis,
  MeasurementWorthiness,
  WorthinessComponents,
} from "../core/types";
import {
  LIBRARY_REGISTRY,
  librariesByLayer,
  type LibraryLayer,
  type LibraryStatus,
} from "../core/libraryRegistry";
import { SWARM_LENS_COUNT, type SwarmConsensus } from "../core/swarm";
import { LineChart } from "./charts/LineChart";
import { StructureViewer } from "./StructureViewer";

const CLAUDE_ROLES = [
  "objective-compiler",
  "construct-architect",
  "mechanism-router",
  "physics-data-simulator",
  "rationale-explainer",
  "measurement-worthiness-ranker",
  "scientific-skeptic",
  "swarm-orchestrator",
  "claim-boundary-auditor",
  "design-adapter",
  "visual-system-director",
  "demo-director",
];

const COMPONENT_LABELS: Array<[keyof WorthinessComponents, string, boolean]> = [
  ["routeSupport", "route support", false],
  ["readoutCompatibility", "readout match", false],
  ["constructExecutability", "executability", false],
  ["cofactorFeasibility", "cofactor feasibility", false],
  ["controlQuality", "control quality", false],
  ["nuisanceRiskPenalty", "nuisance penalty", true],
  ["uncertaintyPenalty", "uncertainty penalty", true],
];

export function App() {
  const [text, setText] = useState(DEMO_OBJECTIVE.objectiveText);
  const [seed, setSeed] = useState(1337);
  const [submitted, setSubmitted] = useState(DEMO_OBJECTIVE.objectiveText);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);
  const [customClaim, setCustomClaim] = useState("");
  const [exportTab, setExportTab] = useState<"markdown" | "json">("markdown");

  const result = useMemo(
    () => runDiscover({ objectiveText: submitted }, seed),
    [submitted, seed],
  );

  const activeId = selectedId ?? result.selectedHypothesisId;
  const active = result.hypotheses.find((h) => h.id === activeId)!;
  const activeRoute = routeById(active.mechanismRouteId)!;
  const activeRanking = result.ranking.find((r) => r.hypothesisId === activeId)!;

  const { rationale, simulation, parameterSpace } = useMemo(() => {
    const route = routeById(active.mechanismRouteId)!;
    const space = generateParameterSpace(route);
    return {
      rationale: buildRationale(active, route),
      simulation: simulate(route, space, seed),
      parameterSpace: space,
    };
  }, [active, seed]);

  const customAudit = useMemo(
    () => (customClaim.trim() ? auditClaim(customClaim) : null),
    [customClaim],
  );

  const analogHits = useMemo(
    () => vectorAnalogSearch(submitted, 4),
    [submitted],
  );

  const handoffOpts = {
    hypothesisId: activeId,
    rationale,
    simulation,
    parameterSpace,
    route: activeRoute,
  };

  const exportText =
    exportTab === "markdown"
      ? exportMarkdown(result, handoffOpts)
      : exportJson(result, handoffOpts);

  function run() {
    setSubmitted(text);
    setSelectedId(null);
    setShowBlocked(false);
  }

  function download() {
    const blob = new Blob([exportText], {
      type: exportTab === "markdown" ? "text/markdown" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nebula-discover-handoff.${exportTab === "markdown" ? "md" : "json"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>Nebula Discover</h1>
        <div className="sub">
          A public, open-source discovery module concept for Nebula. It turns a
          sensing/material objective into public construct hypotheses, mechanism
          routes, synthetic multimodal measurement signatures, rationale,
          uncertainty, and a claim-safe measurement handoff — so a team can
          decide <em>what deserves measurement first.</em>
        </div>
        <div className="status-strip">
          <span className="badge warn">diagnostic only — not validated</span>
          <span className="badge">synthetic assumption sweeps, not predictions</span>
          <span className="badge">public / synthetic evidence only</span>
          <span className="badge ok">no private Nebula / Astra / Orbion data</span>
        </div>
      </header>

      {/* 1. Intake */}
      <section>
        <div className="section-title">
          <span className="step-num">01</span> Objective intake
        </div>
        <div className="grid cols-2">
          <div className="panel">
            <h2>Sensing / material objective</h2>
            <textarea
              className="objective"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="controls">
              <button className="run" onClick={run}>
                Run Discover
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setText(STRESS_OBJECTIVE.objectiveText);
                  setSubmitted(STRESS_OBJECTIVE.objectiveText);
                  setSeed(4242);
                  setSelectedId(null);
                }}
              >
                Load stress-test objective
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setText(DEMO_OBJECTIVE.objectiveText);
                  setSubmitted(DEMO_OBJECTIVE.objectiveText);
                  setSelectedId(null);
                }}
              >
                Reset to demo objective
              </button>
              <label className="footnote" htmlFor="seed">
                seed
              </label>
              <input
                id="seed"
                className="seed-input"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="panel">
            <h2>Compiled constraints</h2>
            <dl className="kv">
              <dt>Readouts</dt>
              <dd>
                <div className="chiprow">
                  {result.objective.desiredReadouts.map((r) => (
                    <span key={r} className="chip readout">
                      {r}
                    </span>
                  ))}
                </div>
              </dd>
              <dt>Material</dt>
              <dd>{result.objective.materialContext}</dd>
              <dt>Host</dt>
              <dd>{result.objective.expressionHost}</dd>
              <dt>Excitation</dt>
              <dd>{result.objective.excitationAllowed.join(", ") || "unspecified"}</dd>
              <dt>Constraints</dt>
              <dd>{result.objective.constraints.join("; ") || "none detected"}</dd>
              <dt>Missing</dt>
              <dd className="footnote" style={{ margin: 0 }}>
                {result.objective.missingInformation.join("; ") || "none"}
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* 2. Hypotheses + ranking */}
      <section className="section">
        <div className="section-title">
          <span className="step-num">02</span> Public construct hypotheses ·
          ranked by measurement-worthiness
        </div>
        <div className="grid cols-3">
          {result.ranking.map((r) => {
            const h = result.hypotheses.find((x) => x.id === r.hypothesisId)!;
            return (
              <HypCard
                key={h.id}
                h={h}
                r={r}
                selected={h.id === activeId}
                onSelect={() => setSelectedId(h.id)}
              />
            );
          })}
        </div>
        <p className="footnote">
          Weights are open: route support {pct(RANKING_WEIGHTS.routeSupport)},
          readout {pct(RANKING_WEIGHTS.readoutCompatibility)}, executability{" "}
          {pct(RANKING_WEIGHTS.constructExecutability)}, cofactor{" "}
          {pct(RANKING_WEIGHTS.cofactorFeasibility)}, controls{" "}
          {pct(RANKING_WEIGHTS.controlQuality)}, minus nuisance/uncertainty
          penalties. Ranking is for measurement triage, not predicted performance.
        </p>
      </section>

      {/* 3. Mechanism route */}
      <section className="section">
        <div className="section-title">
          <span className="step-num">03</span> Mechanism route ·{" "}
          {active.scaffoldFamily}
        </div>
        <div className="grid cols-2">
          <div className="panel">
            <h2>Causal chain</h2>
            <h3>{activeRoute.name}</h3>
            <div className="chain">
              {activeRoute.causalSteps.map((s, i) => (
                <div key={i} className="step">
                  <span className="dot">{i + 1}.</span>
                  <span style={{ flex: 1 }}>
                    {s.step}{" "}
                    <span className={`support ${s.support}`}>
                      {s.support.replace(/_/g, " ")}
                    </span>
                    {s.failureMode && (
                      <div className="footnote">✕ {s.failureMode}</div>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="footnote">
              Max claim level: <strong>{activeRoute.maxClaimLevel.replace(/_/g, " ")}</strong>
            </p>
          </div>
          <div className="panel">
            <h2>Construct map</h2>
            <dl className="kv">
              <dt>Architecture</dt>
              <dd>{active.architectureKind.replace(/_/g, " ")}</dd>
              <dt>Cofactor</dt>
              <dd>{active.cofactorOrChromophore.join(", ") || "none"}</dd>
              <dt>Readouts</dt>
              <dd>
                <div className="chiprow">
                  {active.readoutModes.map((r) => (
                    <span key={r} className="chip readout">
                      {r}
                    </span>
                  ))}
                </div>
              </dd>
              <dt>Material fit</dt>
              <dd className="footnote" style={{ margin: 0 }}>
                {active.materialFit.join("; ")}
              </dd>
              <dt>Next step</dt>
              <dd>{active.allowedNextStep.replace(/_/g, " ")}</dd>
            </dl>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <StructureViewer />
        </div>
      </section>

      {/* 4. Simulation lab */}
      <section className="section">
        <div className="section-title">
          <span className="step-num">04</span> Simulation lab · synthetic
          multimodal signatures
        </div>
        <div className="panel">
          <h2>{simulation.label}</h2>
          <div className="charts">
            {simulation.traces.map((t) => (
              <div className="chartbox" key={t.id}>
                <div className="ctitle">{t.title}</div>
                <div className="ccond">{t.condition}</div>
                <LineChart
                  trace={t}
                  color={t.isControl ? "#2f6b3a" : t.isNuisance ? "#9a5b2f" : "#1f4e5f"}
                />
                <span
                  className={`chart-tag ${
                    t.isControl ? "tag-control" : t.isNuisance ? "tag-nuisance" : ""
                  }`}
                >
                  {t.isControl
                    ? "control"
                    : t.isNuisance
                    ? "nuisance"
                    : "assumption sweep"}{" "}
                  · control: {t.requiredControl}
                </span>
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <h2>Assumption parameter space</h2>
            <p className="footnote" style={{ marginTop: 0 }}>
              Transparent sweep ranges — not validation parameters.
            </p>
            <table className="param-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Range</th>
                  <th>Unit</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {parameterSpace.parameters.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>
                      {p.valueRange[0]}–{p.valueRange[1]}
                    </td>
                    <td>{p.unit}</td>
                    <td>{p.source.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <span className="step-num">05</span> Rationale, evidence &amp;
          controls
        </div>
        <div className="rcards">
          {rationale.map((c) => (
            <div
              key={c.kind}
              className={`rcard ${
                c.kind === "claim_boundary"
                  ? "boundary"
                  : c.kind === "falsification_criteria"
                    ? "falsify"
                    : ""
              }`}
            >
              <h4>{c.title}</h4>
              <ul>
                {c.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <h2>Public analog search (offline index)</h2>
          <p className="footnote" style={{ marginTop: 0 }}>
            Finds public scaffold analogs only — never predicts spin response.
          </p>
          <ul>
            {analogHits.map((h) => (
              <li key={h.id} className="footnote">
                {h.name} ({h.family}) — hybrid score {h.score.toFixed(2)} ·{" "}
                {h.publicRef}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <h2>Evidence anchors (citable)</h2>
          <ul>
            {activeRoute.publicAnchors.map((id) => {
              const card = evidenceById(id);
              if (!card) return null;
              const doi = card.citations[0]?.doi;
              return (
                <li key={id} className="footnote">
                  {card.title}{" "}
                  {card.provenance === "demo_assumption" ? (
                    <span className="badge warn">demo assumption</span>
                  ) : doi ? (
                    <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                      doi:{doi}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 6. Claim firewall */}
      <section className="section">
        <div className="section-title">
          <span className="step-num">06</span> Claim firewall
        </div>
        <div className="panel">
          <h2>Unsafe claim → claim-safe rewrite</h2>
          <div className="firewall">
            <div className="claim-box claim-blocked">
              <span className="lbl">blocked claim</span>
              <span className={showBlocked ? "strike" : ""}>
                {showBlocked
                  ? "We discovered a working quantum biosensor that predicts magnetic response."
                  : "Click “Attempt unsafe claim” to see the firewall act."}
              </span>
              {showBlocked && (
                <div className="pattern-tags">
                  {result.blockedClaimExample.matchedPatterns.map((p) => (
                    <span key={p} className="badge warn">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="arrow">→</div>
            <div className="claim-box claim-safe">
              <span className="lbl">allowed rewrite</span>
              <span>
                {showBlocked
                  ? result.blockedClaimExample.rewrite
                  : result.allowedClaimExample}
              </span>
            </div>
          </div>
          <div className="controls">
            <button className="ghost" onClick={() => setShowBlocked((v) => !v)}>
              {showBlocked ? "Reset firewall" : "Attempt unsafe claim"}
            </button>
            <span className="footnote">
              The plots above stay visible; only the claim is downgraded.
            </span>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>Try your own claim</h3>
            <textarea
              className="objective"
              style={{ minHeight: 64 }}
              placeholder="Paste a claim to audit live…"
              value={customClaim}
              onChange={(e) => setCustomClaim(e.target.value)}
            />
            {customAudit && (
              <div className="firewall" style={{ marginTop: 10 }}>
                <div className={`claim-box ${customAudit.blocked ? "claim-blocked" : "claim-safe"}`}>
                  <span className="lbl">{customAudit.blocked ? "blocked" : "allowed"}</span>
                  <span>{customAudit.blocked ? customAudit.rewrite : customClaim}</span>
                  {customAudit.blocked && (
                    <div className="pattern-tags">
                      {customAudit.matchedPatterns.map((p) => (
                        <span key={p} className="badge warn">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. Design adapter + export */}
      <section className="section">
        <div className="section-title">
          <span className="step-num">07</span> Design adapter &amp; measurement
          handoff
        </div>
        <div className="grid cols-2">
          <div className="panel">
            <h2>Design adapter (optional · public demo only)</h2>
            <dl className="kv">
              <dt>Adapter</dt>
              <dd>{result.designAdapter.adapter}</dd>
              <dt>Status</dt>
              <dd>{result.designAdapter.status.replace(/_/g, " ")}</dd>
              <dt>Artifact</dt>
              <dd>{result.designAdapter.generatedArtifactType}</dd>
            </dl>
            <div className="mono-preview">{result.designAdapter.artifactPreview}</div>
            <ul style={{ paddingLeft: 18, marginTop: 10 }}>
              {result.designAdapter.warnings.map((w, i) => (
                <li key={i} className="adapter-warn">
                  {w}
                </li>
              ))}
            </ul>
            <p className="footnote">
              The core demo does not depend on a live RFdiffusion/LigandMPNN run.
              {" "}
              {result.designAdapter.nextPrivateNebulaStep}
            </p>
          </div>

          <div className="panel">
            <h2>Measurement handoff export</h2>
            <p className="footnote" style={{ marginTop: 0 }}>
              Exports the selected hypothesis: <strong>{active.title}</strong> (rank #
              {activeRanking.rank})
            </p>
            <div className="tabs">
              <button
                className={`tab ${exportTab === "markdown" ? "active" : ""}`}
                onClick={() => setExportTab("markdown")}
              >
                Markdown
              </button>
              <button
                className={`tab ${exportTab === "json" ? "active" : ""}`}
                onClick={() => setExportTab("json")}
              >
                JSON
              </button>
              <button className="run" style={{ marginLeft: "auto" }} onClick={download}>
                Download
              </button>
            </div>
            <pre className="export">{exportText}</pre>
          </div>
        </div>
      </section>

      {/* 8. Mandatory adversarial swarm review */}
      <SwarmReview consensus={result.swarmReview} />

      {/* 9. Engine architecture / research adapters */}
      <EngineArchitecture />

      <footer className="section">
        <div className="section-title">Claude use</div>
        <div className="panel">
          <p style={{ margin: "0 0 6px" }}>
            Claude is used as a visible, bounded panel of roles. Deterministic
            code owns the schemas, route registry, simulator, ranking, claim
            firewall, and mandatory adversarial swarm; Claude parses messy
            objectives, explains mechanisms, writes rationale, and red-teams
            claims under structured constraints. See <code>CLAUDE_USE.md</code>,{" "}
            <code>.claude/agents/</code>, and <code>.claude/skills/</code>.
          </p>
          <div className="claude-roles">
            {CLAUDE_ROLES.map((r) => (
              <span key={r} className="role">
                {r}
              </span>
            ))}
          </div>
          <p className="footnote">
            Selected hypothesis: {active.title} · rank {activeRanking.rank} ·
            score {activeRanking.score.toFixed(3)} · seed {seed}
          </p>
        </div>
      </footer>
    </div>
  );
}

function HypCard({
  h,
  r,
  selected,
  onSelect,
}: {
  h: ConstructHypothesis;
  r: MeasurementWorthiness;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`hyp ${selected ? "selected" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="rank">measurement rank #{r.rank}</div>
      <h3>{h.title}</h3>
      <div>
        <span className="score">{r.score.toFixed(3)}</span>{" "}
        <span className="scorelabel">worthiness</span>
      </div>
      <div className="bars">
        {COMPONENT_LABELS.map(([key, label, penalty]) => (
          <div className="bar-row" key={key}>
            <span>{label}</span>
            <div className="bar-track">
              <div
                className={`bar-fill ${penalty ? "penalty" : ""}`}
                style={{ width: `${Math.round(r.components[key] * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="footnote" style={{ marginTop: 8 }}>
        {r.rationaleOneLine}
      </p>
    </div>
  );
}

function SwarmReview({ consensus }: { consensus: SwarmConsensus }) {
  const sentry = consensus.lenses.filter((l) => l.tier === "sentry");
  const committee = consensus.lenses.filter((l) => l.tier === "committee");

  return (
    <section className="section">
      <div className="section-title">
        <span className="step-num">08</span> Mandatory adversarial swarm review
      </div>
      <div className="panel">
        <div className="swarm-head">
          <h2 style={{ margin: 0 }}>Hierarchical map-reduce panel</h2>
          <span className={`verdict-badge verdict-${consensus.verdict}`}>
            {consensus.verdict.toUpperCase()}
          </span>
        </div>
        <p className="footnote" style={{ marginTop: 0 }}>
          Producer-reviewer isolation · severity-weighted consensus ·{" "}
          {SWARM_LENS_COUNT} lenses · verification{" "}
          {consensus.verification.inputFingerprint}→
          {consensus.verification.outputFingerprint}
        </p>
        <div className="swarm-stages">
          {consensus.stages.map((s) => (
            <span key={s.stage} className="stage-chip" title={s.detail}>
              {s.stage}
            </span>
          ))}
        </div>
        <p className="footnote">{consensus.arbiter.rationale}</p>
        {consensus.arbiter.requiredPatches.length > 0 && (
          <div className="patch-list">
            <strong>Required patches:</strong>
            <ul>
              {consensus.arbiter.requiredPatches.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {consensus.arbiter.acceptedWarnings.length > 0 && (
          <div className="patch-list warn-list">
            <strong>Accepted warnings:</strong>
            <ul>
              {consensus.arbiter.acceptedWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <h3 className="swarm-tier-title">Sentry lenses (trusted-first)</h3>
        <LensGrid lenses={sentry} />
        <h3 className="swarm-tier-title">Committee lenses (deep audit)</h3>
        <LensGrid lenses={committee} />
        <p className="footnote">{consensus.summary}</p>
      </div>
    </section>
  );
}

function LensGrid({ lenses }: { lenses: SwarmConsensus["lenses"] }) {
  return (
    <div className="lens-grid">
      {lenses.map((lens) => (
        <div className="lens-card" key={lens.lens}>
          <div className="lens-top">
            <span className="lpersona">{lens.persona}</span>
            <span className={`lens-dot verdict-${lens.verdict}`}>{lens.verdict}</span>
          </div>
          {lens.findings.length === 0 ? (
            <p className="footnote" style={{ margin: "6px 0 0" }}>
              Cleared — no findings.
            </p>
          ) : (
            <ul>
              {lens.findings.map((f, i) => (
                <li key={i}>
                  <strong>{f.severity}:</strong> {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

const PIPELINE: Array<{ name: string; poweredBy: string; local: boolean }> = [
  { name: "Objective", poweredBy: "core", local: true },
  { name: "Public evidence", poweredBy: "public data", local: true },
  { name: "Construct hypothesis", poweredBy: "core", local: true },
  { name: "Mechanism route", poweredBy: "core", local: true },
  { name: "Physics simulation", poweredBy: "physics", local: true },
  { name: "Multimodal traces", poweredBy: "core", local: true },
  { name: "Design adapter", poweredBy: "design", local: false },
  { name: "Measurement handoff", poweredBy: "core", local: true },
  { name: "Swarm review", poweredBy: "swarm", local: true },
];

const ADAPTER_LAYERS: Array<{ layer: LibraryLayer; title: string }> = [
  { layer: "public_data", title: "Public evidence sources" },
  { layer: "retrieval", title: "Retrieval / embedding adapters" },
  { layer: "physics", title: "Physics simulation adapters" },
  { layer: "design_adapter", title: "Protein design adapters" },
];

const STATUS_LABEL: Record<LibraryStatus, string> = {
  installed: "running locally",
  optional_adapter: "optional adapter",
  documented_future: "documented / future",
  stubbed: "stubbed",
};

function EngineArchitecture() {
  return (
    <section className="section">
      <div className="section-title">
        <span className="step-num">09</span> Engine architecture &amp; research
        adapters
      </div>
      <div className="panel">
        <h2>The stack is a pipeline, not a model wrapper</h2>
        <p className="footnote" style={{ marginTop: 0 }}>
          The live demo runs the green stages locally, offline and deterministic.
          Heavy research tools are optional adapters that fail gracefully to safe
          demo fixtures — they are never required for the core flow.
        </p>
        <div className="pipeline">
          {PIPELINE.map((s, i) => (
            <Fragment key={s.name}>
              <div className={`pipe-step ${s.local ? "local" : ""}`}>
                <div className="pname">
                  <span className="pdot">{s.local ? "● " : "○ "}</span>
                  {s.name}
                </div>
                <div className="player">{s.poweredBy}</div>
              </div>
              {i < PIPELINE.length - 1 && <span className="pipe-arrow">→</span>}
            </Fragment>
          ))}
        </div>

        <div className="adapter-board">
          {ADAPTER_LAYERS.map((g) => (
            <div className="layer-group" key={g.layer}>
              <h4>{g.title}</h4>
              {librariesByLayer(g.layer).map((l) => (
                <div className="lib-row" key={l.name}>
                  <div>
                    <div className="lname">{l.name}</div>
                    <div className="lpurpose">{l.claimBoundary}</div>
                  </div>
                  <span className={`status-chip status-${l.currentStatus}`}>
                    {STATUS_LABEL[l.currentStatus]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="footnote">
          Core layer: {librariesByLayer("core").length} libraries ·{" "}
          {LIBRARY_REGISTRY.length} total registry entries. Embeddings are for
          public analog search only (never spin prediction); design models are
          handoffs, not the discovery engine. See{" "}
          <code>docs/LIBRARY_ROADMAP.md</code> and{" "}
          <code>docs/RESEARCH_ADAPTERS.md</code>.
        </p>
      </div>
    </section>
  );
}
