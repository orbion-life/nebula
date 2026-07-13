/**
 * Cinematic objective builder.
 *
 * The page is not a form-first dashboard. It starts with a sensing world, lets
 * users layer multiple readout modalities, then turns the result into the same
 * ObjectiveSpec contract used by the discovery backend.
 */
import { useEffect, useMemo, useState } from "react";
import { compileObjective, type ObjectiveSpec } from "../../../api/client";

type Mat = ObjectiveSpec["material_context"];
type Oxy = ObjectiveSpec["oxygen_condition"];
type Modality = NonNullable<ObjectiveSpec["desired_modalities"]>[number];

interface Product {
  id: Mat;
  label: string;
  sub: string;
  desc: string;
  shape: "patch" | "film" | "chip" | "droplet" | "cell" | "gel";
}

const PRODUCTS: Product[] = [
  { id: "wearable", label: "Patch", sub: "skin or field", desc: "a wearable field patch", shape: "patch" },
  { id: "film", label: "Film", sub: "soft material", desc: "an optically active thin film", shape: "film" },
  { id: "chip", label: "Chip", sub: "bioelectronic", desc: "a sensor chip", shape: "chip" },
  { id: "solution", label: "Droplet", sub: "assay", desc: "a solution assay", shape: "droplet" },
  { id: "cell", label: "Cell", sub: "living system", desc: "a living cell reporter", shape: "cell" },
  { id: "hydrogel", label: "Gel", sub: "biomaterial", desc: "a responsive hydrogel", shape: "gel" },
];

interface SenseTarget {
  value: "magnetic field" | "radio-frequency field" | "redox potential" | "light history" | "optical spin contrast";
  label: string;
  cue: string;
}

const SENSES: SenseTarget[] = [
  { value: "magnetic field", label: "Magnetic field", cue: "weak field response" },
  { value: "radio-frequency field", label: "RF field", cue: "frequency selective response" },
  { value: "redox potential", label: "Redox state", cue: "electron transfer context" },
  { value: "light history", label: "Light history", cue: "photochemical memory" },
  { value: "optical spin contrast", label: "Optical spin contrast", cue: "spin dependent optical readout" },
];

const MODALITIES: { id: Modality; label: string; sub: string }[] = [
  { id: "fluorescence", label: "Fluorescence", sub: "brightness shift" },
  { id: "lifetime", label: "Lifetime", sub: "time resolved signal" },
  { id: "RF_magnetic", label: "RF magnetic", sub: "field or resonance contrast" },
  { id: "ODMR_like", label: "ODMR like", sub: "optical spin contrast" },
  { id: "redox_electrochemical", label: "Redox", sub: "electrode or chemical readout" },
  { id: "material_state", label: "Material state", sub: "swelling, stiffness, matrix" },
];

export function readoutsForSense(value: SenseTarget["value"]): Modality[] {
  switch (value) {
    case "magnetic field":
      return ["RF_magnetic", "fluorescence"];
    case "radio-frequency field":
      return ["RF_magnetic", "ODMR_like", "fluorescence"];
    case "redox potential":
      return ["redox_electrochemical", "fluorescence"];
    case "light history":
      return ["fluorescence", "lifetime"];
    case "optical spin contrast":
      return ["ODMR_like", "fluorescence", "lifetime"];
  }
}

const TEMPS: { id: string; label: string; range: [number, number] }[] = [
  { id: "body", label: "Body warmth", range: [33, 39] },
  { id: "room", label: "Room stable", range: [18, 26] },
  { id: "cold", label: "Cold chain", range: [2, 8] },
];

const OXY: { id: Oxy; label: string }[] = [
  { id: "aerobic", label: "Oxygen present" },
  { id: "controlled", label: "Controlled oxygen" },
  { id: "anaerobic", label: "Low oxygen" },
];

interface MissionWorld {
  id: string;
  mood: "bio" | "cell" | "field" | "redox" | "light";
  label: string;
  title: string;
  line: string;
  product: Mat;
  sense: SenseTarget["value"];
  modalities: Modality[];
  temp: string;
  oxy: Oxy;
  integrated: boolean;
  domain: string;
  intent: string;
}

