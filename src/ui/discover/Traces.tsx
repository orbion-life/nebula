/**
 * Candidate physics trace — Tufte discipline (raw SVG, no legend, no gridlines).
 *
 * Honesty boundary, drawn into the chart:
 *  - The MARY curve + ±1σ ensemble band is the REFERENCE radical-pair calculation
 *    (a synthetic assumption sweep from the versioned artifact), never a prediction
 *    of this protein's response.
 *  - The candidate contributes its own REAL computed number — the max spin density
 *    from the UHF calculation on its extracted isoalloxazine — shown as an
 *    annotation, not as a performance curve.
 * Direct-labeled, one zero reference line, muted underlay + single accent.
 */
import artifact from "../../data/generated/radical_pair_mary.v1.json";

interface Props {
  candidateSpin?: number | null;
  candidateSpecific?: boolean;
  candidateLabel?: string;
}

const W = 640;
const H = 300;
const M = { top: 26, right: 120, bottom: 40, left: 52 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

export function Traces({ candidateSpin, candidateSpecific, candidateLabel }: Props) {
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
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="reference radical-pair MARY trace with uncertainty band">
        {/* zero reference line */}
        <line x1={M.left} x2={M.left + IW} y1={y(0)} y2={y(0)} stroke="#3a4763" strokeWidth={1} />
        {/* ±1σ ensemble band (muted underlay) */}
        <path d={band} fill="#f6c94522" stroke="none" />
        {/* mean MARY curve (accent) */}
        <path d={line} fill="none" stroke="#f6c945" strokeWidth={1.8} />
        {/* direct label at the line end */}
        <text x={lastX + 8} y={lastY} className="tr-lab" dominantBaseline="middle">
          reference MARY
        </text>
        <text x={lastX + 8} y={lastY + 14} className="tr-sub" dominantBaseline="middle">
          ±1σ ensemble
        </text>
        {/* axes ticks (direct, sparse) */}
        <text x={M.left} y={H - 12} className="tr-ax">0</text>
        <text x={M.left + IW} y={H - 12} className="tr-ax" textAnchor="end">{bMax} mT</text>
        <text x={M.left - 8} y={y(yMax)} className="tr-ax" textAnchor="end" dominantBaseline="middle">{yMax.toFixed(1)}%</text>
        <text x={M.left - 8} y={y(yMin)} className="tr-ax" textAnchor="end" dominantBaseline="middle">{yMin.toFixed(1)}%</text>
        <text x={M.left + IW / 2} y={H - 4} className="tr-axtitle" textAnchor="middle">static field B₀ (√ scale)</text>
      </svg>
      <figcaption className="tr-cap">
        <em>Reference</em> radical-pair spin-dynamics calculation — a synthetic assumption sweep from{" "}
        <code>{artifact.schemaVersion}@{(artifact.contentHash as string).slice(0, 8)}</code>, <strong>not</strong> a prediction of{" "}
        {candidateLabel ?? "this protein"}.{" "}
        {candidateSpin != null ? (
          <>
            Candidate-specific input: max Mulliken spin <strong>{candidateSpin.toFixed(3)}</strong>{" "}
            {candidateSpecific ? "(UHF on this protein's real isoalloxazine)" : "(generic template)"}.
          </>
        ) : (
          <>No candidate-specific quantum-chemistry value for this candidate.</>
        )}
      </figcaption>
    </figure>
  );
}
