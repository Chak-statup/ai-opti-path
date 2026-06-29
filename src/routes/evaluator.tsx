import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LineChart, type Series, type VGuide } from "@/components/scenario/LineChart";
import {
  deriveStrategy,
  qstarIndex,
  sweepCumProfit,
  type RunsData,
  type StrategyDerived,
} from "@/lib/scenario/model";

export const Route = createFileRoute("/evaluator")({
  head: () => ({
    meta: [
      { title: "AI Strategy — Scenario Explorer" },
      {
        name: "description",
        content:
          "An interactive exhibit exploring the economics of an AI product across Open, Hybrid and Frontier strategies.",
      },
    ],
  }),
  component: Explorer,
});

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];

type MetricKey = "users" | "margin" | "cost" | "profit";
type Focus = "all" | MetricKey;

const PANELS: { key: MetricKey; title: string; yLabel: string; zero: boolean }[] = [
  { key: "users", title: "Active users N(t)", yLabel: "users (000s)", zero: false },
  { key: "margin", title: "Operating margin", yLabel: "$M / step", zero: false },
  { key: "cost", title: "Cost (CAC + fixed)", yLabel: "$M / step", zero: false },
  { key: "profit", title: "Net profit Π(t)", yLabel: "$M / step", zero: true },
];

function fmtMoney(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toFixed(1)}M`;
}

function Explorer() {
  const [data, setData] = useState<RunsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dm, setDm] = useState(6);
  const [qstar, setQstar] = useState(0.5);
  const [focus, setFocus] = useState<Focus>("all");

  useEffect(() => {
    fetch("/runs.json")
      .then((r) => {
        if (!r.ok) throw new Error(`runs.json ${r.status}`);
        return r.json();
      })
      .then((d: RunsData) => {
        setData(d);
        setDm(d.meta.controls.dm.default);
        setQstar(d.meta.controls.qstar.default);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) {
    return (
      <div className="exp exp-loading">Could not load data: {err}</div>
    );
  }
  if (!data) {
    return <div className="exp exp-loading">Loading exhibit…</div>;
  }

  return <ExplorerView data={data} dm={dm} setDm={setDm} qstar={qstar} setQstar={setQstar} focus={focus} setFocus={setFocus} />;
}

function ExplorerView({
  data,
  dm,
  setDm,
  qstar,
  setQstar,
  focus,
  setFocus,
}: {
  data: RunsData;
  dm: number;
  setDm: (n: number) => void;
  qstar: number;
  setQstar: (n: number) => void;
  focus: Focus;
  setFocus: (f: Focus) => void;
}) {
  const { params, controls } = data.meta;
  const t = data.t;

  const qi = qstarIndex(qstar, data.qstar_grid);
  const snappedQ = data.qstar_grid[qi];

  const derived = useMemo<StrategyDerived[]>(
    () => data.meta.strategies.map((_, s) => deriveStrategy(data, s, dm, snappedQ)),
    [data, dm, snappedQ],
  );

  const sweep = useMemo(() => sweepCumProfit(data, dm), [data, dm]);

  const baseGuides: VGuide[] = [
    { x: params.tau, label: "τ revenue", color: "var(--exp-axis)" },
    { x: params.t_shock, label: "price shock", color: "var(--exp-axis)" },
  ];

  function panelSeries(key: MetricKey): Series[] {
    const faint: Series[] = [];
    const bold: Series[] = [];
    derived.forEach((d, s) => {
      d.samples.forEach((sm) => {
        faint.push({ ys: sm[key], color: STRAT_COLORS[s], width: 1, opacity: 0.22 });
      });
      bold.push({ ys: d[key], color: STRAT_COLORS[s], width: 2 });
    });
    return [...faint, ...bold];
  }

  // View B series
  const sweepSeries: Series[] = sweep.map((ys, s) => ({
    ys,
    color: STRAT_COLORS[s],
    width: 2,
  }));
  const sweepGuides: VGuide[] = [
    { x: snappedQ, label: `Q* = ${snappedQ.toFixed(2)}`, color: "var(--exp-marker)", dash: false },
    ...data.meta.strategies.map((st, s) => ({
      x: st.Q,
      color: STRAT_COLORS[s],
      dash: true,
    })),
  ];

  const visiblePanels = focus === "all" ? PANELS : PANELS.filter((p) => p.key === focus);

  return (
    <div className="exp">
      <header className="exp-header">
        <div className="exp-titles">
          <h1>AI Product Economics — Scenario Explorer</h1>
          <p>
            How two strategic levers move the outcome across three operating
            models, over a {params.T}-step horizon.
          </p>
        </div>
        <div className="exp-segmented" role="tablist" aria-label="Metric focus">
          {(["all", "users", "margin", "cost", "profit"] as Focus[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={focus === f}
              className={focus === f ? "active" : ""}
              onClick={() => setFocus(f)}
            >
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <div className="exp-body">
        {/* Control rail */}
        <aside className="exp-rail">
          <div className="exp-control">
            <div className="exp-control-head">
              <span className="exp-control-label">{"Δm"} — margin slope</span>
              <span className="exp-control-val">{dm.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={controls.dm.min ?? 0}
              max={controls.dm.max ?? 12}
              step={controls.dm.step ?? 0.5}
              value={dm}
              onChange={(e) => setDm(parseFloat(e.target.value))}
            />
            <p className="exp-control-note">Per-user margin gain per unit quality.</p>
          </div>

          <div className="exp-control">
            <div className="exp-control-head">
              <span className="exp-control-label">Q* — churn threshold</span>
              <span className="exp-control-val">{snappedQ.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={data.qstar_grid[0]}
              max={data.qstar_grid[data.qstar_grid.length - 1]}
              step={0.02}
              value={qstar}
              onChange={(e) => setQstar(parseFloat(e.target.value))}
            />
            <p className="exp-control-note">Quality at which churn falls; snaps to grid.</p>
          </div>

          <div className="exp-legend">
            <div className="exp-legend-title">Strategy</div>
            {derived.map((d, s) => (
              <div className="exp-legend-row" key={d.label}>
                <span className="exp-swatch" style={{ background: STRAT_COLORS[s] }} />
                <span className="exp-legend-name">{d.label}</span>
                <span className="exp-legend-q">Q={d.Q}</span>
              </div>
            ))}
          </div>

          <div className="exp-readout">
            <div className="exp-readout-title">Cumulative profit</div>
            {derived.map((d, s) => (
              <div className="exp-readout-row" key={d.label}>
                <span className="exp-readout-name">{d.label}</span>
                <span
                  className="exp-readout-val"
                  style={{ color: STRAT_COLORS[s] }}
                >
                  {fmtMoney(d.cumProfit)}
                </span>
              </div>
            ))}
            <p className="exp-readout-note">over {params.T} time steps</p>
          </div>
        </aside>

        {/* Charts */}
        <main className="exp-main">
          <section className="exp-section">
            <h2 className="exp-section-title">A · Trajectories</h2>
            <div className={focus === "all" ? "exp-grid" : "exp-grid single"}>
              {visiblePanels.map((p) => (
                <LineChart
                  key={p.key}
                  xs={t}
                  series={panelSeries(p.key)}
                  title={p.title}
                  xLabel="time steps"
                  yLabel={p.yLabel}
                  vGuides={baseGuides}
                  zeroLine={p.zero}
                  xFormat={(v) => `${Math.round(v)}`}
                  yFormat={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
                  height={focus === "all" ? 200 : 320}
                />
              ))}
            </div>
          </section>

          <section className="exp-section">
            <h2 className="exp-section-title">B · Cumulative profit vs quality threshold</h2>
            <LineChart
              xs={data.qstar_grid}
              series={sweepSeries}
              xLabel="Q* — churn quality threshold"
              yLabel="$M over horizon"
              vGuides={sweepGuides}
              zeroLine
              xFormat={(v) => v.toFixed(1)}
              yFormat={(v) => v.toFixed(0)}
              height={260}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
