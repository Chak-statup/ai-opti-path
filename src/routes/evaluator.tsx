import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LineChart, type Series, type VGuide } from "@/components/scenario/LineChart";
import { CausalDiagram } from "@/components/scenario/CausalDiagram";
import { RadarChart, type RadarSeries } from "@/components/scenario/RadarChart";
import { ScenarioPresets } from "@/components/scenario/ScenarioPresets";
import { TippingPoints } from "@/components/scenario/TippingPoints";
import { Recommendation } from "@/components/scenario/Recommendation";
import { Mitigation } from "@/components/scenario/Mitigation";
import { AiInsight } from "@/components/scenario/AiInsight";
import { ProblemFrame } from "@/components/scenario/ProblemFrame";
import { HowItWorks } from "@/components/scenario/HowItWorks";
import { Tex } from "@/components/scenario/Tex";
import { StatupLogo } from "@/components/StatupLogo";
import {
  buildModelData,
  computeCausalState,
  deriveRiskScores,
  deriveStrategy,
  deriveTippingPoints,
  knobsToScaling,
  qstarIndex,
  scalingToKnobs,
  sweepCumProfit,
  PRESETS,
  RISK_AXES,
  DEFAULT_CONTEXT,
  DEFAULT_VECTOR,
  type MitigationBaseline,
  type RunsData,
  type ScenarioContext,
  type ScenarioPreset,
  type StrategyDerived,
  type StrategyVector,
} from "@/lib/scenario/model";

type Stage = "problem" | "causal" | "risk" | "tipping" | "mitigate" | "recommend";

const STAGES: { key: Stage; label: string; step: string; blurb: string }[] = [
  {
    key: "problem",
    label: "Problem",
    step: "01",
    blurb:
      "The strategic question and why a single margin-per-user number hides the real decision.",
  },
  {
    key: "causal",
    label: "Causal pathway",
    step: "02",
    blurb:
      "How a strategy plays out, end to end. Move a lever or pick a scenario and watch the pathway reshape. Thicker, redder links mark where pressure builds.",
  },
  {
    key: "risk",
    label: "Risk profile",
    step: "03",
    blurb:
      "Every parameter collapses into one five-axis fingerprint per strategy, drawn against the status-quo baseline.",
  },
  {
    key: "tipping",
    label: "Tipping points",
    step: "04",
    blurb:
      "Each risk against its critical line. Past a tipping point the dynamic reinforces itself and is hard to reverse.",
  },
  {
    key: "mitigate",
    label: "Mitigation",
    step: "05",
    blurb:
      "A shock landed or the goal changed. The model proposes several new strategy vectors and simulates each. Compare them and see the before vs after.",
  },
  {
    key: "recommend",
    label: "Recommendation",
    step: "06",
    blurb:
      "A plain-language read of the current scenario: which path wins, what drives it, and what would change the answer.",
  },
];

export const Route = createFileRoute("/evaluator")({
  head: () => ({
    meta: [
      { title: "Scenario Evaluator, AI Product Economics" },
      {
        name: "description",
        content:
          "Guided decision journey for AI product economics: causal pathway, risk profile, tipping points and mitigation across three strategies.",
      },
    ],
  }),
  component: Explorer,
});

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];
const RADAR_AXES = RISK_AXES.map((a) => a.label);

type MetricKey = "users" | "revenue" | "cost" | "profit";
type Tab = "strategy" | MetricKey;

const METRIC_PANELS: Record<MetricKey, { title: string; yLabel: string; zero: boolean }> = {
  users: { title: "Active users", yLabel: "million users", zero: false },
  revenue: { title: "Revenue (ARPU × users)", yLabel: "€M / month", zero: false },
  cost: { title: "Cost (serving + acquisition + fixed)", yLabel: "€M / month", zero: false },
  profit: { title: "Net profit", yLabel: "€M / month", zero: true },
};

const TABS: { key: Tab; label: string }[] = [
  { key: "profit", label: "Profit" },
  { key: "users", label: "Users" },
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "strategy", label: "Strategy" },
];

