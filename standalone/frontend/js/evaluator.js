// evaluator.js — Scenario Evaluator UI logic, port of routes/evaluator.tsx.
import { deriveStrategy, qstarIndex, sweepCumProfit } from "./model.js";
import { renderChart } from "./linechart.js";

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];

const METRIC_PANELS = {
  users: { title: "Active users", yLabel: "users (000s)", zero: false },
  margin: { title: "Operating margin", yLabel: "$M / step", zero: false },
  cost: { title: "Cost (CAC + fixed)", yLabel: "$M / step", zero: false },
  profit: { title: "Revenue", yLabel: "$M / step", zero: true },
};

const TABS = [
  { key: "profit", label: "Revenue" },
  { key: "users", label: "Users" },
  { key: "margin", label: "Margin" },
  { key: "cost", label: "Cost" },
  { key: "strategy", label: "Strategy" },
];

function fmtMoney(v) {
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${Math.abs(v).toFixed(1)}M`;
}

const state = { data: null, dm: 6, qstar: 0.5, tab: "profit" };

async function init() {
  const root = document.getElementById("app");
  try {
    const res = await fetch("/runs.json");
    if (!res.ok) throw new Error(`runs.json ${res.status}`);
    state.data = await res.json();
    state.dm = state.data.meta.controls.dm.default;
    state.qstar = state.data.meta.controls.qstar.default;
  } catch (e) {
    root.innerHTML = `<div class="exp exp-loading">Could not load data: ${e}</div>`;
    return;
  }
  render();
}

function render() {
  const { data } = state;
  const { params, controls } = data.meta;
  const t = data.t;

  const qi = qstarIndex(state.qstar, data.qstar_grid);
  const snappedQ = data.qstar_grid[qi];

  const derived = data.meta.strategies.map((_, s) =>
    deriveStrategy(data, s, state.dm, snappedQ),
  );
  const sweep = sweepCumProfit(data, state.dm);

  const root = document.getElementById("app");
  root.innerHTML = `
    <div class="exp">
      <header class="exp-header">
        <div class="exp-brand">
          <a href="/index.html" class="exp-logo-link" aria-label="STAT UP home">
            <img src="assets/statup-logo.png" alt="STAT UP" class="exp-logo-img light" />
            <img src="assets/statup-logo-dark.png" alt="STAT UP" class="exp-logo-img dark" />
          </a>
          <span class="exp-brand-divider"></span>
          <div class="exp-titles">
            <h1>Scenario Evaluator</h1>
            <p>AI Product economics. Two levers, three strategies.</p>
          </div>
        </div>
        <a href="/index.html" class="exp-home-link">\u2190 Home</a>
      </header>

      <div class="exp-body">
        <aside class="exp-rail">
          <div class="exp-control">
            <div class="exp-control-head">
              <span class="exp-control-label">Margin per customer</span>
              <span class="exp-control-val" id="dm-val">${state.dm.toFixed(1)}</span>
            </div>
            <input id="dm-range" type="range"
              min="${controls.dm.min ?? 0}" max="${controls.dm.max ?? 12}"
              step="${controls.dm.step ?? 0.5}" value="${state.dm}" />
          </div>

          <div class="exp-control">
            <div class="exp-control-head">
              <span class="exp-control-label">Quality threshold</span>
              <span class="exp-control-val" id="q-val">${snappedQ.toFixed(2)}</span>
            </div>
            <input id="q-range" type="range"
              min="${data.qstar_grid[0]}" max="${data.qstar_grid[data.qstar_grid.length - 1]}"
              step="0.02" value="${state.qstar}" />
          </div>

          <div class="exp-legend">
            <div class="exp-legend-title">Strategy</div>
            ${derived.map((d, s) => `
              <div class="exp-legend-row">
                <span class="exp-swatch" style="background:${STRAT_COLORS[s]}"></span>
                <span class="exp-legend-name">${d.label}</span>
                <span class="exp-legend-q">Q=${d.Q}</span>
              </div>`).join("")}
          </div>

          <div class="exp-readout">
            <div class="exp-readout-title">Cumulative profit</div>
            ${derived.map((d, s) => `
              <div class="exp-readout-row">
                <span class="exp-readout-name">${d.label}</span>
                <span class="exp-readout-val" style="color:${STRAT_COLORS[s]}">${fmtMoney(d.cumProfit)}</span>
              </div>`).join("")}
            <p class="exp-readout-note">over ${params.T} time steps</p>
          </div>
        </aside>

        <main class="exp-main">
          <div class="exp-tabs" role="tablist" aria-label="Chart view">
            ${TABS.map((x) => `
              <button class="exp-tab ${state.tab === x.key ? "active" : ""}"
                role="tab" data-tab="${x.key}"
                aria-selected="${state.tab === x.key}">${x.label}</button>`).join("")}
          </div>
          <section class="exp-section">
            <h2 class="exp-section-title" id="section-title"></h2>
            <div id="chart"></div>
          </section>
        </main>
      </div>
    </div>`;

  // wire controls
  const dmRange = document.getElementById("dm-range");
  dmRange.addEventListener("input", (e) => {
    state.dm = parseFloat(e.target.value);
    render();
  });
  const qRange = document.getElementById("q-range");
  qRange.addEventListener("input", (e) => {
    state.qstar = parseFloat(e.target.value);
    render();
  });
  document.querySelectorAll(".exp-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.getAttribute("data-tab");
      render();
    });
  });

  drawChart(derived, sweep, snappedQ);
}

function drawChart(derived, sweep, snappedQ) {
  const { data } = state;
  const { params } = data.meta;
  const t = data.t;
  const chartEl = document.getElementById("chart");
  const titleEl = document.getElementById("section-title");

  if (state.tab === "strategy") {
    titleEl.textContent = "CUMULATIVE PROFIT VS QUALITY THRESHOLD";
    const sweepSeries = sweep.map((ys, s) => ({ ys, color: STRAT_COLORS[s], width: 2 }));
    const sweepGuides = [
      { x: snappedQ, label: `threshold ${snappedQ.toFixed(2)}`, color: "var(--exp-marker)", dash: false },
      ...data.meta.strategies.map((st, s) => ({ x: st.Q, color: STRAT_COLORS[s], dash: true })),
    ];
    renderChart(chartEl, {
      xs: data.qstar_grid,
      series: sweepSeries,
      xLabel: "Quality threshold",
      yLabel: "$M over horizon",
      vGuides: sweepGuides,
      zeroLine: true,
      xFormat: (v) => v.toFixed(1),
      yFormat: (v) => v.toFixed(0),
      height: 360,
    });
    return;
  }

  const key = state.tab;
  const activeTab = TABS.find((x) => x.key === key);
  titleEl.textContent = `Trajectory, ${activeTab.label}`;

  const faint = [];
  const bold = [];
  derived.forEach((d, s) => {
    d.samples.forEach((sm) => {
      faint.push({ ys: sm[key], color: STRAT_COLORS[s], width: 1, opacity: 0.3 });
    });
    bold.push({ ys: d[key], color: STRAT_COLORS[s], width: 2 });
  });

  const baseGuides = [
    { x: params.tau, label: "\u03c4 revenue", color: "var(--exp-axis)" },
    { x: params.t_shock, label: "price shock", color: "var(--exp-axis)" },
  ];

  renderChart(chartEl, {
    xs: t,
    series: [...faint, ...bold],
    title: METRIC_PANELS[key].title,
    xLabel: "time steps",
    yLabel: METRIC_PANELS[key].yLabel,
    vGuides: baseGuides,
    zeroLine: METRIC_PANELS[key].zero,
    xFormat: (v) => `${Math.round(v)}`,
    yFormat: (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)),
    height: 360,
  });
}

init();
