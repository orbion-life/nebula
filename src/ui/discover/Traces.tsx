/**
 * Candidate physics trace — Tufte small-multiples (raw SVG, no legend, no gridlines).
 *
 * Two panels on SEPARATE scales (never co-plotted — different units, and co-plotting a
 * scalar spin on the mfe% axis would read as a per-protein response prediction):
 *  1. REFERENCE MARY curve + ±1σ ensemble band from the versioned RadicalPy artifact — a
 *     synthetic assumption sweep, NOT a prediction of this protein.
 *  2. This candidate's OWN computed number — the max Mulliken spin from the UHF calculation
 *     on its extracted isoalloxazine — drawn as a point with its ±range interval on a
 *     dynamically scaled axis. Mulliken populations are basis dependent and are not
 *     probabilities, so they must never be clamped to a 0–1 interval.
 * Only rendered for spin-dynamics-eligible candidates (the caller gates it).
 */
import artifact from "../../data/generated/radical_pair_mary.v1.json";
import { PALETTE } from "./render/palette";

type SpinParam = { value: number; range: [number, number] | null; uncertainty: string | null };

interface Props {
  spin?: SpinParam | null;
  candidateSpecific?: boolean;
  candidateLabel?: string;
}

const W = 640;
const H = 300;
const M = { top: 26, right: 120, bottom: 40, left: 52 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

export function Traces({ spin, candidateSpecific, candidateLabel }: Props) {
  const data = artifact.data as {
    B0_mT: number[];
    mfePercent: number[];
    ensemble: { meanMfePercent: number[]; stdMfePercent: number[] };
  };
  const b0 = data.B0_mT;
  const mean = data.ensemble.meanMfePercent;
  const std = data.ensemble.stdMfePercent;
  const bMax = Math.max(...b0);
  const sq = (b: number) => Math.sqrt(Math.max(b, 0));
  const sqMax = sq(bMax);
  const all = [...mean.map((m, i) => m + std[i]), ...mean.map((m, i) => m - std[i])];
  const yMin = Math.min(...all, 0);
  const yMax = Math.max(...all, 0);
  const x = (b: number) => M.left + (sq(b) / sqMax) * IW;
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin || 1)) * IH;

  const line = mean.map((m, i) => `${i === 0 ? "M" : "L"}${x(b0[i]).toFixed(1)},${y(m).toFixed(1)}`).join(" ");
  const upper = mean.map((m, i) => `${i === 0 ? "M" : "L"}${x(b0[i]).toFixed(1)},${y(m + std[i]).toFixed(1)}`).join(" ");
  const lower = mean
    .map((_m, i) => `L${x(b0[mean.length - 1 - i]).toFixed(1)},${y(mean[mean.length - 1 - i] - std[mean.length - 1 - i]).toFixed(1)}`)
    .join(" ");
  const band = `${upper} ${lower} Z`;
  const lastX = x(b0[b0.length - 1]);
  const lastY = y(mean[mean.length - 1]);

  return (
    <figure className="traces">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="reference radical pair MARY trace with uncertainty band">
        <line x1={M.left} x2={M.left + IW} y1={y(0)} y2={y(0)} stroke={PALETTE.line2} strokeWidth={1} />
        <path d={band} fill={`${PALETTE.gold}22`} stroke="none" />
        <path d={line} fill="none" stroke={PALETTE.gold} strokeWidth={1.8} />
        <text x={lastX + 8} y={lastY} className="tr-lab" dominantBaseline="middle">reference MARY</text>
        <text x={lastX + 8} y={lastY + 14} className="tr-sub" dominantBaseline="middle">±1σ ensemble</text>
        <text x={M.left} y={H - 12} className="tr-ax">0</text>
        <text x={M.left + IW} y={H - 12} className="tr-ax" textAnchor="end">{bMax} mT</text>
        <text x={M.left - 8} y={y(yMax)} className="tr-ax" textAnchor="end" dominantBaseline="middle">{yMax.toFixed(1)}%</text>
        <text x={M.left - 8} y={y(yMin)} className="tr-ax" textAnchor="end" dominantBaseline="middle">{yMin.toFixed(1)}%</text>
        <text x={M.left + IW / 2} y={H - 4} className="tr-axtitle" textAnchor="middle">static field B₀ (√ scale)</text>
      </svg>

      {spin != null && <SpinPanel spin={spin} candidateSpecific={candidateSpecific} />}

      <figcaption className="tr-cap">
        <em>Reference</em> radical pair spin dynamics calculation. A synthetic assumption sweep from{" "}
        <code>{artifact.schemaVersion}@{(artifact.contentHash as string).slice(0, 8)}</code>, <strong>not</strong> a prediction of{" "}
        {candidateLabel ?? "this protein"}.
      </figcaption>
    </figure>
  );
}

// second small-multiple: the candidate's OWN computed spin as a point + ±range interval,
// on its own unitless 0–1 scale — never on the mfe% axis above.
const SW = 640;
const SH = 92;
const SM = { top: 22, right: 150, bottom: 26, left: 52 };
const SIW = SW - SM.left - SM.right;

function SpinPanel({ spin, candidateSpecific }: { spin: SpinParam; candidateSpecific?: boolean }) {
  const lo = spin.range ? Math.min(spin.range[0], spin.range[1]) : spin.value;
  const hi = spin.range ? Math.max(spin.range[0], spin.range[1]) : spin.value;
  const domainMax = Math.max(0.25, Math.ceil(Math.max(spin.value, hi) * 5) / 5);
  const px = (v: number) => SM.left + (Math.max(0, Math.min(domainMax, v)) / domainMax) * SIW;
  const cy = SM.top + 14;
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label="basis dependent Mulliken spin population from the candidate cluster calculation" className="tr-spin">
      <line x1={SM.left} x2={SM.left + SIW} y1={cy} y2={cy} stroke={PALETTE.line2} strokeWidth={1} />
      {spin.range && <line x1={px(lo)} x2={px(hi)} y1={cy} y2={cy} stroke={PALETTE.steel} strokeWidth={3} />}
      <circle cx={px(spin.value)} cy={cy} r={4.5} fill={PALETTE.steel} />
      <text x={px(spin.value)} y={cy - 12} className="tr-ax" textAnchor="middle">{spin.value.toFixed(2)}</text>
      <text x={SM.left} y={SH - 6} className="tr-ax">0</text>
      <text x={SM.left + SIW} y={SH - 6} className="tr-ax" textAnchor="end">{domainMax.toFixed(1)}</text>
      <text x={SM.left + SIW + 8} y={cy} className="tr-lab" dominantBaseline="middle">Mulliken population</text>
      <text x={SM.left + SIW + 8} y={cy + 14} className="tr-sub" dominantBaseline="middle">
        {candidateSpecific ? "structure extracted cluster" : "template"}, basis dependent
      </text>
    </svg>
  );
}
