import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LineChart, type Series, type VGuide } from "@/components/scenario/LineChart";
import { CausalDiagram } from "@/components/scenario/CausalDiagram";
import { StatupLogo } from "@/components/StatupLogo";
import {
  computeCausalState,
  deriveStrategy,
  qstarIndex,
  sweepCumProfit,
  type RunsData,
  type StrategyDerived,
} from "@/lib/scenario/model";

type Stage = "causal" | "trajectories";

const STAGES: { key: Stage; label: string; step: string; blurb: string }[] = [
  {
    key: "causal",
    label: "Causal pathway",
    step: "01",
    blurb:
      "How a strategy plays out, end to end. The decision Q and the two levers flow through the churn and margin maps into users and profit. Move a lever and the pathway reshapes — thicker, redder links mark where pressure builds.",
  },
  {
    key: "trajectories",
    label: "Trajectories",
    step: "02",
    blurb:
      "The same model over time. See how active users, margin, cost and revenue evolve for each strategy, with noisy paths showing the range of outcomes.",
  },
];



export const Route = createFileRoute("/evaluator")({
  head: () => ({
    meta: [
      { title: "Scenario Evaluator — AI Product Economics" },
      {
        name: "description",
        content:
          "Scenario Evaluator for AI Product economics across three strategies.",
      },
    ],
  }),
  component: Explorer,
});

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];

type MetricKey = "users" | "margin" | "cost" | "profit";
type Tab = "strategy" | MetricKey;

const METRIC_PANELS: Record<MetricKey, { title: string; yLabel: string; zero: boolean }> = {
  users: { title: "Active users", yLabel: "users (000s)", zero: false },
  margin: { title: "Operating margin", yLabel: "$M / step", zero: false },
  cost: { title: "Cost (CAC + fixed)", yLabel: "$M / step", zero: false },
  profit: { title: "Revenue", yLabel: "$M / step", zero: true },
};

const TABS: { key: Tab; label: string }[] = [
  { key: "profit", label: "Revenue" },
  { key: "users", label: "Users" },
  { key: "margin", label: "Margin" },
  { key: "cost", label: "Cost" },
  { key: "strategy", label: "Strategy" },
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
  const [tab, setTab] = useState<Tab>("profit");

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
    return <div className="exp exp-loading">Could not load data: {err}</div>;
  }
  if (!data) {
    return <div className="exp exp-loading">Loading exhibit…</div>;
  }

  return (
    <ExplorerView
      data={data}
      dm={dm}
      setDm={setDm}
      qstar={qstar}
      setQstar={setQstar}
      tab={tab}
      setTab={setTab}
    />
  );
}

