/**
 * The Mission Bench — the gamified objective builder that REPLACES the text form.
 *
 * You assemble the thing you are building (product -> material_context), state what it must
 * SENSE (-> sensed_quantity_or_state) and where it must SURVIVE (environment fields). You never
 * say how to measure it: the MEASURE slot stays deliberately empty (the app proposes it), and
 * the protein slot stays an empty scaffold socket until you dive. Every pick writes a real
 * ObjectiveSpec field; the free text panel remains one click away for experts.
 *
 * Copy rule: no dashes, no hyphens in on screen content.
 */
import { useMemo, useState } from "react";
import { compileObjective, type ObjectiveSpec } from "../../../api/client";

type Mat = ObjectiveSpec["material_context"];
type Oxy = ObjectiveSpec["oxygen_condition"];

interface Product {
  id: Mat;
  label: string;
  sub: string;
  desc: string;
  shape: "patch" | "film" | "chip" | "droplet" | "cell" | "gel";
}
const PRODUCTS: Product[] = [
  { id: "wearable", label: "patch", sub: "wearable", desc: "a wearable patch", shape: "patch" },
  { id: "film", label: "film", sub: "thin film", desc: "a thin film", shape: "film" },
  { id: "chip", label: "chip", sub: "sensor chip", desc: "a sensor chip", shape: "chip" },
  { id: "solution", label: "droplet", sub: "in solution", desc: "a solution assay", shape: "droplet" },
  { id: "cell", label: "cell", sub: "living cell", desc: "a cell based reporter", shape: "cell" },
  { id: "hydrogel", label: "gel", sub: "hydrogel", desc: "a hydrogel", shape: "gel" },
];

interface SenseTarget {
  value: "magnetic field" | "radio-frequency field" | "redox potential" | "light history";
  label: string;
}

export function readoutsForSense(value: SenseTarget["value"]): NonNullable<ObjectiveSpec["desired_modalities"]> {
  switch (value) {
    case "magnetic field":
    case "radio-frequency field":
      return ["RF_magnetic", "fluorescence"];
    case "redox potential":
      return ["redox_electrochemical", "fluorescence"];
    case "light history":
      return ["fluorescence", "lifetime"];
  }
}
const SENSES: SenseTarget[] = [
  { value: "magnetic field", label: "weak magnetic field" },
  { value: "radio-frequency field", label: "radio frequency field" },
  { value: "redox potential", label: "redox potential" },
  { value: "light history", label: "light history" },
];

const TEMPS: { id: string; label: string; range: [number, number] }[] = [
  { id: "body", label: "body warm", range: [33, 39] },
  { id: "room", label: "room", range: [18, 26] },
  { id: "cold", label: "cold", range: [2, 8] },
];
const OXY: { id: Oxy; label: string }[] = [
  { id: "aerobic", label: "oxygen ok" },
  { id: "controlled", label: "controlled" },
  { id: "anaerobic", label: "no oxygen" },
];

interface Blueprint {
  name: string;
  product: Mat;
  sense: SenseTarget["value"];
  temp: string;
  oxy: Oxy;
  locked: boolean;
}
const BLUEPRINTS: Blueprint[] = [
  { name: "wearable field patch", product: "wearable", sense: "magnetic field", temp: "body", oxy: "aerobic", locked: true },
  { name: "hydrogel redox film", product: "hydrogel", sense: "redox potential", temp: "room", oxy: "controlled", locked: true },
  { name: "light history reporter", product: "cell", sense: "light history", temp: "body", oxy: "aerobic", locked: false },
];

const OFFLINE_TEST_SEEDS = ["Q8LPD9", "Q43125", "P28861"];

/** A cheap, elegant platinum silhouette of the chosen product form. */
function ProductGlyph({ shape }: { shape: Product["shape"] }) {
  const stroke = "var(--d-amber)";
  const common = { fill: "none", stroke, strokeWidth: 1.4 } as const;
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden>
      {shape === "patch" && <rect x="26" y="24" width="68" height="42" rx="12" {...common} />}
      {shape === "film" && <rect x="20" y="38" width="80" height="14" rx="4" {...common} />}
      {shape === "chip" && (
        <g {...common}>
          <rect x="38" y="28" width="44" height="34" rx="4" />
          {[34, 46, 58].map((y) => (
            <line key={`l${y}`} x1="30" y1={y} x2="38" y2={y} />
          ))}
          {[34, 46, 58].map((y) => (
            <line key={`r${y}`} x1="82" y1={y} x2="90" y2={y} />
          ))}
        </g>
      )}
      {shape === "droplet" && <path d="M60 22 C74 40 78 52 60 64 C42 52 46 40 60 22 Z" {...common} />}
      {shape === "cell" && (
        <g {...common}>
          <ellipse cx="60" cy="45" rx="30" ry="22" />
          <circle cx="60" cy="45" r="8" />
        </g>
      )}
      {shape === "gel" && <rect x="30" y="26" width="60" height="38" rx="19" {...common} />}
    </svg>
  );
}

