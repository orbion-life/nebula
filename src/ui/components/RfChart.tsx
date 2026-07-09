/**
 * RF-resonance chart (raw SVG). Normalized fluorescence contrast vs RF
 * frequency, from the static-Hamiltonian eigen-gaps. A flat B1=0 control line
 * shows the response is a real resonance, not a scalar gain.
 */
interface Props {
  freq: number[];
  contrast: number[];
  control: number[];
}

const W = 720;
const H = 200;
const M = { top: 16, right: 90, bottom: 40, left: 52 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

export function RfChart({ freq, contrast, control }: Props) {
  const fMax = Math.max(...freq);
  const lo = Math.min(...contrast, 0);
  const hi = Math.max(...contrast, 0.02);
  const xPix = (f: number) => (f / fMax) * IW;
  const yPix = (v: number) => IH - ((v - lo) / (hi - lo || 1)) * IH;
  const path = (ys: number[]) =>
    freq.map((f, i) => `${i === 0 ? "M" : "L"}${xPix(f).toFixed(1)},${yPix(ys[i]).toFixed(1)}`).join(" ");

  let dipIdx = 0;
  for (let i = 0; i < contrast.length; i++) if (contrast[i] < contrast[dipIdx]) dipIdx = i;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label="Simulated fluorescence contrast versus radio-frequency, showing a resonance dip"
      style={{ display: "block", maxWidth: "100%" }}>
      <g transform={`translate(${M.left},${M.top})`}>
        <line x1={0} x2={IW} y1={yPix(0)} y2={yPix(0)} stroke="#cbd5e0" />
        {/* B1=0 control (flat) */}
        <path d={path(control)} fill="none" stroke="#9a5b2f" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.8} />
        <text x={IW + 4} y={yPix(0) + 3} fontSize={10.5} fontFamily="var(--sans)" fill="#9a5b2f">RF off (flat)</text>
        {/* resonance */}
        <path d={path(contrast)} fill="none" stroke="#1a202c" strokeWidth={2.2} />
        <circle cx={xPix(freq[dipIdx])} cy={yPix(contrast[dipIdx])} r={3.5} fill="#8a2f2f" />
        <text x={xPix(freq[dipIdx]) + 6} y={yPix(contrast[dipIdx]) + 4} fontSize={11} fontFamily="var(--sans)" fill="#8a2f2f">
          resonance ≈ {freq[dipIdx].toFixed(0)} MHz
        </text>
        {[0, 30, 60, 90, 120].filter((t) => t <= fMax).map((t) => (
          <g key={t}>
            <line x1={xPix(t)} x2={xPix(t)} y1={IH} y2={IH + 4} stroke="#a0aec0" />
            <text x={xPix(t)} y={IH + 16} textAnchor="middle" fontSize={10} fontFamily="var(--mono)" fill="#718096">{t}</text>
          </g>
        ))}
        <text x={IW / 2} y={IH + 34} textAnchor="middle" fontSize={11} fontFamily="var(--sans)" fill="#4a5568">
          RF frequency (MHz)
        </text>
      </g>
    </svg>
  );
}
