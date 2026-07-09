import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Bar, LinePath } from "@visx/shape";
import type { Trace } from "../../core/types";

/**
 * Tufte-style chart built on visx (scales + shape + axes).
 *
 * Data is unchanged from the deterministic simulator; visx only handles scaling
 * and rendering. Direct-labeled, minimal chartjunk. 2-point traces (RF off/on,
 * lifetime shift) render as labeled bars rather than a line.
 */
interface Props {
  trace: Trace;
  color?: string;
  width?: number;
  height?: number;
}

const AXIS_COLOR = "#9a958a";
const TICK_LABEL = {
  fill: "#9a958a",
  fontFamily: "var(--mono)",
  fontSize: 9,
};

export function LineChart({
  trace,
  color = "#1f4e5f",
  width = 300,
  height = 150,
}: Props) {
  const margin = { top: 10, right: 16, bottom: 30, left: 44 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;

  const xs = trace.x;
  const ys = trace.y;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys);

  const xScale = scaleLinear<number>({
    domain: [xMin, xMax === xMin ? xMin + 1 : xMax],
    range: [0, iw],
  });
  const yScale = scaleLinear<number>({
    domain: [yMin, yMax === yMin ? yMin + 1 : yMax],
    range: [ih, 0],
    nice: true,
  });

  const isTwoPoint = xs.length <= 2;
  const points = xs.map((x, i) => ({ x, y: ys[i] }));
  const barWidth = 16;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={trace.title}
      style={{ display: "block" }}
    >
      <Group left={margin.left} top={margin.top}>
        {/* zero baseline when the range crosses zero */}
        {yMin < 0 && yMax > 0 && (
          <line
            x1={0}
            x2={iw}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="#d8d3c7"
            strokeWidth={1}
          />
        )}

        {isTwoPoint
          ? points.map((p, i) => {
              const cx = xScale(p.x);
              const y0 = yScale(Math.max(0, yMin));
              const yv = yScale(p.y);
              return (
                <g key={i}>
                  <Bar
                    x={cx - barWidth / 2}
                    y={Math.min(yv, y0)}
                    width={barWidth}
                    height={Math.abs(y0 - yv)}
                    fill={color}
                    opacity={0.85}
                  />
                  <text
                    x={cx}
                    y={yv - 5}
                    textAnchor="middle"
                    fontSize={10}
                    fill={color}
                    fontFamily="var(--mono)"
                  >
                    {p.y.toFixed(3)}
                  </text>
                  <text
                    x={cx}
                    y={ih + 20}
                    textAnchor="middle"
                    fontSize={9}
                    fill={AXIS_COLOR}
                    fontFamily="var(--sans)"
                  >
                    {i === 0 ? "off/low" : "on/high"}
                  </text>
                </g>
              );
            })
          : (
            <>
              <LinePath
                data={points}
                x={(d) => xScale(d.x)}
                y={(d) => yScale(d.y)}
                stroke={color}
                strokeWidth={1.75}
              />
              <circle
                cx={xScale(points[points.length - 1].x)}
                cy={yScale(points[points.length - 1].y)}
                r={2.5}
                fill={color}
              />
            </>
          )}

        <AxisLeft
          scale={yScale}
          numTicks={3}
          stroke={AXIS_COLOR}
          strokeWidth={0.75}
          tickStroke={AXIS_COLOR}
          tickLabelProps={() => ({ ...TICK_LABEL, textAnchor: "end", dx: -2, dy: 3 })}
          label={trace.yLabel}
          labelProps={{
            fill: "#6b675e",
            fontFamily: "var(--sans)",
            fontSize: 9.5,
            textAnchor: "middle",
          }}
        />
        {!isTwoPoint && (
          <AxisBottom
            top={ih}
            scale={xScale}
            numTicks={4}
            stroke={AXIS_COLOR}
            strokeWidth={0.75}
            tickStroke={AXIS_COLOR}
            tickLabelProps={() => ({ ...TICK_LABEL, textAnchor: "middle", dy: 2 })}
            label={trace.xLabel}
            labelProps={{
              fill: "#6b675e",
              fontFamily: "var(--sans)",
              fontSize: 9.5,
              textAnchor: "middle",
            }}
          />
        )}
      </Group>
    </svg>
  );
}