export function MissionBench({
  onRun,
  offline,
  onTypeInstead,
}: {
  onRun: (spec: ObjectiveSpec) => void;
  offline?: boolean;
  onTypeInstead: () => void;
}) {
  const [product, setProduct] = useState<Mat>("wearable");
  const [sense, setSense] = useState<SenseTarget["value"]>("magnetic field");
  const [temp, setTemp] = useState<string>("body");
  const [oxy, setOxy] = useState<Oxy>("aerobic");
  const [locked, setLocked] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const productDesc = PRODUCTS.find((p) => p.id === product)?.desc ?? "a device";
  const tempLabel = TEMPS.find((t) => t.id === temp)?.label ?? "room";
  const oxyLabel = OXY.find((o) => o.id === oxy)?.label ?? "oxygen ok";
  const senseLabel = SENSES.find((s) => s.value === sense)?.label ?? sense;

  const sentence = useMemo(
    () =>
      `${productDesc} that senses ${senseLabel}, holding up ${tempLabel === "room" ? "at room temperature" : tempLabel === "cold" ? "in the cold" : "at body warmth"}, ${oxyLabel === "no oxygen" ? "without oxygen" : oxyLabel === "controlled" ? "under controlled oxygen" : "with oxygen around"}, ${locked ? "locked in place" : "free floating"}.`,
    [productDesc, senseLabel, tempLabel, oxyLabel, locked],
  );

  const applyBlueprint = (b: Blueprint) => {
    setProduct(b.product);
    setSense(b.sense);
    setTemp(b.temp);
    setOxy(b.oxy);
    setLocked(b.locked);
  };

  const dive = async () => {
    setBusy(true);
    setErr(null);
    try {
      const range = TEMPS.find((t) => t.id === temp)?.range ?? null;
      const text = `We are building ${sentence}`;
      const spec = await compileObjective(text, "novice");
      // the bench selections are authoritative: write them onto the compiled spec
      spec.material_context = product;
      spec.sensed_quantity_or_state = sense;
      spec.oxygen_condition = oxy;
      spec.temperature_range_C = range;
      spec.immobilization_or_integration = locked ? "immobilized, locked in place" : "free floating";
      spec.desired_modalities = readoutsForSense(sense);
      spec.acceptable_readouts = [...spec.desired_modalities];
      spec.objective_support = "supported";
      spec.objective_support_note = "The sensing target drives mechanism route retrieval in this build.";
      if (offline && (!spec.seed_accessions || spec.seed_accessions.length === 0)) {
        spec.seed_accessions = [...OFFLINE_TEST_SEEDS];
      }
      onRun(spec);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mb">
      <div className="mb-blueprints">
        <span className="mb-eyebrow">start from an example</span>
        <div className="mb-bp-row">
          {BLUEPRINTS.map((b) => (
            <button key={b.name} className="mb-bp" onClick={() => applyBlueprint(b)}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-grid">
        <section className="mb-build">
          <span className="mb-eyebrow">the thing you are building · experiment handoff</span>
          <span className="mb-field-note">Product form records deployment context; it does not change candidate ranking in this build.</span>
          <div className="mb-preview">
            <ProductGlyph shape={PRODUCTS.find((p) => p.id === product)?.shape ?? "patch"} />
          </div>
          <div className="mb-forms" role="group" aria-label="product form for experiment handoff">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                className={`mb-form ${product === p.id ? "on" : ""}`}
                onClick={() => setProduct(p.id)}
                aria-pressed={product === p.id}
              >
                <span className="mb-form-label">{p.label}</span>
                <span className="mb-form-sub">{p.sub}</span>
              </button>
            ))}
          </div>

          <div className="mb-socket">
            <span className="mb-socket-ring" aria-hidden />
            <span className="mb-socket-text">
              the candidate you will discover, or invent, appears when you dive
            </span>
          </div>
        </section>

        <section className="mb-job">
          <div className="mb-block">
            <span className="mb-eyebrow">sense · drives the mechanism search</span>
            <div className="mb-chips" role="group" aria-label="sensing target that drives the search">
              {SENSES.map((s) => (
                <button
                  key={s.value}
                  className={`mb-chip ${sense === s.value ? "on" : ""}`}
                  onClick={() => setSense(s.value)}
                  aria-pressed={sense === s.value}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-block">
            <span className="mb-eyebrow">survive · recorded for the experiment handoff</span>
            <span className="mb-field-note">These conditions do not change candidate ranking in this build.</span>
            <div className="mb-gauges">
              <div className="mb-gauge-row" role="group" aria-label="temperature context for handoff">
                {TEMPS.map((t) => (
                  <button key={t.id} className={`mb-chip ${temp === t.id ? "on" : ""}`} onClick={() => setTemp(t.id)} aria-pressed={temp === t.id}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mb-gauge-row" role="group" aria-label="oxygen context for handoff">
                {OXY.map((o) => (
                  <button key={o.id} className={`mb-chip ${oxy === o.id ? "on" : ""}`} onClick={() => setOxy(o.id)} aria-pressed={oxy === o.id}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="mb-gauge-row" role="group" aria-label="immobilization context for handoff">
                <button className={`mb-chip ${locked ? "on" : ""}`} onClick={() => setLocked(true)} aria-pressed={locked}>
                  locked in place
                </button>
                <button className={`mb-chip ${!locked ? "on" : ""}`} onClick={() => setLocked(false)} aria-pressed={!locked}>
                  free floating
                </button>
              </div>
            </div>
          </div>

          <div className="mb-measure">
            <span className="mb-eyebrow">measure</span>
            <span className="mb-measure-text">proposed by Nebula, not by you</span>
          </div>
        </section>
      </div>

      <div className="mb-reads">
        <span className="mb-reads-label">reads as</span> {sentence}
      </div>

      <div className="mb-actions">
        <button className="btn-run" onClick={dive} disabled={busy}>
          {busy ? "diving…" : "take the dive ↓"}
        </button>
        <button className="mb-type" onClick={onTypeInstead}>
          type it instead
        </button>
        {err && <span className="obj-err">{err}</span>}
      </div>
    </div>
  );
}
