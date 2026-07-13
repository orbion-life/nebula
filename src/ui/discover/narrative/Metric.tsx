/**
 * A single normalized triage-axis bar (0 to 100). Shared by the measurement headline and the
 * per-candidate applied-constraints report so both read identically. `inverse` flips the fill
 * for axes where lower is better (uncertainty, cost) while keeping the printed number honest.
 * These are uncalibrated ordering heuristics, never probabilities, confidence, or performance.
 */
export function Metric({ label, value = 0, inverse = false }: { label: string; value?: number; inverse?: boolean }) {
  const display = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="atlas-metric">
      <span>{label}</span><strong>{display}</strong>
      <i><b style={{ width: `${inverse ? 100 - display : display}%` }} /></i>
    </div>
  );
}
