import { useEffect, useMemo, useState } from "react";
import { sweepCumProfit, type RunsData } from "@/lib/scenario/model";

const STRAT_COLORS = ["#2980B9", "#16A085", "#4B2C50"];

interface PathSet {
  main: string;
  noisy: string[];
  color: string;
}

function buildPath(ys: number[], xs: number[], sx: (x: number) => number, sy: (y: number) => number): string {
  let d = "";
  for (let i = 0; i < ys.length; i++) {
    d += `${i === 0 ? "M" : "L"}${sx(xs[i]).toFixed(2)},${sy(ys[i]).toFixed(2)}`;
  }
  return d;
}

// Deterministic pseudo-random for stable noisy paths.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function HomeChart() {
  const [data, setData] = useState<RunsData | null>(null);

  useEffect(() => {
    fetch("/runs.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RunsData | null) => setData(d))
      .catch(() => setData(null));
  }, []);

  const sets = useMemo<PathSet[] | null>(() => {
    if (!data) return null;
    const xs = data.qstar_grid;
    const sweep = sweepCumProfit(data, data.meta.controls.dm.default);

    const W = 1000;
    const H = 520;
    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const row of sweep) for (const v of row) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
    const pad = (yMax - yMin) * 0.1;
    yMin -= pad;
    yMax += pad;
    const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    const rnd = mulberry32(20260629);
    return sweep.map((ys, s) => {
      const span = yMax - yMin;
      const noisy = Array.from({ length: 4 }, () => {
        const jit = ys.map((v) => v + (rnd() - 0.5) * span * 0.07);
        return buildPath(jit, xs, sx, sy);
      });
      return { main: buildPath(ys, xs, sx, sy), noisy, color: STRAT_COLORS[s] };
    });
  }, [data]);

  if (!sets) return null;

  return (
    <svg
      className="lp-bg-chart"
      viewBox="0 0 1000 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {sets.map((set, s) => (
        <g key={s}>
          {set.noisy.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={set.color}
              strokeWidth={1}
              strokeOpacity={0.18}
              className="lp-bg-noisy"
              style={{ animationDelay: `${(s * 4 + i) * 0.4}s` }}
            />
          ))}
          <path
            d={set.main}
            fill="none"
            stroke={set.color}
            strokeWidth={2.5}
            strokeOpacity={0.55}
            className="lp-bg-main"
            style={{ animationDelay: `${s * 0.5}s` }}
          />
        </g>
      ))}
    </svg>
  );
}