function ExplorerView({
  data,
  dm,
  setDm,
  qstar,
  setQstar,
  tab,
  setTab,
}: {
  data: RunsData;
  dm: number;
  setDm: (n: number) => void;
  qstar: number;
  setQstar: (n: number) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const { params, controls } = data.meta;
  const t = data.t;
  const [stage, setStage] = useState<Stage>("causal");
  const [traceStrat, setTraceStrat] = useState(1);
  const activeStage = STAGES.find((s) => s.key === stage)!;



  const qi = qstarIndex(qstar, data.qstar_grid);
  const snappedQ = data.qstar_grid[qi];

  const derived = useMemo<StrategyDerived[]>(
    () => data.meta.strategies.map((_, s) => deriveStrategy(data, s, dm, snappedQ)),
    [data, dm, snappedQ],
  );

  const sweep = useMemo(() => sweepCumProfit(data, dm), [data, dm]);

  const causalState = useMemo(
    () => computeCausalState(data, traceStrat, dm, snappedQ),
    [data, traceStrat, dm, snappedQ],
  );


  const baseGuides: VGuide[] = [
    { x: params.tau, label: "τ revenue", color: "var(--exp-axis)" },
    { x: params.t_shock, label: "price shock", color: "var(--exp-axis)" },
  ];

  function panelSeries(key: MetricKey): Series[] {
    const faint: Series[] = [];
    const bold: Series[] = [];
    derived.forEach((d, s) => {
      d.samples.forEach((sm) => {
        faint.push({ ys: sm[key], color: STRAT_COLORS[s], width: 1, opacity: 0.3 });
      });
      bold.push({ ys: d[key], color: STRAT_COLORS[s], width: 2 });
    });
    return [...faint, ...bold];
  }

  // Strategy view (cumulative profit vs Q*)
  const sweepSeries: Series[] = sweep.map((ys, s) => ({
    ys,
    color: STRAT_COLORS[s],
    width: 2,
  }));
  const sweepGuides: VGuide[] = [
    { x: snappedQ, label: `threshold ${snappedQ.toFixed(2)}`, color: "var(--exp-marker)", dash: false },
    ...data.meta.strategies.map((st, s) => ({
      x: st.Q,
      color: STRAT_COLORS[s],
      dash: true,
    })),
  ];

  const activeTab = TABS.find((x) => x.key === tab)!;

  return (
    <div className="exp">
      <header className="exp-header">
        <div className="exp-brand">
          <Link to="/" className="exp-logo-link" aria-label="STAT UP home">
            <StatupLogo />
          </Link>
          <span className="exp-brand-divider" />
          <div className="exp-titles">
            <h1>Scenario Evaluator</h1>
            <p>AI Product economics. Two levers, three strategies.</p>
          </div>
        </div>
        <Link to="/" className="exp-home-link">
          ← Home
        </Link>
      </header>

      <nav className="exp-journey" aria-label="Evaluator journey">
        {STAGES.map((s) => (
          <button
            key={s.key}
            className={`exp-journey-step ${stage === s.key ? "active" : ""}`}
            aria-current={stage === s.key}
            onClick={() => setStage(s.key)}
          >
            <span className="exp-journey-num">{s.step}</span>
            <span className="exp-journey-label">{s.label}</span>
          </button>
        ))}
      </nav>
      <p className="exp-journey-blurb">{activeStage.blurb}</p>

      {stage === "causal" && (
        <div className="exp-stage">
          <section className="exp-section">
            <h2 className="exp-section-title">
              CAUSAL BAYESIAN NETWORK — PRIORS FLOW THROUGH THE MECHANISM TO PROFIT
            </h2>
            <div className="exp-causal-wrap">
              <CausalDiagram />
            </div>
            <p className="exp-prose">
              The decision is a single number, the quality level Q. Three things about the world are
              uncertain and get priors: the market quality bar Q*, competition intensity φ, and the
              margin slope Δm. They pass through two exact maps — the churn cliff χ(Q, Q*) and the
              per-user margin m(Q, Δm) — into the noisy user trajectory N(t), and finally into
              cumulative profit Π. A one-off price shock hits the margin near the end of the horizon.
            </p>
          </section>
        </div>
      )}

      {stage === "uncertainty" && (
        <div className="exp-stage">
          <UncertaintyView data={data} />
        </div>
      )}

      {stage === "ode" && (
      <div className="exp-body">

        {/* Control rail */}
        <aside className="exp-rail">
          <div className="exp-control">
            <div className="exp-control-head">
              <span className="exp-control-label">Margin per customer</span>
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
            
          </div>

          <div className="exp-control">
            <div className="exp-control-head">
              <span className="exp-control-label">Quality threshold</span>
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
                <span className="exp-readout-val" style={{ color: STRAT_COLORS[s] }}>
                  {fmtMoney(d.cumProfit)}
                </span>
              </div>
            ))}
            <p className="exp-readout-note">over {params.T} time steps</p>
          </div>
        </aside>

        {/* Chart area · one view at a time */}
        <main className="exp-main">
          <div className="exp-tabs" role="tablist" aria-label="Chart view">
            {TABS.map((x) => (
              <button
                key={x.key}
                role="tab"
                aria-selected={tab === x.key}
                className={`exp-tab ${tab === x.key ? "active" : ""}`}
                onClick={() => setTab(x.key)}
              >
                {x.label}
              </button>
            ))}
          </div>

          <section className="exp-section">
            {tab === "strategy" ? (
              <>
                <h2 className="exp-section-title">
                  CUMULATIVE PROFIT VS QUALITY THRESHOLD
                </h2>
                <LineChart
                  xs={data.qstar_grid}
                  series={sweepSeries}
                  xLabel="Quality threshold"
                  yLabel="$M over horizon"
                  vGuides={sweepGuides}
                  zeroLine
                  xFormat={(v) => v.toFixed(1)}
                  yFormat={(v) => v.toFixed(0)}
                  height={360}
                />
              </>
            ) : (
              <>
                <h2 className="exp-section-title">
                  Trajectory, {activeTab.label}
                </h2>
                <LineChart
                  xs={t}
                  series={panelSeries(tab)}
                  title={METRIC_PANELS[tab].title}
                  xLabel="time steps"
                  yLabel={METRIC_PANELS[tab].yLabel}
                  vGuides={baseGuides}
                  zeroLine={METRIC_PANELS[tab].zero}
                  xFormat={(v) => `${Math.round(v)}`}
                  yFormat={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
                  height={360}
                />
              </>
            )}
          </section>
        </main>
      </div>
      )}
    </div>

  );
}
