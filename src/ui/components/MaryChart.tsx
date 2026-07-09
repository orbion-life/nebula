/**
 * MARY chart — the studio's focal visual (raw SVG, Tufte discipline).
 *
 * Shows ΔF/F vs static magnetic field from the radical-pair spin-dynamics
 * artifact, with the ensemble uncertainty ribbon, the instrument noise-floor
 * band, the reachable-field shading, and an optional nuisance-drift band. A
 * sqrt field axis makes the characteristic low-field effect legible while still
 * showing high-field saturation. Everything is direct-labeled; no legend box,
 * no gridlines, one reference line at zero.
 */
interface Props {
  b0: number[];
  dff: number[]; // nominal ΔF/F (simulation)
  meanDff: number[];
  stdDff: number[];
  fieldMax: number; // instrument reachable field (mT)
  noiseFloor: number; // fractional
  nuisanceLevel: number; // 0..1 -> drift magnitude overlay
  showNuisance: boolean;
}

const W = 760;
const H = 380;
const M = { top: 24, right: 96, bottom: 46, left: 64 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
const NUISANCE_MAX = 0.05; // 5% drift at full nuisance

export function MaryChart({
  b0,
  dff,
  meanDff,
  stdDff,
  fieldMax,
  noiseFloor,
  nuisanceLevel,
  showNuisance,
}: Props) {
  const bMax = Math.max(...b0);
  const sq = (b: number) => Math.sqrt(Math.max(b, 0));
  const sqMax = sq(bMax);
  const xPix = (b: number) => (sq(b) / sqMax) * IW;

  const nuis = showNuisance ? nuisanceLevel * NUISANCE_MAX : 0;
  const lo = Math.min(...meanDff.map((m, i) => m - stdDff[i]), ...dff, -noiseFloor, -nuis);
  const hi = Math.max(...meanDff.map((m, i) => m + stdDff[i]), ...dff, noiseFloor, nuis);
  const pad = (hi - lo) * 0.12 || 0.01;
  const yLo = lo - pad;
  const yHi = hi + pad;
  const yPix = (v: number) => IH - ((v - yLo) / (yHi - yLo)) * IH;

  const line = (xs: number[], ys: number[]) =>
    xs.map((x, i) => `${i === 0 ? "M" : "L"}${xPix(x).toFixed(1)},${yPix(ys[i]).toFixed(1)}`).join(" ");

  // ensemble ribbon path (mean+std forward, mean-std back)
  const ribbon =
    b0.map((b, i) => `${i === 0 ? "M" : "L"}${xPix(b).toFixed(1)},${yPix(meanDff[i] + stdDff[i]).toFixed(1)}`).join(" ") +
    " " +
    [...b0].reverse().map((b, i) => {
      const idx = b0.length - 1 - i;
      return `L${xPix(b).toFixed(1)},${yPix(meanDff[idx] - stdDff[idx]).toFixed(1)}`;
    }).join(" ") +
    " Z";

  // LFE minimum within reachable field
  let lfeIdx = 0;
  for (let i = 0; i < dff.length; i++) {
    if (b0[i] <= fieldMax && dff[i] < dff[lfeIdx]) lfeIdx = i;
  }

  const ticks = [0, 0.5, 1, 2, 5, 10, 20, 50].filter((t) => t <= bMax + 0.001);
  const yTicks = [yLo, 0, yHi].filter((v, i, a) => a.indexOf(v) === i);
  const lastIdx = dff.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label="Simulated fractional fluorescence change versus static magnetic field, with ensemble uncertainty and instrument noise floor"
      style={{ display: "block", maxWidth: "100%" }}>
      <g transform={`translate(${M.left},${M.top})`}>
        {/* reachable-field shading (beyond instrument range) */}
        {fieldMax < bMax && (
          <rect x={xPix(fieldMax)} y={0} width={IW - xPix(fieldMax)} height={IH} fill="#00000008" />
        )}
        {fieldMax < bMax && (
          <text x={xPix(fieldMax) + 4} y={12} fontSize={10} fontFamily="var(--sans)" fill="#a0aec0">
            beyond instrument field range →
          </text>
        )}

        {/* noise-floor band */}
        <rect x={0} y={yPix(noiseFloor)} width={IW} height={Math.max(0, yPix(-noiseFloor) - yPix(noiseFloor))} fill="#8a2f2f10" />
        <line x1={0} x2={IW} y1={yPix(noiseFloor)} y2={yPix(noiseFloor)} stroke="#8a2f2f" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        <line x1={0} x2={IW} y1={yPix(-noiseFloor)} y2={yPix(-noiseFloor)} stroke="#8a2f2f" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        <text x={IW - 2} y={yPix(noiseFloor) - 4} textAnchor="end" fontSize={10} fontFamily="var(--sans)" fill="#8a2f2f">instrument noise floor</text>

        {/* nuisance drift band */}
        {showNuisance && nuis > 0 && (
          <>
            <rect x={0} y={yPix(nuis)} width={IW} height={Math.max(0, yPix(-nuis) - yPix(nuis))} fill="#9a5b2f14" />
            <text x={2} y={yPix(nuis) - 4} fontSize={10} fontFamily="var(--sans)" fill="#9a5b2f">nuisance drift (O₂ / bleach)</text>
          </>
        )}

        {/* zero reference */}
        <line x1={0} x2={IW} y1={yPix(0)} y2={yPix(0)} stroke="#cbd5e0" strokeWidth={1} />

        {/* ensemble ribbon */}
        <path d={ribbon} fill="#a0aec0" opacity={0.32} />

        {/* nominal simulation line */}
        <path d={line(b0, dff)} fill="none" stroke="#1a202c" strokeWidth={2.2} />

        {/* LFE marker */}
        <circle cx={xPix(b0[lfeIdx])} cy={yPix(dff[lfeIdx])} r={3.5} fill="#8a2f2f" />
        <text x={xPix(b0[lfeIdx]) + 6} y={yPix(dff[lfeIdx]) + 14} fontSize={11} fontFamily="var(--sans)" fill="#8a2f2f">
          low-field effect
        </text>

        {/* end-of-line direct label */}
        <text x={xPix(b0[lastIdx]) + 6} y={yPix(dff[lastIdx]) + 3} fontSize={11} fontFamily="var(--sans)" fill="#1a202c">
          ΔF/F
        </text>

        {/* x ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={xPix(t)} x2={xPix(t)} y1={IH} y2={IH + 4} stroke="#a0aec0" />
            <text x={xPix(t)} y={IH + 17} textAnchor="middle" fontSize={10} fontFamily="var(--mono)" fill="#718096">{t}</text>
          </g>
        ))}
        <text x={IW / 2} y={IH + 38} textAnchor="middle" fontSize={11.5} fontFamily="var(--sans)" fill="#4a5568">
          static magnetic field B₀ (mT, √ scale)
        </text>

        {/* y ticks */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={-4} x2={0} y1={yPix(v)} y2={yPix(v)} stroke="#a0aec0" />
            <text x={-8} y={yPix(v) + 3} textAnchor="end" fontSize={10} fontFamily="var(--mono)" fill="#718096">
              {(v * 100).toFixed(1)}%
            </text>
          </g>
        ))}
        <text transform={`translate(${-46},${IH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fontFamily="var(--sans)" fill="#4a5568">
          ΔF/F (fractional)
        </text>
      </g>
    </svg>
  );
}
