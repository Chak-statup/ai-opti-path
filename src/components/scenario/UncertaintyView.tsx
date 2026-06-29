// Uncertainty stage: prior-predictive Monte-Carlo distribution of cumulative
// profit per strategy, plus one Bayesian inference query (posterior given a loss).
import { useMemo, useState } from "react";
import {
  ancestralSample,
  fracPositive,
  histogram,
  mean,
  median,
  PRIORS,
  type Bin,
  type WorldDraws,
} from "@/lib/scenario/bayes";
import type { RunsData } from "@/lib/scenario/model";

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];
const M_WORLDS = 4000;
const BASE_SEED = 12345;

interface HistSeries {
  bins: Bin[];
  color: string;
  opacity?: number;
}
interface VLine {
  x: number;
  color: string;
  dash?: boolean;
}

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))));
  return s[i];
}

function HistChart({
  series,
  lo,
  hi,
  xLabel,
  yLabel,
  vLines = [],
  zeroLine = false,
  xFormat = (v) => `${v}`,
  height = 240,
}: {
  series: HistSeries[];
  lo: number;
  hi: number;
  xLabel?: string;
  yLabel?: string;
  vLines?: VLine[];
  zeroLine?: boolean;
  xFormat?: (v: number) => string;
  height?: number;
}) {
  const M = { l: 44, r: 12, t: 10, b: 30 };
  const W = 600;
  const H = height;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  const yMax = Math.max(
    1e-9,
    ...series.flatMap((s) => s.bins.map((b) => b.count)),
  );

  const sx = (x: number) => M.l + ((x - lo) / (hi - lo)) * iw;
  const sy = (y: number) => M.t + ih - (y / yMax) * ih;

  const xTickVals: number[] = [];
  const nT = 5;
  for (let i = 0; i <= nT; i++) xTickVals.push(lo + ((hi - lo) * i) / nT);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" role="img">
      {/* x axis */}
      <line x1={M.l} x2={W - M.r} y1={M.t + ih} y2={M.t + ih} stroke="var(--exp-axis)" strokeWidth={1} />
      {xTickVals.map((t, i) => (
        <text key={`x${i}`} x={sx(t)} y={M.t + ih + 14} textAnchor="middle" className="exp-tick">
          {xFormat(t)}
        </text>
      ))}
      <text x={M.l - 6} y={M.t + 4} textAnchor="end" className="exp-tick">
        {Math.round(yMax)}
      </text>

      {/* zero line */}
      {zeroLine && lo < 0 && hi > 0 && (
        <line x1={sx(0)} x2={sx(0)} y1={M.t} y2={M.t + ih} stroke="var(--exp-marker)" strokeWidth={1} />
      )}

      {/* bars */}
      {series.map((s, si) =>
        s.bins.map((b, bi) => {
          const x = sx(b.x0);
          const w = Math.max(0.5, sx(b.x1) - sx(b.x0) - 0.5);
          const y = sy(b.count);
          const h = M.t + ih - y;
          if (h <= 0) return null;
          return (
            <rect
              key={`${si}-${bi}`}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={s.color}
              fillOpacity={s.opacity ?? 0.55}
            />
          );
        }),
      )}

      {/* vertical markers */}
      {vLines.map((v, i) => (
        <line
          key={`v${i}`}
          x1={sx(v.x)}
          x2={sx(v.x)}
          y1={M.t}
          y2={M.t + ih}
          stroke={v.color}
          strokeWidth={2}
          strokeDasharray={v.dash === false ? undefined : "4 3"}
        />
      ))}

      {xLabel && (
        <text x={M.l + iw / 2} y={H - 2} textAnchor="middle" className="exp-axis-label">
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
  );
}

export function UncertaintyView({ data }: { data: RunsData }) {
  const p = data.meta.params;
  const strategies = data.meta.strategies;

  const draws = useMemo<WorldDraws[]>(
    () => strategies.map((s, i) => ancestralSample(s.Q, M_WORLDS, p, BASE_SEED + i * 101)),
    [data],
  );

  const [infStrat, setInfStrat] = useState(1); // default Strategy 2 (hybrid)

  // Prior-predictive distribution range.
  const allPi = draws.flatMap((d) => d.Pi);
  const piLo = Math.floor(quantile(allPi, 0.005));
  const piHi = Math.ceil(quantile(allPi, 0.995));

  const piSeries: HistSeries[] = draws.map((d, i) => ({
    bins: histogram(d.Pi, piLo, piHi, 48),
    color: STRAT_COLORS[i],
    opacity: 0.5,
  }));
  const piMedians: VLine[] = draws.map((d, i) => ({
    x: median(d.Pi),
    color: STRAT_COLORS[i],
  }));

  // Inference: posterior over the world given the chosen strategy lost money.
  const d = draws[infStrat];
  const lostMask = d.Pi.map((v) => v < 0);
  const pLoss = lostMask.filter(Boolean).length / d.Pi.length;
  const qstarLost = d.qstar.filter((_, i) => lostMask[i]);
  const phiLost = d.phi.filter((_, i) => lostMask[i]);
  const infColor = STRAT_COLORS[infStrat];

  const qstarPrior = histogram(d.qstar, PRIORS.qstar.lo, PRIORS.qstar.hi, 24, true);
  const qstarPost = histogram(qstarLost, PRIORS.qstar.lo, PRIORS.qstar.hi, 24, true);
  const phiPrior = histogram(d.phi, PRIORS.phi.lo, PRIORS.phi.hi, 24, true);
  const phiPost = histogram(phiLost, PRIORS.phi.lo, PRIORS.phi.hi, 24, true);

  return (
    <div className="exp-uncert">
      <section className="exp-section">
        <h2 className="exp-section-title">Prior-predictive profit, by strategy</h2>
        <p className="exp-prose">
          The two levers are not the whole story. Three things about the world are genuinely
          uncertain: where the market sets the quality bar (Q*), how hard competition bites (φ),
          and how much quality actually pays (Δm). We put plain priors on each, sample {M_WORLDS.toLocaleString()}{" "}
          possible worlds, and run the dynamics in every one. The result is a distribution of
          cumulative profit per strategy — not a single forecast.
        </p>
        <HistChart
          series={piSeries}
          lo={piLo}
          hi={piHi}
          vLines={piMedians}
          zeroLine
          xLabel="cumulative profit over the horizon ($M)"
          yLabel="sampled worlds"
          xFormat={(v) => v.toFixed(0)}
          height={300}
        />
        <div className="exp-stat-row">
          {draws.map((dr, i) => (
            <div className="exp-stat" key={i}>
              <span className="exp-swatch" style={{ background: STRAT_COLORS[i] }} />
              <span className="exp-stat-name">{strategies[i].label}</span>
              <span className="exp-stat-vals">
                median ${median(dr.Pi).toFixed(1)}M · P(profit&gt;0) {(fracPositive(dr.Pi) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">Bayesian update — what a loss tells you</h2>
        <p className="exp-prose">
          Now invert the question. Suppose an app on this strategy{" "}
          <strong>lost money</strong>. What does that imply about the hidden world? We keep only the
          worlds that ended in a loss and compare their parameters against the prior. The posterior
          shifts toward a higher quality bar and fiercer competition — the conditions that make a
          loss likely.
        </p>

        <div className="exp-inf-controls">
          <span className="exp-control-label">Condition on:</span>
          <div className="exp-tabs" role="tablist">
            {strategies.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={infStrat === i}
                className={`exp-tab ${infStrat === i ? "active" : ""}`}
                onClick={() => setInfStrat(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="exp-inf-ploss">
            P(loss) = <strong style={{ color: infColor }}>{(pLoss * 100).toFixed(0)}%</strong>
          </span>
        </div>

        <div className="exp-inf-grid">
          <div>
            <div className="exp-fig-title">Market quality bar Q*</div>
            <HistChart
              series={[
                { bins: qstarPrior, color: "var(--exp-axis)", opacity: 0.45 },
                { bins: qstarPost, color: infColor, opacity: 0.6 },
              ]}
              lo={PRIORS.qstar.lo}
              hi={PRIORS.qstar.hi}
              xLabel="Q*"
              yLabel="density"
              xFormat={(v) => v.toFixed(2)}
            />
            <p className="exp-inf-shift">
              E[Q*]: prior {mean(d.qstar).toFixed(2)} → posterior {qstarLost.length ? mean(qstarLost).toFixed(2) : "—"}
            </p>
          </div>
          <div>
            <div className="exp-fig-title">Competition intensity φ</div>
            <HistChart
              series={[
                { bins: phiPrior, color: "var(--exp-axis)", opacity: 0.45 },
                { bins: phiPost, color: infColor, opacity: 0.6 },
              ]}
              lo={PRIORS.phi.lo}
              hi={PRIORS.phi.hi}
              xLabel="φ"
              yLabel="density"
              xFormat={(v) => v.toFixed(2)}
            />
            <p className="exp-inf-shift">
              E[φ]: prior {mean(d.phi).toFixed(2)} → posterior {phiLost.length ? mean(phiLost).toFixed(2) : "—"}
            </p>
          </div>
        </div>
        <div className="exp-inf-legend">
          <span><span className="exp-swatch" style={{ background: "var(--exp-axis)" }} /> prior</span>
          <span><span className="exp-swatch" style={{ background: infColor }} /> posterior | loss</span>
        </div>
      </section>
    </div>
  );
}