function fmtMoney(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}€${Math.abs(v).toFixed(1)}M`;
}

function Explorer() {
  // The model is simulated live in the browser — no data fetch, no runs.json.
  const data = useMemo<RunsData>(() => buildModelData(), []);
  return <ExplorerView data={data} />;
}

function ExplorerView({ data }: { data: RunsData }) {
  const { params } = data.meta;
  const t = data.t;

  const [stage, setStage] = useState<Stage>("problem");
  const [traceStrat, setTraceStrat] = useState(1);
  const [dm, setDm] = useState(data.meta.controls.dm.default);
  const [qstar, setQstar] = useState(data.meta.controls.qstar.default);
  const [innov, setInnov] = useState(DEFAULT_VECTOR.innovation);
  const [resil, setResil] = useState(DEFAULT_VECTOR.resilience);
  const [reach, setReach] = useState(DEFAULT_VECTOR.platformReach ?? 50);
  const [tpf, setTpf] = useState(DEFAULT_CONTEXT.tokenPriceFactor);
  const [reg, setReg] = useState(DEFAULT_CONTEXT.regPressure);
  const [shockMonth, setShockMonth] = useState<number | undefined>(undefined);
  const [qualityShift, setQualityShift] = useState<number | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<string | null>("status-quo");
  const [tab, setTab] = useState<Tab>("profit");
  const [causalView, setCausalView] = useState<"pathway" | "charts">("pathway");
  const [showHow, setShowHow] = useState(false);

  const activeStage = STAGES.find((s) => s.key === stage)!;
  const ctx: ScenarioContext = useMemo(
    () => ({ tokenPriceFactor: tpf, regPressure: reg, shockMonth, qualityShift }),
    [tpf, reg, shockMonth, qualityShift],
  );
  const vec: StrategyVector = useMemo(
    () => ({ innovation: innov, resilience: resil, platformReach: reach }),
    [innov, resil, reach],
  );

  // Scaling Strategy axis: one dial that drives both Δm and Q* together.
  // Derived from BOTH dm and Q* so the dial can't disagree with the bar in effect.
  const scaling = knobsToScaling(dm, data, qstar);
  function setScaling(v: number) {
    const k = scalingToKnobs(v, data);
    setDm(k.dm);
    setQstar(k.qstar);
    setActivePreset(null);
  }

  const qi = qstarIndex(qstar, data.qstar_grid);
  const snappedQ = data.qstar_grid[qi];

  const derived = useMemo<StrategyDerived[]>(
    () => data.meta.strategies.map((_, s) => deriveStrategy(data, s, dm, snappedQ, ctx, vec)),
    [data, dm, snappedQ, ctx, vec],
  );
  const sweep = useMemo(() => sweepCumProfit(data, dm, ctx, vec), [data, dm, ctx, vec]);
  const causalState = useMemo(
    () => computeCausalState(data, traceStrat, dm, snappedQ, ctx, vec),
    [data, traceStrat, dm, snappedQ, ctx, vec],
  );
  const riskAll = useMemo(
    () => data.meta.strategies.map((_, s) => deriveRiskScores(data, s, dm, snappedQ, ctx, vec)),
    [data, dm, snappedQ, ctx, vec],
  );
  const tipping = useMemo(
    () => deriveTippingPoints(data, traceStrat, dm, snappedQ, ctx, vec),
    [data, traceStrat, dm, snappedQ, ctx, vec],
  );
  // Dashed reference on the radar: the traced strategy under today's status quo
  // (balanced strategy vector, default scaling, status-quo environment).
  const baselineRisk = useMemo(
    () =>
      deriveRiskScores(
        data,
        traceStrat,
        data.meta.controls.dm.default,
        data.meta.controls.qstar.default,
        PRESETS[0].ctx,
        DEFAULT_VECTOR,
      ),
    [data, traceStrat],
  );

  // manual knob change clears the active preset chip
  function onKnob<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setActivePreset(null);
      // NOTE: do not clear shockMonth here. The scenario's timed shock is part of
      // the environment; adjusting a lever is your RESPONSE to it, not a dismissal.
      // (Dragging the token price down to ×1 flattens the step on its own, since
      // the pre- and post-shock levels then coincide.)
    };
  }
  function applyPreset(p: ScenarioPreset) {
    // A scenario changes ONLY the external environment. Your strategy sliders
    // stay where you set them, so you see the same strategy face a new world.
    // The strategy response lives in the Mitigation step.
    setTpf(p.ctx.tokenPriceFactor);
    setReg(p.ctx.regPressure);
    setShockMonth(p.ctx.shockMonth);
    setQualityShift(p.ctx.qualityShift);
    setActivePreset(p.id);
  }
  function applyVector(c: MitigationBaseline) {
    setTraceStrat(c.strat);
    setDm(c.dm);
    setQstar(c.qstar);
    setInnov(c.vec.innovation);
    setResil(c.vec.resilience);
    setReach(c.vec.platformReach ?? 50);
    setActivePreset(null);
    setStage("causal");
  }

  const baseGuides: VGuide[] = [
    { x: params.tau, label: "τ revenue", color: "var(--exp-axis)" },
    ...(shockMonth !== undefined
      ? [{ x: shockMonth, label: "price shock", color: "var(--exp-marker)" } as VGuide]
      : []),
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

  const sweepSeries: Series[] = sweep.map((ys, s) => ({ ys, color: STRAT_COLORS[s], width: 2 }));
  const sweepGuides: VGuide[] = [
    { x: snappedQ, label: `threshold ${snappedQ.toFixed(2)}`, color: "var(--exp-marker)", dash: false },
    ...data.meta.strategies.map((st, s) => ({ x: st.Q, color: STRAT_COLORS[s], dash: true })),
  ];
  const activeTab = TABS.find((x) => x.key === tab)!;

  const radarSeries: RadarSeries[] = [
    ...riskAll.map((r, s) => ({
      label: derived[s].label,
      color: STRAT_COLORS[s],
      values: [r.cost, r.lockin, r.capability, r.scaling, r.regulatory],
      fill: s === traceStrat,
    })),
    {
      label: "Status quo",
      color: "var(--exp-axis)",
      values: [
        baselineRisk.cost,
        baselineRisk.lockin,
        baselineRisk.capability,
        baselineRisk.scaling,
        baselineRisk.regulatory,
      ],
      dashed: true,
      fill: false,
    },
  ];

  const reading = `With serving cost at ×${causalState.tpfEff.toFixed(
    1,
  )} (vendor ×${tpf.toFixed(1)}, resilience-shielded) and the quality bar at ${snappedQ.toFixed(
    2,
  )}, ${derived[traceStrat].label} holds churn at ${causalState.churn.toFixed(
    2,
  )}/mo and ARPU at €${causalState.margin.toFixed(1)}/user. After the deployment lag and the standing competition drag that leaves about ${causalState.usersEnd.toFixed(
    2,
  )}M active users and ${fmtMoney(causalState.cumProfit)} cumulative profit, so ${
    causalState.profitPos ? "the line stays profitable" : "the line runs at a loss"
  }.`;

  const showRail = stage === "causal" || stage === "risk" || stage === "tipping";
  const mitBase: MitigationBaseline = { strat: traceStrat, dm, qstar: snappedQ, vec };

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
            <p>AI Product economics. A guided decision journey.</p>
          </div>
        </div>
        <Link to="/" className="exp-home-link">
          ← Home
        </Link>
      </header>

      <nav className="exp-journey" aria-label="Evaluator journey">
        {STAGES.map((s, i) => {
          const activeIdx = STAGES.findIndex((x) => x.key === stage);
          const state = i === activeIdx ? "active" : i < activeIdx ? "done" : "todo";
          return (
            <button
              key={s.key}
              className={`exp-journey-step ${state}`}
              aria-current={stage === s.key}
              onClick={() => setStage(s.key)}
            >
              <span className="exp-journey-num">{s.step}</span>
              <span className="exp-journey-label">{s.label}</span>
            </button>
          );
        })}
      </nav>
      <p className="exp-journey-blurb">{activeStage.blurb}</p>

      {stage === "problem" && (
        <div className="exp-stage">
          <ProblemFrame onStart={() => setStage("causal")} />
        </div>
      )}

      {showRail && (
        <div className="exp-body">
          <aside className="exp-rail">
            <div className="exp-rail-group">
              <div className="exp-rail-group-head">
                <span className="exp-rail-group-title">Your four decisions</span>
                <span className="exp-rail-group-tag">{"\n"}</span>
              </div>

              <div className="exp-legend">
                <div className="exp-legend-title">Strategy to trace</div>
                {derived.map((d, s) => (
                  <button
                    type="button"
                    className={`exp-legend-row exp-legend-btn ${traceStrat === s ? "active" : ""}`}
                    key={d.label}
                    onClick={() => setTraceStrat(s)}
                    aria-pressed={traceStrat === s}
                  >
                    <span className="exp-swatch" style={{ background: STRAT_COLORS[s] }} />
                    <span className="exp-legend-name">{d.label}</span>
                    <span className="exp-legend-q">Q={d.Q}</span>
                  </button>
                ))}
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">
                    <span className="exp-axis-chip">01</span> Platform reach
                  </span>
                  <span className="exp-control-val">{Math.round(reach)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={reach}
                  onChange={(e) => onKnob(setReach)(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  <strong>Platform ecosystem.</strong> Contained pilots to mass-market apps. More
                  reach widens the addressable market <Tex>{"K"}</Tex>, growing the user base and revenue &mdash;
                  but also serving-cost exposure when prices spike.
                </p>
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">
                    <span className="exp-axis-chip">02</span> Vendor independence
                  </span>
                  <span className="exp-control-val">{Math.round(resil)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={resil}
                  onChange={(e) => onKnob(setResil)(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  <strong>Vendor choice.</strong> The share of serving you can run on cheaper
                  alternatives. At 70% independence only ~30% of your traffic feels a vendor price
                  hike (so ×3 becomes ×1.6) — at a higher fixed cost.
                </p>
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">
                    <span className="exp-axis-chip">03</span> In-house build
                  </span>
                  <span className="exp-control-val">{Math.round(innov)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={innov}
                  onChange={(e) => onKnob(setInnov)(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  <strong>Build vs buy.</strong> API-first to in-house. More in-house build lowers
                  churn and lifts per-user margin, but raises fixed cost.
                </p>
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">
                    <span className="exp-axis-chip">04</span> Scaling aggressiveness
                  </span>
                  <span className="exp-control-val">{Math.round(scaling)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={scaling}
                  onChange={(e) => setScaling(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  <strong>Scaling strategy.</strong> Cautious to aggressive. Pushes per-customer
                  margin (Δm {dm.toFixed(1)}) and the quality bar you commit to (Q* {snappedQ.toFixed(2)})
                  together: more upside, more churn risk if you miss the bar.
                </p>
              </div>
            </div>

            <div className="exp-rail-group">
              <div className="exp-rail-group-head">
                <span className="exp-rail-group-title">Environment</span>
                <span className="exp-rail-group-tag external">{"\n"}</span>
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">Token price factor</span>
                  <span className="exp-control-val">{tpf.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.1}
                  value={tpf}
                  onChange={(e) => onKnob(setTpf)(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  Multiplier on the vendor&rsquo;s serving cost per active user (COGS). ×1 is today; a
                  pricing shock is simply a high value here. Vendor independence shields the excess.
                </p>
              </div>

              <div className="exp-control">
                <div className="exp-control-head">
                  <span className="exp-control-label">Regulatory pressure</span>
                  <span className="exp-control-val">{Math.round(reg)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={reg}
                  onChange={(e) => onKnob(setReg)(parseFloat(e.target.value))}
                />
                <p className="exp-control-note">
                  External compliance load. Raises the fixed compliance cost and slows your in-house
                  innovation; resilience and in-house build partly buffer it. It does not change the token price.
                </p>
              </div>
              <p className="exp-rail-note">
                Effective serving price is now ×{causalState.tpfEff.toFixed(1)} after resilience shielding.
              </p>
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
              <p className="exp-readout-note">over {params.T} months</p>
            </div>
          </aside>

          <main className="exp-main">
            {stage === "causal" && (
              <section className="exp-section">
                <ScenarioPresets presets={PRESETS} activeId={activePreset} onSelect={applyPreset} />
                <div className="exp-subtabs" role="tablist" aria-label="Causal view">
                  <button
                    role="tab"
                    aria-selected={causalView === "pathway"}
                    className={`exp-tab ${causalView === "pathway" ? "active" : ""}`}
                    onClick={() => setCausalView("pathway")}
                  >
                    Pathway
                  </button>
                  <button
                    role="tab"
                    aria-selected={causalView === "charts"}
                    className={`exp-tab ${causalView === "charts" ? "active" : ""}`}
                    onClick={() => setCausalView("charts")}
                  >
                    Trajectories
                  </button>
                </div>

                {causalView === "pathway" ? (
                  <>
                    <h2 className="exp-section-title">
                      CAUSAL PATHWAY: {derived[traceStrat].label.toUpperCase()}
                    </h2>
                    <div className="exp-causal-wrap">
                      <CausalDiagram cs={causalState} stratColor={STRAT_COLORS[traceStrat]} />
                    </div>
                    <div className="exp-axis-map">
                      <span className="exp-axis-map-title">Where your four decisions enter the pathway</span>
                      <span className="exp-axis-map-item">
                        <span className="exp-axis-chip">01</span>
                        <span>Platform reach &rarr; market size <Tex>{"K"}</Tex> &amp; users <Tex>{"N(t)"}</Tex></span>
                      </span>
                      <span className="exp-axis-map-item">
                        <span className="exp-axis-chip">02</span>
                        <span>Vendor independence &rarr; serving-cost shield</span>
                      </span>
                      <span className="exp-axis-map-item">
                        <span className="exp-axis-chip">03</span>
                        <span>In-house build &rarr; churn <Tex>{"\\chi"}</Tex> &amp; ARPU <Tex>{"m"}</Tex></span>
                      </span>
                      <span className="exp-axis-map-item">
                        <span className="exp-axis-chip">04</span>
                        <span>Scaling &rarr; quality bar <Tex>{"Q^{*}"}</Tex> &amp; ARPU premium <Tex>{"\\Delta m"}</Tex></span>
                      </span>
                    </div>

                    <div className="exp-causal-key">
                      <span className="exp-causal-key-item">
                        <span className="exp-edge-sample good" /> reinforcing link
                      </span>
                      <span className="exp-causal-key-item">
                        <span className="exp-edge-sample bad" /> pressure / risk
                      </span>
                      <span className="exp-causal-key-item">thicker line = stronger effect</span>
                      <span className="exp-causal-key-item">
                        <span className="exp-edge-sample risk" /> shaded node = under pressure
                      </span>
                    </div>
                    <p className="exp-prose">{reading}</p>
                  </>
                ) : (
                  <>
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
                    {tab === "strategy" ? (
                      <>
                        <h2 className="exp-section-title">CUMULATIVE PROFIT VS QUALITY THRESHOLD</h2>
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
                        <h2 className="exp-section-title">Trajectory, {activeTab.label}</h2>
                        <LineChart
                          xs={t}
                          series={panelSeries(tab)}
                          title={METRIC_PANELS[tab].title}
                          xLabel="months"
                          yLabel={METRIC_PANELS[tab].yLabel}
                          vGuides={baseGuides}
                          zeroLine={METRIC_PANELS[tab].zero}
                          xFormat={(v) => `${Math.round(v)}`}
                          yFormat={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
                          height={360}
                        />
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            {stage === "risk" && (
              <section className="exp-section">
                <ScenarioPresets presets={PRESETS} activeId={activePreset} onSelect={applyPreset} />
                <h2 className="exp-section-title">RISK PROFILE vs STATUS QUO</h2>
                <div className="exp-radar-layout">
                  <div className="exp-radar-wrap">
                    <RadarChart axes={RADAR_AXES} series={radarSeries} />
                  </div>
                  <div className="exp-radar-side">
                    <p className="exp-prose">
                      All five axes are <strong>risks &mdash; smaller is better</strong>, so a tighter shape is a
                      safer strategy. Each spoke is driven by one decision (see the breakdown below):{" "}
                      <strong>cost exposure</strong> by the serving price and platform reach,{" "}
                      <strong>vendor lock-in</strong> by vendor independence, <strong>capability gap</strong> by
                      in-house build, <strong>scaling risk</strong> by scaling aggressiveness, and{" "}
                      <strong>regulatory load</strong> by the compliance environment. The dashed grey outline is{" "}
                      {derived[traceStrat].label} under today&rsquo;s status quo; the gap to the coloured shape is
                      what the current strategy and scenario change.
                    </p>
                    <div className="exp-radar-legend">
                      {derived.map((d, s) => (
                        <span key={d.label} className="exp-radar-legend-row">
                          <span className="exp-swatch" style={{ background: STRAT_COLORS[s] }} />
                          {d.label}
                        </span>
                      ))}
                      <span className="exp-radar-legend-row">
                        <span className="exp-swatch dashed" />
                        Status quo (traced)
                      </span>
                    </div>

                    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--exp-muted)" }}>
                        How each axis moves ({derived[traceStrat].label})
                      </div>
                      {RISK_AXES.map((a) => (
                        <div key={a.key} style={{ borderTop: "1px solid var(--exp-grid)", paddingTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--exp-ink)" }}>{a.label}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--exp-muted)", fontSize: 12 }}>
                              {Math.round(riskAll[traceStrat][a.key])}/100
                            </span>
                          </div>
                          <div style={{ color: "var(--exp-muted)", fontSize: 12, marginTop: 3 }}>{a.driver}</div>
                          <div style={{ color: "var(--exp-muted)", fontSize: 12, fontStyle: "italic", marginTop: 2 }}>
                            Rises when {a.rises}.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {stage === "tipping" && (
              <section className="exp-section">
                <ScenarioPresets presets={PRESETS} activeId={activePreset} onSelect={applyPreset} />
                <h2 className="exp-section-title">
                  TIPPING POINTS: {derived[traceStrat].label.toUpperCase()}
                </h2>
                <TippingPoints points={tipping} />
              </section>
            )}
          </main>
        </div>
      )}

      {stage === "mitigate" && (
        <div className="exp-stage">
          <section className="exp-section">
            <ScenarioPresets presets={PRESETS} activeId={activePreset} onSelect={applyPreset} />
            <h2 className="exp-section-title">
              MITIGATION FROM {derived[traceStrat].label.toUpperCase()}
            </h2>
            <Mitigation
              data={data}
              ctx={ctx}
              base={mitBase}
              stratColors={STRAT_COLORS}
              onApply={applyVector}
            />
          </section>
        </div>
      )}

      {stage === "recommend" && (
        <div className="exp-stage">
          <section className="exp-section">
            <ScenarioPresets presets={PRESETS} activeId={activePreset} onSelect={applyPreset} />
            <h2 className="exp-section-title">RECOMMENDATION</h2>
            <Recommendation
              derived={derived}
              riskAll={riskAll}
              ctx={ctx}
              stratColors={STRAT_COLORS}
            />
            <AiInsight derived={derived} riskAll={riskAll} ctx={ctx} />
          </section>
        </div>
      )}

      <button
        type="button"
        className="exp-howto-fab"
        aria-expanded={showHow}
        onClick={() => setShowHow((v) => !v)}
      >
        {showHow ? "Close" : "How it works"}
      </button>

      {showHow && (
        <div className="exp-howto-overlay" role="dialog" aria-label="How it works">
          <div className="exp-howto-panel">
            <div className="exp-howto-panel-head">
              <span>How it works</span>
              <button
                type="button"
                className="exp-howto-close"
                onClick={() => setShowHow(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="exp-howto-panel-body">
              <HowItWorks />
            </div>
          </div>
        </div>
      )}

      <footer className="exp-footer">
        <p>© STAT-UP · for demo purpose only</p>
      </footer>
    </div>
  );
}