const WORLDS: MissionWorld[] = [
  {
    id: "biomaterial-film",
    mood: "bio",
    label: "Biomaterial",
    title: "Responsive living material",
    line: "Hydrogels, films, soft interfaces.",
    product: "hydrogel",
    sense: "redox potential",
    modalities: ["redox_electrochemical", "fluorescence", "material_state"],
    temp: "room",
    oxy: "controlled",
    integrated: true,
    domain: "biomaterials",
    intent: "discover multimodal protein constructs for a responsive biomaterial",
  },
  {
    id: "cancer-cell-monitor",
    mood: "cell",
    label: "Cancer cell",
    title: "Inside a living cell",
    line: "Optical monitoring inside living cells.",
    product: "cell",
    sense: "optical spin contrast",
    modalities: ["ODMR_like", "fluorescence", "lifetime"],
    temp: "body",
    oxy: "aerobic",
    integrated: false,
    domain: "cell monitoring",
    intent: "prioritize protein constructs for spin linked optical monitoring in cells",
  },
  {
    id: "wearable-field",
    mood: "field",
    label: "Field patch",
    title: "A wearable field reporter",
    line: "Surface formats for magnetic or RF response.",
    product: "wearable",
    sense: "magnetic field",
    modalities: ["RF_magnetic", "fluorescence"],
    temp: "body",
    oxy: "aerobic",
    integrated: true,
    domain: "wearable sensing",
    intent: "find protein constructs that may justify field sensitive measurement",
  },
  {
    id: "bioelectronic-redox",
    mood: "redox",
    label: "Bioelectronic",
    title: "Protein meets electrode",
    line: "Optical and electrochemical chip readouts.",
    product: "chip",
    sense: "redox potential",
    modalities: ["redox_electrochemical", "fluorescence"],
    temp: "room",
    oxy: "controlled",
    integrated: true,
    domain: "bioelectronics",
    intent: "rank constructs for a redox coupled bioelectronic sensor",
  },
  {
    id: "light-memory",
    mood: "light",
    label: "Light memory",
    title: "A photochemical history reporter",
    line: "Photochemical memory as optical output.",
    product: "film",
    sense: "light history",
    modalities: ["fluorescence", "lifetime"],
    temp: "room",
    oxy: "aerobic",
    integrated: true,
    domain: "optical materials",
    intent: "search for protein constructs that can report light history",
  },
];

// Public, recorded fixtures spanning LOV, cryptochrome, redox, and fluorescent-protein routes.
// Keeping every Mission Bench world on this bounded set makes the offline demo reproducible.
const OFFLINE_TEST_SEEDS = ["Q8LPD9", "Q43125", "P28861", "P42212"];

type Stage = "world" | "signals" | "survival";
const STAGE_FLOW: Stage[] = ["world", "signals", "survival"];
// one line per stage explaining what the choice actually changes in the discovery search,
// so a non-expert can build an objective without guessing.
const STAGE_GUIDE: Record<Stage, { eyebrow: string; title: string; guide: string }> = {
  world: {
    eyebrow: "world",
    title: "Pick its world.",
    guide: "The world sets the starting mechanism, the defaults, and where the sensor must live. It steers which proteins the scan reaches for first.",
  },
  signals: {
    eyebrow: "signals",
    title: "Layer the signal.",
    guide: "The sensing target chooses the mechanism route the scan searches; each added readout widens which proteins can qualify. These choices rank the shortlist.",
  },
  survival: {
    eyebrow: "survival",
    title: "Set the constraints.",
    guide: "Format, temperature, oxygen, and integration travel with your measurement handoff. They describe the bench, they do not rank candidates.",
  },
};

