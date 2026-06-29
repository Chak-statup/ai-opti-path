// Mitigation step: when a shock hits or the goal changes, the model proposes
// several alternative strategy vectors and simulates each against the same
// environment. The human stays in the loop — pick a candidate to see the
// before/after effect, then apply it to the live evaluator.
import { useMemo, useState } from "react";
import { LineChart, type Series } from "@/components/scenario/LineChart";
import { RadarChart, type RadarSeries } from "@/components/scenario/RadarChart";
import {
  deriveRiskScores,
  deriveStrategy,
  proposeMitigations,
  type MitigationBaseline,
  type RunsData,
  type ScenarioContext,
} from "@/lib/scenario/model";

const RADAR_AXES = ["Cost", "Lock-in", "Regulatory", "Innovation", "Resilience"];

function fmt(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toFixed(0)}M`;
}

function fmtDelta(v: number): string {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(v).toFixed(0)}M`;
}

export function Mitigation({
  data,
  ctx,
  base,
  stratColors,
  onApply,
}: {
  data: RunsData;
  ctx: ScenarioContext;
  base: MitigationBaseline;
  stratColors: string[];
  onApply: (c: MitigationBaseline) => void;
}) {
  const candidates = useMemo(() => proposeMitigations(data, base, ctx), [data, base, ctx]);
  const [selId, setSelId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((c) => c.id === selId) ?? candidates[0];

  const t = data.t;
  const baseDerived = useMemo(
    () => deriveStrategy(data, base.strat, base.dm, base.qstar, ctx, base.vec),
    [data, base, ctx],
  );
  const afterDerived = useMemo(
    () => deriveStrategy(data, selected.strat, selected.dm, selected.qstar, ctx, selected.vec),
    [data, selected, ctx],
  );

  const profitSeries: Series[] = [
    { ys: baseDerived.profit, color: "var(--exp-axis)", width: 2, opacity: 0.55 },
    { ys: afterDerived.profit, color: stratColors[selected.strat], width: 2.4 },
  ];

  const baseRisk = useMemo(
    () => deriveRiskScores(data, base.strat, base.dm, base.qstar, ctx, base.vec),
    [data, base, ctx],
  );
  const afterRisk = useMemo(
    () => deriveRiskScores(data, selected.strat, selected.dm, selected.qstar, ctx, selected.vec),
    [data, selected, ctx],
  );

  const radarSeries: RadarSeries[] = [
    {
      label: "Before",
      color: "var(--exp-axis)",
      values: [baseRisk.cost, baseRisk.lockin, baseRisk.regulatory, baseRisk.innovation, baseRisk.resilience],
      dashed: true,
      fill: false,
    },
    {
      label: "After",
      color: stratColors[selected.strat],
      values: [afterRisk.cost, afterRisk.lockin, afterRisk.regulatory, afterRisk.innovation, afterRisk.resilience],
      fill: true,
    },
  ];

  return (
    <div className="exp-mit">
      <div className="exp-mit-tag">
        Model-proposed mitigations — generated from the live scenario, ranked by cumulative profit
      </div>

      <div className="exp-mit-cards">
        {candidates.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`exp-mit-card ${selId === c.id ? "active" : ""}`}
            aria-pressed={selId === c.id}
            onClick={() => setSelId(c.id)}
          >
            <div className="exp-mit-card-head">
              <span className="exp-mit-card-label">{c.label}</span>
              <span
                className="exp-mit-card-delta"
                style={{ color: c.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)" }}
              >
                {fmtDelta(c.deltaVsBaseline)}
              </span>
            </div>
            <p className="exp-mit-card-rationale">{c.rationale}</p>
            <div className="exp-mit-card-vec">
              <span>{data.meta.strategies[c.strat].label}</span>
              <span>Q* {c.qstar.toFixed(2)}</span>
              <span>Δm {c.dm.toFixed(1)}</span>
              <span>Innov {Math.round(c.vec.innovation)}</span>
              <span>Resil {Math.round(c.vec.resilience)}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="exp-mit-compare">
        <div className="exp-mit-chart">
          <div className="exp-mit-chart-head">
            <span className="exp-section-title">BEFORE VS AFTER — REVENUE</span>
            <div className="exp-mit-numbers">
              <span className="exp-mit-num">
                <span className="exp-swatch" style={{ background: "var(--exp-axis)" }} />
                Before {fmt(baseDerived.cumProfit)}
              </span>
              <span className="exp-mit-num">
                <span className="exp-swatch" style={{ background: stratColors[selected.strat] }} />
                After {fmt(afterDerived.cumProfit)}
              </span>
            </div>
          </div>
          <LineChart
            xs={t}
            series={profitSeries}
            xLabel="time steps"
            yLabel="$M / step"
            vGuides={[
              { x: data.meta.params.t_shock, label: "price shock", color: "var(--exp-axis)" },
            ]}
            zeroLine
            xFormat={(v) => `${Math.round(v)}`}
            yFormat={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
            height={300}
          />
        </div>

        <div className="exp-mit-radar">
          <RadarChart axes={RADAR_AXES} series={radarSeries} size={320} />
          <div className="exp-radar-legend">
            <span className="exp-radar-legend-row">
              <span className="exp-swatch dashed" /> Before
            </span>
            <span className="exp-radar-legend-row">
              <span className="exp-swatch" style={{ background: stratColors[selected.strat] }} /> After
            </span>
          </div>
        </div>
      </div>

      <div className="exp-mit-apply">
        <p className="exp-prose">
          <strong>{selected.label}</strong> moves cumulative result from {fmt(baseDerived.cumProfit)}{" "}
          to <strong>{fmt(afterDerived.cumProfit)}</strong> ({fmtDelta(selected.deltaVsBaseline)}).
          Applying it sets every lever in the evaluator so you can keep exploring from there.
        </p>
        <button
          type="button"
          className="exp-mit-apply-btn"
          onClick={() =>
            onApply({
              strat: selected.strat,
              dm: selected.dm,
              qstar: selected.qstar,
              vec: selected.vec,
            })
          }
        >
          Apply this strategy vector →
        </button>
      </div>
    </div>
  );
}
