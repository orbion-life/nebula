/**
 * The objective interface — one ObjectiveSpec, two doors.
 *
 * Novice: "describe your application" free text → the service compiles it into a
 * structured, EDITABLE ObjectiveSpec sheet (nothing is hidden; every inferred
 * field is shown and can be corrected before a run starts).
 * Expert: the same sheet with structured controls exposed up front.
 *
 * The compile step is a deterministic rule-based parser on the server (no browser
 * API key). It never claims to be an LLM. After compile, the same editable sheet is
 * always shown before the run — so novices understand every field and experts can
 * change every assumption.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { compileObjective, getInstruments, type ObjectiveSpec, type UserMode } from "../../api/client";

const DEMO_NOVICE =
  "We are developing a transparent hydrogel patch and want a protein component that can report weak magnetic-field exposure through an optical signal at room temperature. We can measure fluorescence intensity and lifetime, but we do not have RF hardware. It should tolerate oxygen and remain useful after immobilization.";

interface Props {
  onRun: (spec: ObjectiveSpec) => void;
  offline?: boolean;
  disabled?: boolean;
}

// Test/CI seed only. The product runs ONLINE (live retrieval); offline is not a
// product feature. When the backend is in its deterministic offline test mode
// (NEBULA_OFFLINE=1, no network), these committed-fixture accessions seed the run so the
// E2E suite is deterministic. In production (online) this never fires.
const OFFLINE_TEST_SEEDS = ["Q8LPD9", "Q43125"];

type Instrument = { id: string; label?: string; readout_modes?: string[]; rf_available?: boolean };

export function ObjectivePanel({ onRun, offline, disabled }: Props) {
  const [mode, setMode] = useState<UserMode>("novice");
  const [text, setText] = useState(DEMO_NOVICE);
  const [spec, setSpec] = useState<ObjectiveSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getInstruments()
      .then((r) => setInstruments((r.instruments as Instrument[]) ?? []))
      .catch(() => setInstruments([]));
  }, []);

  // On compile, the extracted constraints resolve into place — purposeful motion that
  // shows the parse (gsap.from leaves elements visible if interrupted; skipped under
  // prefers-reduced-motion so all content and state remain without animation).
  useGSAP(() => {
    if (!spec || !sheetRef.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(sheetRef.current.querySelectorAll(".obj-field, .obj-sheet-head, .obj-run"), {
      opacity: 0, y: 8, duration: 0.4, stagger: 0.05, ease: "power2.out",
    });
  }, { dependencies: [spec?.objective_id], scope: sheetRef });

  const compile = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await compileObjective(text, mode);
      // Deterministic test mode only: the offline test backend has no live retrieval, so
      // seed the committed-fixture accessions. Never fires in the online product.
      if (offline && (!s.seed_accessions || s.seed_accessions.length === 0)) {
        s.seed_accessions = [...OFFLINE_TEST_SEEDS];
      }
      setSpec(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patch = (p: Partial<ObjectiveSpec>) => setSpec((s) => (s ? { ...s, ...p } : s));

  return (
    <div className="obj-panel">
      <div className="obj-modes" role="tablist" aria-label="objective mode">
        {(["novice", "expert"] as UserMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`obj-mode ${mode === m ? "on" : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "novice" ? "Describe your application" : "Configure scientifically"}
          </button>
        ))}
      </div>

      <label className="obj-label" htmlFor="obj-text">
        {mode === "novice" ? "In plain language, what should the protein report — and how will you measure it?" : "Objective (free text seeds the structured fields below)"}
      </label>
      <textarea
        id="obj-text"
        className="obj-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={mode === "novice" ? 5 : 3}
        spellCheck={false}
      />
      <div className="obj-actions">
        <button className="btn-primary" onClick={compile} disabled={busy || disabled}>
          {busy ? "compiling…" : spec ? "re-compile objective" : "compile objective"}
        </button>
        {err && <span className="obj-err">{err}</span>}
      </div>

      {spec && (
        <div className="obj-sheet" ref={sheetRef}>
          <div className="obj-sheet-head">
            <span>compiled objective — editable before the run</span>
            <code>{spec.objective_id}</code>
          </div>

          <div className="obj-grid">
            <Field label="sensed quantity / state">
              <input value={spec.sensed_quantity_or_state ?? ""} placeholder="(not stated)" onChange={(e) => patch({ sensed_quantity_or_state: e.target.value || null })} />
            </Field>
            <Field label="desired modalities">
              <span className="chips">{(spec.desired_modalities ?? []).map((m) => <span className="chip" key={m}>{m}</span>)}</span>
            </Field>
            <Field label="instrument">
              <select value={spec.instrument_id ?? ""} onChange={(e) => patch({ instrument_id: e.target.value || null })}>
                <option value="">(default: benchtop field fluorimeter)</option>
                {instruments.map((i) => (
                  <option key={i.id} value={i.id}>{i.label ?? i.id}{i.rf_available ? " · RF" : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="oxygen">
              <select value={spec.oxygen_condition} onChange={(e) => patch({ oxygen_condition: e.target.value as ObjectiveSpec["oxygen_condition"] })}>
                {["unknown", "aerobic", "controlled", "anaerobic"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>

            {mode === "expert" && (
              <>
                <Field label="temperature °C (min,max)">
                  <RangeInput value={spec.temperature_range_C} onChange={(v) => patch({ temperature_range_C: v })} />
                </Field>
                <Field label="static field mT (min,max)">
                  <RangeInput value={spec.static_field_range_mT} onChange={(v) => patch({ static_field_range_mT: v })} />
                </Field>
                <Field label="RF MHz (min,max)">
                  <RangeInput value={spec.rf_frequency_range_MHz} onChange={(v) => patch({ rf_frequency_range_MHz: v })} />
                </Field>
                <Field label="seed accessions (offline demo / expert seed)">
                  <input
                    value={(spec.seed_accessions ?? []).join(", ")}
                    placeholder="e.g. Q43125, Q8LPD9"
                    onChange={(e) => patch({ seed_accessions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                </Field>
                <Field label="explore unreviewed (TrEMBL)">
                  <input type="checkbox" checked={spec.include_unreviewed} onChange={(e) => patch({ include_unreviewed: e.target.checked })} />
                </Field>
                <Field label="seed (reproducibility)">
                  <input type="number" value={spec.seed} onChange={(e) => patch({ seed: Number(e.target.value) || 1337 })} />
                </Field>
              </>
            )}
          </div>

          {(spec.missing_information ?? []).length > 0 && (
            <div className="obj-missing">
              <strong>needs clarification:</strong> {(spec.missing_information ?? []).join(" · ")}
            </div>
          )}

          {offline && (spec.seed_accessions ?? []).length > 0 && mode === "novice" && (
            <div className="obj-seeds">
              offline mode — seeded with real fixtured accessions:{" "}
              {(spec.seed_accessions ?? []).map((a) => <span className="chip" key={a}>{a}</span>)}
            </div>
          )}

          <div className="obj-run">
            <button className="btn-run" onClick={() => spec && onRun(spec)} disabled={disabled}>
              run discovery →
            </button>
            <span className="obj-hint">retrieves real public proteins · simulates · ranks. outputs are unvalidated candidate hypotheses.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="obj-field">
      <span className="obj-field-label">{label}</span>
      {children}
    </div>
  );
}

function RangeInput({ value, onChange }: { value: number[] | null | undefined; onChange: (v: [number, number] | null) => void }) {
  const [lo, hi] = value ?? [NaN, NaN];
  const set = (i: 0 | 1, raw: string) => {
    const n = Number(raw);
    const cur: [number, number] = [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : 0];
    cur[i] = n;
    onChange(Number.isFinite(cur[0]) && Number.isFinite(cur[1]) ? cur : null);
  };
  return (
    <span className="range-input">
      <input type="number" value={Number.isFinite(lo) ? lo : ""} placeholder="min" onChange={(e) => set(0, e.target.value)} />
      <input type="number" value={Number.isFinite(hi) ? hi : ""} placeholder="max" onChange={(e) => set(1, e.target.value)} />
    </span>
  );
}
