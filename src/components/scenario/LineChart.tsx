import { useMemo } from "react";

export interface Series {
  ys: number[];
  color: string;
  width: number;
  opacity?: number;
}

export interface VGuide {
  x: number;
  label?: string;
  color?: string;
  dash?: boolean;
}

interface Props {
  xs: number[];
  series: Series[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  vGuides?: VGuide[];
  zeroLine?: boolean;
  height?: number;
  yDomain?: [number, number];
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return ticks;
}

export function LineChart({
  xs,
  series,
  title,
  xLabel,
  yLabel,
  yFormat = (v) => `${v}`,
  xFormat = (v) => `${v}`,
  vGuides = [],
  zeroLine = false,
  height = 200,
  yDomain,
}: Props) {
  const M = { l: 46, r: 12, t: title ? 22 : 10, b: 30 };
  const W = 600;
  const H = height;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  const xMin = xs[0];
  const xMax = xs[xs.length - 1];

  const [yMin, yMax] = useMemo(() => {
    if (yDomain) return yDomain;
    let mn = Infinity;
    let mx = -Infinity;
    for (const s of series) {
      for (const v of s.ys) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!isFinite(mn)) {
      mn = 0;
      mx = 1;
    }
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    const pad = (mx - mn) * 0.06;
    return [mn - pad, mx + pad] as [number, number];
  }, [series, yDomain]);

  const sx = (x: number) => M.l + ((x - xMin) / (xMax - xMin)) * iw;
  const sy = (y: number) => M.t + ih - ((y - yMin) / (yMax - yMin)) * ih;

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTicks = niceTicks(xMin, xMax, 5).filter((t) => t >= xMin && t <= xMax);

  function path(ys: number[]): string {
    let d = "";
    const n = Math.min(ys.length, xs.length);
    for (let i = 0; i < n; i++) {
      d += `${i === 0 ? "M" : "L"}${sx(xs[i]).toFixed(2)},${sy(ys[i]).toFixed(2)}`;
    }
    return d;
  }

  return (
    <figure className="exp-fig">
      {title && <figcaption className="exp-fig-title">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        role="img"
        aria-label={title}
      >
        {/* gridlines + y ticks */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={sy(t)}
              y2={sy(t)}
              stroke="var(--exp-grid)"
              strokeWidth={1}
            />
            <text
              x={M.l - 6}
              y={sy(t)}
              textAnchor="end"
              dominantBaseline="central"
              className="exp-tick"
            >
              {yFormat(t)}
            </text>
          </g>
        ))}

        {/* zero / break-even line */}
        {zeroLine && yMin < 0 && yMax > 0 && (
          <line
            x1={M.l}
            x2={W - M.r}
            y1={sy(0)}
            y2={sy(0)}
            stroke="var(--exp-marker)"
            strokeWidth={1}
          />
        )}

        {/* vertical guides */}
        {vGuides.map((g, i) => (
          <g key={`v${i}`}>
            <line
              x1={sx(g.x)}
              x2={sx(g.x)}
              y1={M.t}
              y2={M.t + ih}
              stroke={g.color ?? "var(--exp-axis)"}
              strokeWidth={1}
              strokeDasharray={g.dash === false ? undefined : "3 3"}
            />
            {g.label && (
              <text
                x={sx(g.x) + 3}
                y={M.t + 2}
                dominantBaseline="hanging"
                className="exp-guide-label"
                fill={g.color ?? "var(--exp-muted)"}
              >
                {renderTex(g.label)}
              </text>
            )}
          </g>
        ))}

        {/* x axis */}
        <line
          x1={M.l}
          x2={W - M.r}
          y1={M.t + ih}
          y2={M.t + ih}
          stroke="var(--exp-axis)"
          strokeWidth={1}
        />
        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={sx(t)}
            y={M.t + ih + 14}
            textAnchor="middle"
            className="exp-tick"
          >
            {xFormat(t)}
          </text>
        ))}

        {/* series */}
        {series.map((s, i) => (
          <path
            key={i}
            d={path(s.ys)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeOpacity={s.opacity ?? 1}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {xLabel && (
          <text
            x={M.l + iw / 2}
            y={H - 2}
            textAnchor="middle"
            className="exp-axis-label"
          >
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text
            x={12}
            y={M.t + ih / 2}
            textAnchor="middle"
            transform={`rotate(-90 12 ${M.t + ih / 2})`}
            className="exp-axis-label"
          >
            {yLabel}
          </text>
        )}
      </svg>
    </figure>
  );
}