function ProductGlyph({ shape }: { shape: Product["shape"] }) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden>
      {shape === "patch" && (
        <g {...common}>
          <rect x="26" y="22" width="68" height="46" rx="16" />
          <rect x="37" y="33" width="46" height="24" rx="11" opacity="0.45" />
          <circle cx="60" cy="45" r="6.5" />
          <circle cx="60" cy="45" r="1.7" fill={stroke} stroke="none" />
        </g>
      )}
      {shape === "film" && (
        <g {...common}>
          <path d="M18 50 C38 34 76 66 102 40" />
          <path d="M22 58 C42 42 76 72 98 50" opacity="0.55" />
        </g>
      )}
      {shape === "chip" && (
        <g {...common}>
          <rect x="38" y="28" width="44" height="34" rx="4" />
          {[34, 46, 58].map((y) => <line key={`l${y}`} x1="30" y1={y} x2="38" y2={y} />)}
          {[34, 46, 58].map((y) => <line key={`r${y}`} x1="82" y1={y} x2="90" y2={y} />)}
        </g>
      )}
      {shape === "droplet" && <path d="M60 18 C78 42 80 58 60 70 C40 58 42 42 60 18 Z" {...common} />}
      {shape === "cell" && (
        <g {...common}>
          <ellipse cx="60" cy="45" rx="33" ry="23" />
          <circle cx="60" cy="45" r="8" />
          <path d="M38 42 C48 34 65 36 78 48" opacity="0.5" />
        </g>
      )}
      {shape === "gel" && (
        <g {...common}>
          <rect x="28" y="26" width="64" height="38" rx="19" />
          <path d="M40 45 C48 37 58 54 68 43 C76 34 82 48 88 42" opacity="0.6" />
        </g>
      )}
    </svg>
  );
}

function currentProduct(id: Mat): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}

function senseLabel(value: SenseTarget["value"]): string {
  return SENSES.find((s) => s.value === value)?.label ?? value;
}

function uniqModalities(values: Modality[]): Modality[] {
  return MODALITIES.map((m) => m.id).filter((id) => values.includes(id));
}

export function MissionBench({
  onRun,
  offline,
}: {
  onRun: (spec: ObjectiveSpec) => void;
  offline?: boolean;
}) {
  const [stage, setStage] = useState<Stage>("world");
  const [worldId, setWorldId] = useState(WORLDS[0].id);
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const [product, setProduct] = useState<Mat>(world.product);
  const [sense, setSense] = useState<SenseTarget["value"]>(world.sense);
  const [modalities, setModalities] = useState<Modality[]>(world.modalities);
  const [temp, setTemp] = useState<string>(world.temp);
  const [oxy, setOxy] = useState<Oxy>(world.oxy);
  const [integrated, setIntegrated] = useState<boolean>(world.integrated);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedProduct = currentProduct(product);
  const tempLabel = TEMPS.find((t) => t.id === temp)?.label ?? "Room stable";
  const oxyLabel = OXY.find((o) => o.id === oxy)?.label ?? "Oxygen present";
  const modalityLabels = uniqModalities(modalities).map((m) => MODALITIES.find((item) => item.id === m)?.label ?? m);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nebula:world-mood", { detail: { mood: world.mood } }));
  }, [world.mood]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const t = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      document.documentElement.style.setProperty("--discover-scroll", t.toFixed(3));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sentence = useMemo(() => {
    const modeText = modalityLabels.length > 1 ? modalityLabels.join(" plus ") : modalityLabels[0] ?? "optical readout";
    return `${selectedProduct.desc} for ${senseLabel(sense).toLowerCase()} using ${modeText.toLowerCase()}, ${tempLabel.toLowerCase()}, ${oxyLabel.toLowerCase()}, ${integrated ? "immobilized" : "free in solution"}.`;
  }, [selectedProduct.desc, sense, modalityLabels, tempLabel, oxyLabel, integrated]);

  const chooseWorld = (next: MissionWorld) => {
    setWorldId(next.id);
    setProduct(next.product);
    setSense(next.sense);
    setModalities(next.modalities);
    setTemp(next.temp);
    setOxy(next.oxy);
    setIntegrated(next.integrated);
    setStage("signals");
  };

  const chooseSense = (value: SenseTarget["value"]) => {
    setSense(value);
    setModalities((prev) => uniqModalities([...readoutsForSense(value), ...prev.filter((m) => m === "material_state")]));
  };

  const toggleModality = (value: Modality) => {
    setModalities((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((m) => m !== value);
        return next.length ? next : prev;
      }
      return uniqModalities([...prev, value]);
    });
  };

  const goNext = () => {
    const i = STAGE_FLOW.indexOf(stage);
    if (i >= 0 && i < STAGE_FLOW.length - 1) setStage(STAGE_FLOW[i + 1]);
  };
  const stageIndex = STAGE_FLOW.indexOf(stage);

  const dive = async () => {
    setBusy(true);
    setErr(null);
    try {
      const range = TEMPS.find((t) => t.id === temp)?.range ?? null;
      const text = `Explore ${sentence}`;
      const spec = await compileObjective(text, "novice");
      spec.application_domain = world.domain;
      spec.intended_function = world.intent;
      spec.material_context = product;
      spec.sensed_quantity_or_state = sense;
      spec.oxygen_condition = oxy;
      spec.temperature_range_C = range;
      spec.immobilization_or_integration = integrated ? "immobilized or matrix integrated" : "free floating or intracellular";
      spec.desired_modalities = uniqModalities(modalities);
      spec.acceptable_readouts = [...spec.desired_modalities];
      spec.objective_support = "supported";
      spec.objective_support_note = "The sensing target selects the mechanism route; selected modalities define the readouts to test.";
      spec.handoff_only_fields = Array.from(new Set([...(spec.handoff_only_fields ?? []), "material_context", "temperature_range_C", "oxygen_condition"]));
      spec.decision_active_fields = Array.from(new Set([...(spec.decision_active_fields ?? []), "sensed_quantity_or_state", "desired_modalities"]));
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
    <div className={`mb mb-${world.mood}`}>
      <div className="mb-aura" aria-hidden />
      <div className="mb-life" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => <span key={i} />)}
      </div>
      <div className="mb-orbit" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <div className="mb-nav" aria-label="objective builder steps">
        {STAGE_FLOW.map((id, i) => {
          const label = id.charAt(0).toUpperCase() + id.slice(1);
          const done = i < stageIndex;
          return (
            <button
              key={id}
              className={`mb-nav-item ${stage === id ? "on" : ""} ${done ? "done" : ""}`}
              onClick={() => setStage(id)}
              aria-pressed={stage === id}
            >
              <span className="mb-nav-n" aria-hidden>{done ? "✓" : i + 1}</span>
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-stage">
        {stage === "world" && (
          <section className="mb-scene">
            <div className="mb-stage-copy">
              <span className="mb-eyebrow">world</span>
              <h2>Pick its world.</h2>
              <p>{STAGE_GUIDE.world.guide}</p>
            </div>
            <div className="mb-world-grid">
              {WORLDS.map((w) => (
                <button
                  key={w.id}
                  className={`mb-world mb-world-${w.mood} ${worldId === w.id ? "on" : ""}`}
                  onClick={() => chooseWorld(w)}
                  aria-pressed={worldId === w.id}
                >
                  <span className="mb-world-glyph" aria-hidden>
                    <ProductGlyph shape={currentProduct(w.product).shape} />
                  </span>
                  <span className="mb-world-label">{w.label}</span>
                  <span className="mb-world-title">{w.title}</span>
                  <span className="mb-world-line">{w.line}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {stage === "signals" && (
          <section className="mb-scene mb-scene-split">
            <div className="mb-stage-copy">
              <span className="mb-eyebrow">signals</span>
              <h2>Layer the signal.</h2>
              <p>{STAGE_GUIDE.signals.guide}</p>
            </div>
            <div className="mb-signal-board">
              <span className="mb-group-label">What to sense <em>pick one, it sets the mechanism route</em></span>
              <div className="mb-sense-grid" role="group" aria-label="sensing target">
                {SENSES.map((s) => (
                  <button
                    key={s.value}
                    className={`mb-sense ${sense === s.value ? "on" : ""}`}
                    onClick={() => chooseSense(s.value)}
                    aria-pressed={sense === s.value}
                  >
                    <span>{s.label}</span>
                    <small>{s.cue}</small>
                  </button>
                ))}
              </div>
              <span className="mb-group-label">How it is read out <em>layer any that apply</em></span>
              <div className="mb-modality-grid" role="group" aria-label="readout modalities">
                {MODALITIES.map((m) => (
                  <button
                    key={m.id}
                    className={`mb-modality ${modalities.includes(m.id) ? "on" : ""}`}
                    onClick={() => toggleModality(m.id)}
                    aria-pressed={modalities.includes(m.id)}
                  >
                    <span>{m.label}</span>
                    <small>{m.sub}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {stage === "survival" && (
          <section className="mb-scene mb-scene-split">
            <div className="mb-stage-copy">
              <span className="mb-eyebrow">survival</span>
              <h2>Set the constraints.</h2>
              <p>{STAGE_GUIDE.survival.guide}</p>
            </div>
            <div className="mb-condition-board">
              <div className="mb-product-card">
                <ProductGlyph shape={selectedProduct.shape} />
                <div>
                  <span>{selectedProduct.label}</span>
                  <small>{selectedProduct.sub}</small>
                </div>
              </div>
              <span className="mb-group-label">Form factor <em>pick one, where the sensor lives</em></span>
              <div className="mb-forms" role="group" aria-label="product form">
                {PRODUCTS.map((p) => (
                  <button key={p.id} className={`mb-form ${product === p.id ? "on" : ""}`} onClick={() => setProduct(p.id)} aria-pressed={product === p.id}>
                    <span className="mb-form-label">{p.label}</span>
                    <span className="mb-form-sub">{p.sub}</span>
                  </button>
                ))}
              </div>
              <div className="mb-gauges">
                <span className="mb-group-label">Operating conditions <em>pick one per row</em></span>
                <div className="mb-gauge-row" role="group" aria-label="temperature">
                  <span className="mb-gauge-label">Temperature</span>
                  {TEMPS.map((t) => (
                    <button key={t.id} className={`mb-chip ${temp === t.id ? "on" : ""}`} onClick={() => setTemp(t.id)} aria-pressed={temp === t.id}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="mb-gauge-row" role="group" aria-label="oxygen">
                  <span className="mb-gauge-label">Oxygen</span>
                  {OXY.map((o) => (
                    <button key={o.id} className={`mb-chip ${oxy === o.id ? "on" : ""}`} onClick={() => setOxy(o.id)} aria-pressed={oxy === o.id}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="mb-gauge-row" role="group" aria-label="integration">
                  <span className="mb-gauge-label">Placement</span>
                  <button className={`mb-chip ${integrated ? "on" : ""}`} onClick={() => setIntegrated(true)} aria-pressed={integrated}>Matrix integrated</button>
                  <button className={`mb-chip ${!integrated ? "on" : ""}`} onClick={() => setIntegrated(false)} aria-pressed={!integrated}>Free moving</button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="mb-summary">
        <span className="mb-summary-label">mission</span>
        <div className="mb-summary-chips" aria-label={sentence}>
          <span><b>{selectedProduct.label}</b>{senseLabel(sense)}</span>
          <span><b>Readouts</b>{modalityLabels.join(" + ")}</span>
          <span><b>Context</b>{tempLabel} · {oxyLabel} · {integrated ? "Integrated" : "Free moving"}</span>
        </div>
      </div>

      <div className={`mb-actions ${stage === "survival" ? "mb-actions-final" : ""}`}>
        {stage !== "survival" && (
          <button className="btn-primary mb-continue" onClick={goNext}>
            continue to {stage === "world" ? "signals" : "survival"} →
          </button>
        )}
        {stage !== "world" && (
          <button className="btn-run" onClick={dive} disabled={busy}>
            {busy ? "discovering…" : "discover constructs"}
          </button>
        )}
        {err && <span className="obj-err">{err}</span>}
      </div>
    </div>
  );
}
