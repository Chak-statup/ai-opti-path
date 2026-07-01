// evaluator.js — Scenario Evaluator UI, full port of routes/evaluator.tsx.
// A six-stage guided decision journey built with vanilla DOM + hand-rolled SVG.
import {
  computeCausalState, deriveRiskScores, deriveStrategy, deriveTippingPoints,
  knobsToScaling, qstarIndex, scalingToKnobs, sweepCumProfit, proposeMitigations,
  PRESETS, DEFAULT_CONTEXT, DEFAULT_VECTOR,
} from "./model.js";
import { renderChart } from "./linechart.js";
import { renderCausal } from "./causal.js";
import { renderRadar } from "./radar.js";
import { AXIS_ICONS } from "./axisicons.js";
import { tex } from "./tex.js";

const STRAT_COLORS = ["var(--exp-open)", "var(--exp-hybrid)", "var(--exp-frontier)"];
const CAND_COLORS = ["#2980B9", "#16A085", "#F39C12", "#4B2C50", "#C0392B"];
const RADAR_AXES = ["Cost", "Lock-in", "Regulatory", "In-house build", "Vendor indep."];

const METRIC_PANELS = {
  users: { title: "Active users", yLabel: "users (000s)", zero: false },
  margin: { title: "Operating margin", yLabel: "$M / month", zero: false },
  cost: { title: "Cost (CAC + fixed)", yLabel: "$M / month", zero: false },
  profit: { title: "Revenue", yLabel: "$M / month", zero: true },
};
const TABS = [
  { key: "profit", label: "Revenue" },
  { key: "users", label: "Users" },
  { key: "margin", label: "Margin" },
  { key: "cost", label: "Cost" },
  { key: "strategy", label: "Strategy" },
];

const STAGES = [
  { key: "problem", label: "Problem", step: "01",
    blurb: "The strategic question and why a single margin-per-user number hides the real decision." },
  { key: "causal", label: "Causal pathway", step: "02",
    blurb: "How a strategy plays out, end to end. Move a lever or pick a scenario and watch the pathway reshape. Thicker, redder links mark where pressure builds." },
  { key: "risk", label: "Risk profile", step: "03",
    blurb: "Every parameter collapses into one five-axis fingerprint per strategy, drawn against the status-quo baseline." },
  { key: "tipping", label: "Tipping points", step: "04",
    blurb: "Each risk against its critical line. Past a tipping point the dynamic reinforces itself and is hard to reverse." },
  { key: "mitigate", label: "Mitigation", step: "05",
    blurb: "A shock landed or the goal changed. The model proposes several new strategy vectors and simulates each. Compare them and see the before vs after." },
  { key: "recommend", label: "Recommendation", step: "06",
    blurb: "A plain-language read of the current scenario: which path wins, what drives it, and what would change the answer." },
];

const PROBLEM_AXES = [
  { n: "01", title: "Platform ecosystem",
    question: "Ship your own apps in the GPT or Claude store to millions of users. A competitive edge, or a dependency trap?",
    lever: "Platform reach",
    risks: ["Token price exposure at millions of users", "Exit cost when switching vendor", "Reputation cost of a forced shutdown"] },
  { n: "02", title: "Vendor choice",
    question: "A hyperscaler (OpenAI, Anthropic, Google) against open source models. Time to market against strategic control.",
    lever: "Vendor independence",
    risks: ["Pricing sovereignty", "Model quality over time", "Regulatory approval"] },
  { n: "03", title: "Build versus buy",
    question: "In house capability and ownership against an API first stack. Sovereignty has a price.",
    lever: "In-house build",
    risks: ["Time to build AI expertise", "Ongoing development cost", "Competition for talent"] },
  { n: "04", title: "Scaling strategy",
    question: "When does a pilot become a core system? Scaling without an exit path is structural risk.",
    lever: "Scaling aggressiveness",
    risks: ["Cost structure tipping point", "Technical debt", "Governance gaps"] },
];

function fmtMoney(v) { return `${v < 0 ? "\u2212" : ""}$${Math.abs(v).toFixed(1)}M`; }
function fmt(v) { return `${v < 0 ? "\u2212" : ""}$${Math.abs(v).toFixed(0)}M`; }
function fmtDelta(v) { return `${v >= 0 ? "+" : "\u2212"}$${Math.abs(v).toFixed(0)}M`; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

const state = {
  data: null,
  stage: "problem",
  traceStrat: 1,
  dm: 6, qstar: 0.5,
  innov: DEFAULT_VECTOR.innovation,
  resil: DEFAULT_VECTOR.resilience,
  reach: DEFAULT_VECTOR.platformReach,
  tpf: DEFAULT_CONTEXT.tokenPriceFactor,
  reg: DEFAULT_CONTEXT.regPressure,
  activePreset: "status-quo",
  tab: "profit",
  causalView: "pathway",
  showHow: false,
  mitSel: null, mitPrimary: null, mitAiDone: false, mitAiLoading: false,
  aiKey: "", aiInsight: null, aiError: null, aiLoading: false,
};

const ctx = () => ({ tokenPriceFactor: state.tpf, regPressure: state.reg });
const vec = () => ({ innovation: state.innov, resilience: state.resil, platformReach: state.reach });

async function init() {
  const root = document.getElementById("app");
  try {
    const res = await fetch("/runs.json");
    if (!res.ok) throw new Error(`runs.json ${res.status}`);
    state.data = await res.json();
    state.dm = PRESETS[0].dm;
    state.qstar = PRESETS[0].qstar;
  } catch (e) {
    root.innerHTML = `<div class="exp exp-loading">Could not load data: ${esc(e)}</div>`;
    return;
  }
  render();
}

function presetsHtml() {
  return `<div class="exp-presets" role="group" aria-label="Scenario presets">
    ${PRESETS.map((p) => `<button type="button" class="exp-preset ${state.activePreset === p.id ? "active" : ""}" data-preset="${p.id}" aria-pressed="${state.activePreset === p.id}">
      <span class="exp-preset-label">${p.label}</span>
      <span class="exp-preset-blurb">${p.blurb}</span>
    </button>`).join("")}
  </div>`;
}

function railHtml(derived, causalState, params) {
  const scaling = knobsToScaling(state.dm, state.data);
  const snappedQ = state.data.qstar_grid[qstarIndex(state.qstar, state.data.qstar_grid)];
  return `<aside class="exp-rail">
    <div class="exp-rail-group">
      <div class="exp-rail-group-head"><span class="exp-rail-group-title">Your four decisions</span></div>
      <div class="exp-legend">
        <div class="exp-legend-title">Strategy to trace</div>
        ${derived.map((d, s) => `<button type="button" class="exp-legend-row exp-legend-btn ${state.traceStrat === s ? "active" : ""}" data-trace="${s}" aria-pressed="${state.traceStrat === s}">
          <span class="exp-swatch" style="background:${STRAT_COLORS[s]}"></span>
          <span class="exp-legend-name">${d.label}</span>
          <span class="exp-legend-q">Q=${d.Q}</span>
        </button>`).join("")}
      </div>

      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label"><span class="exp-axis-chip">01</span> Platform reach</span><span class="exp-control-val">${Math.round(state.reach)}</span></div>
        <input type="range" min="0" max="100" step="1" value="${state.reach}" data-knob="reach" />
        <p class="exp-control-note"><strong>Platform ecosystem.</strong> Contained pilots to mass-market apps. More reach grows the user base, lifting revenue but also token-cost exposure when prices spike.</p>
      </div>
      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label"><span class="exp-axis-chip">02</span> Vendor independence</span><span class="exp-control-val">${Math.round(state.resil)}</span></div>
        <input type="range" min="0" max="100" step="1" value="${state.resil}" data-knob="resil" />
        <p class="exp-control-note"><strong>Vendor choice.</strong> Single frontier vendor to open / multi-vendor. Higher independence shields token-price shocks and lowers lock-in, at a higher fixed cost.</p>
      </div>
      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label"><span class="exp-axis-chip">03</span> In-house build</span><span class="exp-control-val">${Math.round(state.innov)}</span></div>
        <input type="range" min="0" max="100" step="1" value="${state.innov}" data-knob="innov" />
        <p class="exp-control-note"><strong>Build vs buy.</strong> API-first to in-house. More in-house build lowers churn and lifts per-user margin, but raises fixed cost.</p>
      </div>
      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label"><span class="exp-axis-chip">04</span> Scaling aggressiveness</span><span class="exp-control-val">${Math.round(scaling)}</span></div>
        <input type="range" min="0" max="100" step="1" value="${scaling}" data-knob="scaling" />
        <p class="exp-control-note"><strong>Scaling strategy.</strong> Cautious to aggressive. Pushes per-customer margin (\u0394m ${state.dm.toFixed(1)}) and the quality bar you commit to (Q* ${snappedQ.toFixed(2)}) together: more upside, more churn risk if you miss the bar.</p>
      </div>
    </div>

    <div class="exp-rail-group">
      <div class="exp-rail-group-head"><span class="exp-rail-group-title">Environment</span></div>
      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label">Token price factor</span><span class="exp-control-val">${state.tpf.toFixed(1)}\u00d7</span></div>
        <input type="range" min="0.5" max="4" step="0.1" value="${state.tpf}" data-knob="tpf" />
        <p class="exp-control-note">Multiplier on vendor token costs. 1\u00d7 is today; higher values mimic a price shock or market consolidation.</p>
      </div>
      <div class="exp-control">
        <div class="exp-control-head"><span class="exp-control-label">Regulatory pressure</span><span class="exp-control-val">${Math.round(state.reg)}</span></div>
        <input type="range" min="0" max="100" step="1" value="${state.reg}" data-knob="reg" />
        <p class="exp-control-note">External compliance burden the vendor passes through. Adds to the effective token price and raises total cost.</p>
      </div>
      <p class="exp-rail-note">Effective token price is now \u00d7${causalState.tpfEff.toFixed(1)}.</p>
    </div>

    <div class="exp-readout">
      <div class="exp-readout-title">Cumulative profit</div>
      ${derived.map((d, s) => `<div class="exp-readout-row"><span class="exp-readout-name">${d.label}</span><span class="exp-readout-val" style="color:${STRAT_COLORS[s]}">${fmtMoney(d.cumProfit)}</span></div>`).join("")}
      <p class="exp-readout-note">over ${params.T} months</p>
    </div>
  </aside>`;
}

function problemHtml() {
  return `<div class="exp-stage"><div class="exp-problem">
    <section class="exp-section"><h2 class="exp-section-title">THE DECISION</h2>
      <p class="exp-prose">Over the next 12 to 18 months you have to decide how aggressively to scale AI: how far to commit to a single frontier vendor, how much to build in house, and how many apps to put in front of millions of users. These choices are made together and are hard to reverse.</p>
    </section>
    <section class="exp-section"><h2 class="exp-section-title">THE CORE INSIGHT</h2>
      <p class="exp-prose">To convert qualitative reasoning to quantitative models we define some metrics that correlate with the business model. For ex: Margin per user is an estimated output of two inputs: margin and the number of users. Margin itself is an output of revenue and cost, and cost depends on the vendor&rsquo;s pricing policy. Constructing estimated causal dependencies for such cases is important and this is what we do.</p>
    </section>
    <section class="exp-section"><h2 class="exp-section-title">WHAT MAKES THIS HARD</h2>
      <p class="exp-prose">Considering our use case: Four decisions are to be taken at the same time and reinforce one another. None can be tuned in isolation, and each carries its own systemic risks.</p>
      <div class="exp-axis-grid">
        ${PROBLEM_AXES.map((a) => `<div class="exp-axis-card">
          <div class="exp-axis-head"><span class="exp-axis-num">${a.n}</span><span class="exp-axis-icon">${AXIS_ICONS[a.n] || ""}</span><span class="exp-axis-title">${a.title}</span></div>
          <p class="exp-axis-q">${a.question}</p>
          <div class="exp-axis-risks-label">Systemic risk factors</div>
          <ul class="exp-axis-risks">${a.risks.map((r) => `<li>${r}</li>`).join("")}</ul>
          <div class="exp-axis-lever">Evaluator lever <span class="exp-axis-lever-name">${a.lever}</span></div>
        </div>`).join("")}
      </div>
      <div class="exp-axis-note"><strong>Why a model.</strong> These options form a system of systems: each one shifts the others, and their interaction creates tipping points that stay invisible in a standard business plan. The evaluator makes those couplings explicit so you can simulate each path and decide with the dynamics in view.</div>
      <button type="button" class="exp-cta" data-goto="causal">Open the evaluator &rarr;</button>
    </section>
  </div></div>`;
}

function causalHtml(derived, reading) {
  if (state.causalView === "pathway") {
    return `<section class="exp-section">
      ${presetsHtml()}
      <div class="exp-subtabs" role="tablist">
        <button class="exp-tab ${state.causalView === "pathway" ? "active" : ""}" data-cview="pathway">Pathway</button>
        <button class="exp-tab ${state.causalView === "charts" ? "active" : ""}" data-cview="charts">Trajectories</button>
      </div>
      <h2 class="exp-section-title">CAUSAL PATHWAY: ${derived[state.traceStrat].label.toUpperCase()}</h2>
      <div class="exp-causal-wrap"><div id="causal-mount"></div></div>
      <div class="exp-axis-map">
        <span class="exp-axis-map-title">Where your four decisions enter the pathway</span>
        <span class="exp-axis-map-item"><span class="exp-axis-chip">01</span><span>Platform reach &rarr; user base ${tex("N(t)")}</span></span>
        <span class="exp-axis-map-item"><span class="exp-axis-chip">02</span><span>Vendor independence &rarr; token-price shock</span></span>
        <span class="exp-axis-map-item"><span class="exp-axis-chip">03</span><span>In-house build &rarr; churn ${tex("\\chi")} &amp; margin ${tex("m")}</span></span>
        <span class="exp-axis-map-item"><span class="exp-axis-chip">04</span><span>Scaling &rarr; quality bar ${tex("Q^{*}")} &amp; margin ${tex("m")}</span></span>
      </div>
      <div class="exp-causal-key">
        <span class="exp-causal-key-item"><span class="exp-edge-sample good"></span> reinforcing link</span>
        <span class="exp-causal-key-item"><span class="exp-edge-sample bad"></span> pressure / risk</span>
        <span class="exp-causal-key-item">thicker line = stronger effect</span>
        <span class="exp-causal-key-item"><span class="exp-edge-sample risk"></span> shaded node = under pressure</span>
      </div>
      <p class="exp-prose">${reading}</p>
    </section>`;
  }
  return `<section class="exp-section">
    ${presetsHtml()}
    <div class="exp-subtabs" role="tablist">
      <button class="exp-tab ${state.causalView === "pathway" ? "active" : ""}" data-cview="pathway">Pathway</button>
      <button class="exp-tab ${state.causalView === "charts" ? "active" : ""}" data-cview="charts">Trajectories</button>
    </div>
    <div class="exp-tabs" role="tablist">
      ${TABS.map((x) => `<button class="exp-tab ${state.tab === x.key ? "active" : ""}" data-tab="${x.key}">${x.label}</button>`).join("")}
    </div>
    <h2 class="exp-section-title" id="chart-title"></h2>
    <div id="chart-mount"></div>
  </section>`;
}

function riskHtml(derived) {
  return `<section class="exp-section">
    ${presetsHtml()}
    <h2 class="exp-section-title">RISK PROFILE vs STATUS QUO</h2>
    <div class="exp-radar-layout">
      <div class="exp-radar-wrap"><div id="radar-mount"></div></div>
      <div class="exp-radar-side">
        <p class="exp-prose">Cost, lock-in and regulatory load are <strong>risks</strong> (smaller is better); innovation and resilience are <strong>strengths</strong> you invest in directly (larger is better). The dashed grey outline is ${derived[state.traceStrat].label} under today&rsquo;s status quo, the gap to the coloured shape is what the current strategy vector and scenario change.</p>
        <div class="exp-radar-legend">
          ${derived.map((d, s) => `<span class="exp-radar-legend-row"><span class="exp-swatch" style="background:${STRAT_COLORS[s]}"></span>${d.label}</span>`).join("")}
          <span class="exp-radar-legend-row"><span class="exp-swatch dashed"></span>Status quo (traced)</span>
        </div>
      </div>
    </div>
  </section>`;
}

function tippingHtml(derived, tipping) {
  const crossed = tipping.filter((p) => p.crossed).length;
  return `<section class="exp-section">
    ${presetsHtml()}
    <h2 class="exp-section-title">TIPPING POINTS: ${derived[state.traceStrat].label.toUpperCase()}</h2>
    <div class="exp-tp-wrap">
      <div class="exp-tp-summary ${crossed > 0 ? "alert" : ""}">
        <span class="exp-tp-count">${crossed}</span><span>of ${tipping.length} thresholds crossed</span>
        <span class="exp-tp-summary-note">${crossed === 0 ? "The system sits within stable limits under this scenario." : "Past a threshold, the dynamic reinforces itself and is hard to reverse without a structural change."}</span>
      </div>
      <div class="exp-tp-grid">
        ${tipping.map((p) => {
          const pct = Math.max(0, Math.min(100, p.value));
          return `<div class="exp-tp-card ${p.crossed ? "crossed" : ""}">
            <div class="exp-tp-head"><span class="exp-tp-label">${p.label}</span><span class="exp-tp-state ${p.crossed ? "crossed" : "ok"}">${p.crossed ? "Crossed" : "OK"}</span></div>
            <div class="exp-tp-value">${Math.round(p.value)}<span class="exp-tp-of">/ 100</span></div>
            <div class="exp-tp-bar"><div class="exp-tp-fill ${p.crossed ? "crossed" : ""}" style="width:${pct}%"></div><div class="exp-tp-marker" style="left:${p.threshold}%"></div></div>
            <div class="exp-tp-scale"><span>0</span><span class="exp-tp-thresh">${p.belowIsBad ? "floor" : "tipping point"} ${p.threshold}</span><span>100</span></div>
            <p class="exp-tp-explain">${p.explanation}</p>
          </div>`;
        }).join("")}
      </div>
    </div>
  </section>`;
}

function mitigateHtml(derived) {
  const data = state.data;
  const base = { strat: state.traceStrat, dm: state.dm, qstar: state.data.qstar_grid[qstarIndex(state.qstar, state.data.qstar_grid)], vec: vec() };
  const candidates = proposeMitigations(data, base, ctx());
  const colorOf = {};
  candidates.forEach((c, i) => (colorOf[c.id] = CAND_COLORS[i % CAND_COLORS.length]));

  if (!state.mitSel) {
    state.mitSel = candidates.length ? [candidates[0].id] : [];
    state.mitPrimary = candidates.length ? candidates[0].id : null;
  }
  const primary = candidates.find((c) => c.id === state.mitPrimary) || candidates[0];
  const baseDerived = deriveStrategy(data, base.strat, base.dm, base.qstar, ctx(), base.vec);

  let aiBlock;
  if (!state.mitAiDone) {
    aiBlock = `<p class="exp-prose">Let the assistant read the live scenario, pick a mitigated strategy vector and add it to the comparison below. The human stays in the loop.</p>
      <button type="button" class="exp-mit-ai-btn" data-mitai="run" ${state.mitAiLoading || !candidates.length ? "disabled" : ""}>${state.mitAiLoading ? "Analysing scenario" : "Generate AI mitigation"}</button>`;
  } else {
    const lines = [
      `I read the live scenario and stress-tested the candidate vectors against the same environment. "${primary.label}" is the strongest response: it moves the cumulative result from ${fmt(baseDerived.cumProfit)} to ${fmt(primary.cumProfit)} (${fmtDelta(primary.deltaVsBaseline)}).`,
      `The decisive move is to ${primary.rationale.charAt(0).toLowerCase()}${primary.rationale.slice(1)}`,
      `Watch-out: this leans on innovation ${Math.round(primary.vec.innovation)} and resilience ${Math.round(primary.vec.resilience)}. If the external shock deepens, raise resilience first, it is the cheapest hedge against vendor pricing pass-through.`,
    ];
    aiBlock = `<div class="exp-mit-ai-out">
      <div class="exp-mit-ai-pick">Recommended vector: <strong>${primary.label}</strong> <span style="color:${primary.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)"}">${fmtDelta(primary.deltaVsBaseline)}</span></div>
      ${lines.map((p) => `<p class="exp-mit-ai-line">${p}</p>`).join("")}
      <button type="button" class="exp-mit-ai-reset" data-mitai="reset">Re-run advisory</button>
    </div>`;
  }

  const selected = candidates.filter((c) => state.mitSel.includes(c.id));

  return `<div class="exp-stage"><section class="exp-section">
    ${presetsHtml()}
    <h2 class="exp-section-title">MITIGATION FROM ${derived[state.traceStrat].label.toUpperCase()}</h2>
    <div class="exp-mit">
      <div class="exp-mit-tag">Model-proposed mitigations, generated from the live scenario and ranked by cumulative profit. Toggle several to compare them, the highlighted one drives the radar and the apply button.</div>
      <div class="exp-mit-ai">
        <div class="exp-mit-ai-head"><span class="exp-mit-ai-title">AI-mitigated strategy</span><span class="exp-mit-ai-tag">Demo, mocked advisory</span></div>
        ${aiBlock}
      </div>
      <div class="exp-mit-cards">
        ${candidates.map((c) => {
          const on = state.mitSel.includes(c.id);
          const isPrimary = c.id === state.mitPrimary;
          return `<button type="button" class="exp-mit-card ${on ? "active" : ""} ${isPrimary ? "primary" : ""}" data-mit="${c.id}" aria-pressed="${on}" ${on ? `style="border-color:${colorOf[c.id]}"` : ""}>
            <div class="exp-mit-card-head"><span class="exp-mit-card-label"><span class="exp-swatch" style="background:${colorOf[c.id]};opacity:${on ? 1 : 0.3}"></span>${c.label}</span><span class="exp-mit-card-delta" style="color:${c.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)"}">${fmtDelta(c.deltaVsBaseline)}</span></div>
            <p class="exp-mit-card-rationale">${c.rationale}</p>
            <div class="exp-mit-card-vec"><span>${data.meta.strategies[c.strat].label}</span><span>Q* ${c.qstar.toFixed(2)}</span><span>\u0394m ${c.dm.toFixed(1)}</span><span>Innov ${Math.round(c.vec.innovation)}</span><span>Resil ${Math.round(c.vec.resilience)}</span></div>
          </button>`;
        }).join("")}
      </div>
      <div class="exp-mit-compare">
        <div class="exp-mit-chart">
          <div class="exp-mit-chart-head"><span class="exp-section-title">BEFORE VS AFTER, REVENUE</span><div class="exp-mit-numbers"><span class="exp-mit-num"><span class="exp-swatch" style="background:var(--exp-axis)"></span>Before ${fmt(baseDerived.cumProfit)}</span></div></div>
          <div id="mit-chart"></div>
          <table class="exp-mit-table">
            <thead><tr><th>Strategy</th><th>Cumulative</th><th>vs before</th></tr></thead>
            <tbody>
              <tr><td><span class="exp-swatch" style="background:var(--exp-axis)"></span> Before</td><td class="num">${fmt(baseDerived.cumProfit)}</td><td class="num">n/a</td></tr>
              ${selected.map((c) => `<tr class="${c.id === state.mitPrimary ? "primary" : ""}"><td><span class="exp-swatch" style="background:${colorOf[c.id]}"></span> ${c.label}</td><td class="num">${fmt(c.cumProfit)}</td><td class="num" style="color:${c.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)"}">${fmtDelta(c.deltaVsBaseline)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="exp-mit-radar">
          <div class="exp-mit-radar-title">${primary.label}, risk shape</div>
          <div id="mit-radar"></div>
          <div class="exp-radar-legend"><span class="exp-radar-legend-row"><span class="exp-swatch dashed"></span> Before</span><span class="exp-radar-legend-row"><span class="exp-swatch" style="background:${colorOf[primary.id]}"></span> After</span></div>
        </div>
      </div>
      <div class="exp-mit-apply">
        <p class="exp-prose"><strong>${primary.label}</strong> moves cumulative result from ${fmt(baseDerived.cumProfit)} to <strong>${fmt(primary.cumProfit)}</strong> (${fmtDelta(primary.deltaVsBaseline)}). Applying it sets every lever in the evaluator so you can keep exploring from there.</p>
        <button type="button" class="exp-mit-apply-btn" data-mitapply="${primary.id}">Apply ${primary.label} &rarr;</button>
      </div>
    </div>
  </section></div>`;
}

function recommendHtml(derived, riskAll) {
  let best = 0;
  derived.forEach((d, i) => { if (d.cumProfit > derived[best].cumProfit) best = i; });
  const RISK_LABEL = { cost: "token cost exposure", lockin: "vendor lock-in", regulatory: "regulatory load" };
  const bestRisks = riskAll[best];
  const ranked = ["cost", "lockin", "regulatory"].map((k) => ({ k, v: bestRisks[k] })).sort((a, b) => b.v - a.v);
  const topRisks = ranked.slice(0, 2);
  const c = ctx();
  const flip = c.tokenPriceFactor >= 2.5
    ? "If token prices return to today's level, the higher-quality strategy regains the lead, most of the gap here is the vendor's pricing, not the product."
    : c.regPressure >= 70
      ? "If regulatory load eases, the build-heavy strategy pays off faster, compliance is currently the binding constraint."
      : "If the vendor doubles token prices, the ranking flips toward the open, lower-exposure strategy.";

  let aiBlock;
  if (state.aiInsight) {
    aiBlock = `<div class="exp-ai-out">${state.aiInsight.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}<button class="exp-ai-btn exp-ai-btn-ghost" data-ai="clear">Clear &amp; reset key</button></div>`;
  } else {
    aiBlock = `<div class="exp-ai-form"><input type="password" class="exp-ai-key" id="ai-key" placeholder="sk-ant-..." value="${esc(state.aiKey)}" autocomplete="off" spellcheck="false" /><button class="exp-ai-btn" data-ai="gen" ${state.aiLoading ? "disabled" : ""}>${state.aiLoading ? "Generating" : "Generate insight"}</button></div>`;
  }

  return `<div class="exp-stage"><section class="exp-section">
    ${presetsHtml()}
    <h2 class="exp-section-title">RECOMMENDATION</h2>
    <div class="exp-rec">
      <div class="exp-rec-tag">Illustrative, generated from the model state</div>
      <div class="exp-rec-headline"><span>Recommended path</span><strong style="color:${STRAT_COLORS[best]}">${derived[best].label}</strong><span class="exp-rec-profit" style="color:${STRAT_COLORS[best]}">${fmt(derived[best].cumProfit)} cumulative</span></div>
      <p class="exp-rec-lead">Under the current scenario, ${derived[best].label} delivers the strongest cumulative result. The decision is driven less by a single &ldquo;margin per user&rdquo; figure than by how cost and dependency evolve as you scale.</p>
      <div class="exp-rec-block"><div class="exp-rec-block-title">What drives this</div><ul class="exp-rec-list">${topRisks.map((r, i) => `<li><strong>${RISK_LABEL[r.k]}</strong> sits at ${Math.round(r.v)}/100, ${i === 0 ? "the dominant pressure on this path" : "the next risk to watch"}.</li>`).join("")}</ul></div>
      <div class="exp-rec-block"><div class="exp-rec-block-title">What would change the decision</div><p class="exp-rec-flip">${flip}</p></div>
    </div>
    <div class="exp-ai">
      <div class="exp-ai-head"><span class="exp-ai-title">AI-augmented advisory</span><span class="exp-ai-tag">Demo, uses your own key</span></div>
      <p class="exp-ai-lead">Generate a written advisory from the live model state using Anthropic Claude. Your key is used only in this browser, sent directly to Anthropic, and never stored, logged, or sent to our servers. It is discarded when you reload the page.</p>
      ${state.aiError ? `<div class="exp-ai-error">${esc(state.aiError)}</div>` : ""}
      ${aiBlock}
    </div>
  </section></div>`;
}

function howtoHtml() {
  if (!state.showHow) return "";
  const PARAMS = [
    ["N(t)", "Active users, the single state variable", "\u2014"],
    ["Q", "Quality = strategy (the decision)", "0.3 / 0.6 / 0.9"],
    ["K", "Market size", "100,000"],
    ["p", "External acquisition rate", "0.01 / mo"],
    ["r", "Word-of-mouth growth rate", "0.35 / mo"],
    ["\\chi_{\\min},\\,\\chi_{\\max}", "Churn floor / ceiling", "0.02 / 0.35 / mo"],
    ["\\kappa", "Churn-cliff steepness", "12"],
    ["Q^{\\ast}", "Churn threshold, cliff location (swept)", "0.5"],
    ["m_0,\\,\\Delta m", "Base margin, quality slope", "$8, $6 / user / mo"],
    ["\\Delta m_{\\text{shock}}", "Margin lost after price shock", "$4 / user / mo"],
    ["\\varphi", "Peak competitive-loss rate", "0.35 / mo"],
    ["\\sigma", "Demand volatility", "0.12"],
    ["c_{\\mathrm{ac}}", "Cost per (re)acquired user", "$15"],
    ["F", "Fixed cost per month", "$30,000"],
    ["\\tau", "Deployment to revenue lag", "6 mo"],
    ["t_{\\text{shock}}", "Price-shock time", "16 mo"],
    ["T", "Horizon", "54 mo"],
  ];
  const FINDINGS = [
    ["Users are not monotone", "With competition, every strategy rises, peaks, then declines. There is no permanent plateau and no guaranteed-growing base."],
    ["Apps can lose money", "A low-quality app bleeds acquisition cost refilling a high-churn bucket, so the open path is value-destroying here even while it has users."],
    ["There is a critical threshold", "Past a strategy-specific Q*, cumulative profit turns negative. Quality below the market's bar is not merely less profitable, it is loss-making."],
    ["Quality pays through retention", "The per-user margin lift from quality is the minor channel. Keeping users (low churn, hence low re-acquisition cost) is the dominant one."],
  ];
  return `<div class="exp-howto-overlay" role="dialog" aria-label="How it works" data-howto="overlay">
    <div class="exp-howto-panel">
      <div class="exp-howto-panel-head"><span>How it works</span><button type="button" class="exp-howto-close" data-howto="close" aria-label="Close">\u00d7</button></div>
      <div class="exp-howto-panel-body"><div class="exp-howto">
        <section class="exp-howto-sec"><h3 class="exp-howto-h">What the model is for</h3>
          <p class="exp-prose">A compact dynamical model of how a single strategic choice, product <strong>quality</strong>, drives the user base and profit of an AI product over time. It is built for strategy discussion, not engineering: there is one state variable, the active user count ${tex("N(t)")}, and quality is a <em>chosen</em> input, not something the system solves for.</p>
          <p class="exp-prose">Strategy is reduced to a single number, the quality level ${tex("Q\\in[0,1]")}: Strategy 1 ${tex("\\approx 0.3")}, Strategy 2 ${tex("\\approx 0.6")}, Strategy 3 ${tex("\\approx 0.9")}.</p>
        </section>
        <section class="exp-howto-sec"><h3 class="exp-howto-h">The equations</h3>
          <div class="exp-howto-eq">${tex("dN = \\Big[\\, p(K-N) + rN\\big(1-\\tfrac{N}{K}\\big) - \\chi(Q)\\,N - \\varphi\\tfrac{t}{T}\\,N \\,\\Big]dt + \\sigma N\\,dW", true)}<p class="exp-howto-cap">User dynamics: acquisition (external marketing plus word-of-mouth) minus losses (churn plus competition), with a demand-noise term so each run is a scenario, not a single prophecy.</p></div>
          <div class="exp-howto-eq">${tex("\\chi(Q)=\\chi_{\\min}+\\frac{\\chi_{\\max}-\\chi_{\\min}}{1+e^{\\,\\kappa(Q-Q^{\\ast})}}\\qquad m(Q)=m_0+\\Delta m\\,Q", true)}<p class="exp-howto-cap">Quality maps: it lowers churn through a threshold cliff and raises per-user margin linearly. These are the only two places quality enters.</p></div>
          <div class="exp-howto-eq">${tex("\\Pi(t)=\\Theta(t-\\tau)\\big[m(Q)-\\Delta m_{\\text{shock}}\\,\\Theta(t-t_{\\text{shock}})\\big]N - c_{\\mathrm{ac}}\\,\\rho\\big[\\chi(Q)+\\varphi\\tfrac{t}{T}\\big]N - F", true)}<p class="exp-howto-cap">Profit flow: per-user margin is earned only after the deployment lag ${tex("\\tau")} and is knocked down by a one-off price shock; against it we net the cost of replacing lost users at the effective token multiplier ${tex("\\rho")} and a fixed overhead.</p></div>
        </section>
        <section class="exp-howto-sec"><h3 class="exp-howto-h">Innovation and resilience</h3>
          <p class="exp-prose">The strategy vector adds two company-level investments on top of quality. They are levers, each on a 0 to 100 scale with a real trade-off: both raise fixed cost.</p>
          <div class="exp-howto-eq">${tex("\\iota=\\frac{\\text{innovation}-50}{50}\\quad\\Rightarrow\\quad \\chi\\to\\chi\\,(1-0.15\\,\\iota),\\qquad m\\to m\\,(1+0.25\\,\\iota)", true)}<p class="exp-howto-cap"><strong>Innovation</strong> buys product capability. It lowers churn ${tex("\\chi")} and lifts per-user margin ${tex("m")}.</p></div>
          <div class="exp-howto-eq">${tex("\\rho = 1 + (\\rho_{\\text{raw}}-1)\\big(1-0.6\\,\\tfrac{\\text{resilience}}{100}\\big),\\qquad \\rho_{\\text{raw}} = \\text{tpf}\\,(1+0.6\\,\\tfrac{\\text{reg}}{100})", true)}<p class="exp-howto-cap"><strong>Resilience</strong> buys vendor independence. It hedges the effective token multiplier ${tex("\\rho")}: up to 60% of any price spike above today's level is absorbed. Regulatory pressure feeds into ${tex("\\rho_{\\text{raw}}")} as a compliance cost the vendor passes on.</p></div>
          <div class="exp-howto-eq">${tex("F \\to F\\,\\big(1 + 0.4\\,\\tfrac{\\text{innovation}}{100} + 0.2\\,\\tfrac{\\text{resilience}}{100}\\big)", true)}<p class="exp-howto-cap">The cost of both bets: investing in innovation and resilience raises the fixed monthly cost ${tex("F")}.</p></div>
        </section>
        <section class="exp-howto-sec"><h3 class="exp-howto-h">From risk factors to model variables</h3>
          <p class="exp-prose">The four strategic decisions each carry specific risks, and every risk is translated into a model lever so you can stress it numerically.</p>
          <div class="exp-howto-eq"><p class="exp-howto-cap"><strong>Platform ecosystem.</strong> Shipping at scale exposes you to token price spikes and exit costs. In the model this is ${tex("N(t)")} scaled by <strong>Platform reach</strong>.</p></div>
          <div class="exp-howto-eq"><p class="exp-howto-cap"><strong>Vendor choice.</strong> <strong>Vendor independence</strong> (resilience ${tex("\\rho")}) hedges the effective token multiplier. Regulatory pressure feeds directly into the raw token multiplier.</p></div>
          <div class="exp-howto-eq"><p class="exp-howto-cap"><strong>Build versus buy.</strong> <strong>In-house build</strong> (innovation ${tex("\\iota")}) lowers churn ${tex("\\chi")} and lifts per-user margin ${tex("m")}, at higher fixed cost.</p></div>
          <div class="exp-howto-eq"><p class="exp-howto-cap"><strong>Scaling strategy.</strong> Captured by coupling the <strong>Quality threshold</strong> ${tex("Q^{*}")} and the <strong>Margin per customer</strong> slope ${tex("\\Delta m")}.</p></div>
        </section>
        <section class="exp-howto-sec"><h3 class="exp-howto-h">Parameters</h3>
          <table class="exp-param-table"><thead><tr><th>Symbol</th><th>Meaning</th><th>Value</th></tr></thead>
          <tbody>${PARAMS.map((p) => `<tr><td class="exp-param-sym">${tex(p[0])}</td><td>${p[1]}</td><td class="exp-param-val">${p[2]}</td></tr>`).join("")}</tbody></table>
        </section>
        <section class="exp-howto-sec"><h3 class="exp-howto-h">Key findings</h3>
          <div class="exp-howto-findings">${FINDINGS.map((f, i) => `<div class="exp-howto-finding"><span class="exp-howto-finding-num">${i + 1}</span><div><h4>${f[0]}</h4><p>${f[1]}</p></div></div>`).join("")}</div>
        </section>
        <p class="exp-howto-illus">Illustrative, not calibrated. Parameter values are plausible placeholders for strategy discussion.</p>
      </div></div>
    </div>
  </div>`;
}

function render() {
  const { data } = state;
  const { params } = data.meta;
  const snappedQ = data.qstar_grid[qstarIndex(state.qstar, data.qstar_grid)];

  const derived = data.meta.strategies.map((_, s) => deriveStrategy(data, s, state.dm, snappedQ, ctx(), vec()));
  const causalState = computeCausalState(data, state.traceStrat, state.dm, snappedQ, ctx(), vec());
  const riskAll = data.meta.strategies.map((_, s) => deriveRiskScores(data, s, state.dm, snappedQ, ctx(), vec()));
  const tipping = deriveTippingPoints(data, state.traceStrat, state.dm, snappedQ, ctx(), vec());

  const reading = `With the effective token price at ${causalState.tpfEff.toFixed(1)}\u00d7 (vendor ${state.tpf.toFixed(1)}\u00d7 plus regulatory pass-through) and the quality threshold at ${snappedQ.toFixed(2)}, ${derived[state.traceStrat].label} holds churn at ${causalState.churn.toFixed(2)} and margin at $${causalState.margin.toFixed(1)}/user. That leaves about ${Math.round(causalState.usersEnd)}k active users and ${fmtMoney(causalState.cumProfit)} cumulative, so ${causalState.profitPos ? "the model stays profitable" : "the model slips into a loss"}.`;

  const activeIdx = STAGES.findIndex((x) => x.key === state.stage);
  const activeStage = STAGES[activeIdx];
  const showRail = state.stage === "causal" || state.stage === "risk" || state.stage === "tipping";

  let stageBody = "";
  if (state.stage === "problem") stageBody = problemHtml();
  else if (showRail) {
    let main = "";
    if (state.stage === "causal") main = causalHtml(derived, reading);
    else if (state.stage === "risk") main = riskHtml(derived);
    else if (state.stage === "tipping") main = tippingHtml(derived, tipping);
    stageBody = `<div class="exp-body">${railHtml(derived, causalState, params)}<main class="exp-main">${main}</main></div>`;
  } else if (state.stage === "mitigate") stageBody = mitigateHtml(derived);
  else if (state.stage === "recommend") stageBody = recommendHtml(derived, riskAll);

  const root = document.getElementById("app");
  root.innerHTML = `<div class="exp">
    <header class="exp-header">
      <div class="exp-brand">
        <a href="/index.html" class="exp-logo-link" aria-label="STAT UP home">
          <img src="assets/statup-logo.png" alt="STAT UP" class="exp-logo-img light" />
          <img src="assets/statup-logo-dark.png" alt="STAT UP" class="exp-logo-img dark" />
        </a>
        <span class="exp-brand-divider"></span>
        <div class="exp-titles"><h1>Scenario Evaluator</h1><p>AI Product economics. A guided decision journey.</p></div>
      </div>
      <a href="/index.html" class="exp-home-link">\u2190 Home</a>
    </header>
    <nav class="exp-journey" aria-label="Evaluator journey">
      ${STAGES.map((s, i) => {
        const st = i === activeIdx ? "active" : i < activeIdx ? "done" : "todo";
        return `<button class="exp-journey-step ${st}" data-stage="${s.key}" aria-current="${state.stage === s.key}"><span class="exp-journey-num">${s.step}</span><span class="exp-journey-label">${s.label}</span></button>`;
      }).join("")}
    </nav>
    <p class="exp-journey-blurb">${activeStage.blurb}</p>
    ${stageBody}
    <button type="button" class="exp-howto-fab" data-howto="toggle" aria-expanded="${state.showHow}">${state.showHow ? "Close" : "How it works"}</button>
    ${howtoHtml()}
    <footer class="exp-footer"><p>\u00a9 STAT-UP \u00b7 for demo purpose only</p></footer>
  </div>`;

  wire(derived, causalState, snappedQ);
  draw(derived, causalState, snappedQ);
}

function wire(derived, causalState, snappedQ) {
  const q = (sel) => Array.from(document.querySelectorAll(sel));

  q("[data-stage]").forEach((b) => b.addEventListener("click", () => { state.stage = b.dataset.stage; render(); }));
  q("[data-goto]").forEach((b) => b.addEventListener("click", () => { state.stage = b.dataset.goto; render(); }));
  q("[data-preset]").forEach((b) => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
  q("[data-trace]").forEach((b) => b.addEventListener("click", () => { state.traceStrat = +b.dataset.trace; render(); }));
  q("[data-cview]").forEach((b) => b.addEventListener("click", () => { state.causalView = b.dataset.cview; render(); }));
  q("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; render(); }));

  q("input[data-knob]").forEach((inp) => inp.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    const k = inp.dataset.knob;
    if (k === "scaling") {
      const kk = scalingToKnobs(v, state.data);
      state.dm = kk.dm; state.qstar = kk.qstar; state.activePreset = null;
    } else if (k === "reach") { state.reach = v; state.activePreset = null; }
    else if (k === "resil") { state.resil = v; state.activePreset = null; }
    else if (k === "innov") { state.innov = v; state.activePreset = null; }
    else if (k === "tpf") { state.tpf = v; state.activePreset = null; }
    else if (k === "reg") { state.reg = v; state.activePreset = null; }
    render();
  }));

  // howto
  const fab = document.querySelector('[data-howto="toggle"]');
  if (fab) fab.addEventListener("click", () => { state.showHow = !state.showHow; render(); });
  q('[data-howto="close"]').forEach((b) => b.addEventListener("click", () => { state.showHow = false; render(); }));
  const ov = document.querySelector('[data-howto="overlay"]');
  if (ov) ov.addEventListener("click", (e) => { if (e.target === ov) { state.showHow = false; render(); } });

  // mitigation
  q("[data-mit]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.mit;
    state.mitPrimary = id;
    if (state.mitSel.includes(id)) {
      if (state.mitSel.length > 1) state.mitSel = state.mitSel.filter((x) => x !== id);
    } else state.mitSel = [...state.mitSel, id];
    render();
  }));
  const mitRun = document.querySelector('[data-mitai="run"]');
  if (mitRun) mitRun.addEventListener("click", () => {
    state.mitAiLoading = true; render();
    setTimeout(() => {
      const base = { strat: state.traceStrat, dm: state.dm, qstar: snappedQ, vec: vec() };
      const cands = proposeMitigations(state.data, base, ctx());
      if (cands[0]) { state.mitPrimary = cands[0].id; if (!state.mitSel.includes(cands[0].id)) state.mitSel.push(cands[0].id); }
      state.mitAiLoading = false; state.mitAiDone = true; render();
    }, 700);
  });
  const mitReset = document.querySelector('[data-mitai="reset"]');
  if (mitReset) mitReset.addEventListener("click", () => { state.mitAiDone = false; render(); });
  q("[data-mitapply]").forEach((b) => b.addEventListener("click", () => {
    const base = { strat: state.traceStrat, dm: state.dm, qstar: snappedQ, vec: vec() };
    const cands = proposeMitigations(state.data, base, ctx());
    const c = cands.find((x) => x.id === b.dataset.mitapply) || cands[0];
    state.traceStrat = c.strat; state.dm = c.dm; state.qstar = c.qstar;
    state.innov = c.vec.innovation; state.resil = c.vec.resilience;
    state.reach = c.vec.platformReach ?? state.reach;
    state.activePreset = null; state.stage = "causal";
    state.mitSel = null; state.mitAiDone = false;
    render();
  }));

  // AI insight
  const aiKeyInp = document.getElementById("ai-key");
  if (aiKeyInp) aiKeyInp.addEventListener("input", (e) => { state.aiKey = e.target.value; });
  const aiGen = document.querySelector('[data-ai="gen"]');
  if (aiGen) aiGen.addEventListener("click", () => generateInsight(derived));
  const aiClear = document.querySelector('[data-ai="clear"]');
  if (aiClear) aiClear.addEventListener("click", () => { state.aiInsight = null; state.aiKey = ""; render(); });
}

function draw(derived, causalState, snappedQ) {
  if (state.stage === "causal" && state.causalView === "pathway") {
    const mount = document.getElementById("causal-mount");
    if (mount) renderCausal(mount, causalState);
  }
  if (state.stage === "causal" && state.causalView === "charts") {
    drawTrajectory(derived, snappedQ);
  }
  if (state.stage === "risk") {
    const mount = document.getElementById("radar-mount");
    if (mount) {
      const riskAll = state.data.meta.strategies.map((_, s) => deriveRiskScores(state.data, s, state.dm, snappedQ, ctx(), vec()));
      const baselineRisk = deriveRiskScores(state.data, state.traceStrat, PRESETS[0].dm, PRESETS[0].qstar, PRESETS[0].ctx, PRESETS[0].vec);
      const series = [
        ...riskAll.map((r, s) => ({ label: derived[s].label, color: STRAT_COLORS[s], values: [r.cost, r.lockin, r.regulatory, r.innovation, r.resilience], fill: s === state.traceStrat })),
        { label: "Status quo", color: "var(--exp-axis)", values: [baselineRisk.cost, baselineRisk.lockin, baselineRisk.regulatory, baselineRisk.innovation, baselineRisk.resilience], dashed: true, fill: false },
      ];
      renderRadar(mount, RADAR_AXES, series);
    }
  }
  if (state.stage === "mitigate") drawMitigation();
}

function drawTrajectory(derived, snappedQ) {
  const data = state.data;
  const chartEl = document.getElementById("chart-mount");
  const titleEl = document.getElementById("chart-title");
  if (!chartEl) return;

  if (state.tab === "strategy") {
    if (titleEl) titleEl.textContent = "CUMULATIVE PROFIT VS QUALITY THRESHOLD";
    const sweep = sweepCumProfit(data, state.dm, ctx(), vec());
    const series = sweep.map((ys, s) => ({ ys, color: STRAT_COLORS[s], width: 2 }));
    const guides = [
      { x: snappedQ, label: `threshold ${snappedQ.toFixed(2)}`, color: "var(--exp-marker)", dash: false },
      ...data.meta.strategies.map((st, s) => ({ x: st.Q, color: STRAT_COLORS[s], dash: true })),
    ];
    renderChart(chartEl, { xs: data.qstar_grid, series, xLabel: "Quality threshold", yLabel: "$M over horizon", vGuides: guides, zeroLine: true, xFormat: (v) => v.toFixed(1), yFormat: (v) => v.toFixed(0), height: 360 });
    return;
  }

  const key = state.tab;
  const activeTab = TABS.find((x) => x.key === key);
  if (titleEl) titleEl.textContent = `Trajectory, ${activeTab.label}`;
  const faint = [], bold = [];
  derived.forEach((d, s) => {
    d.samples.forEach((sm) => faint.push({ ys: sm[key], color: STRAT_COLORS[s], width: 1, opacity: 0.3 }));
    bold.push({ ys: d[key], color: STRAT_COLORS[s], width: 2 });
  });
  const guides = [
    { x: data.meta.params.tau, label: "\u03c4 revenue", color: "var(--exp-axis)" },
    { x: data.meta.params.t_shock, label: "price shock", color: "var(--exp-axis)" },
  ];
  renderChart(chartEl, { xs: data.t, series: [...faint, ...bold], title: METRIC_PANELS[key].title, xLabel: "months", yLabel: METRIC_PANELS[key].yLabel, vGuides: guides, zeroLine: METRIC_PANELS[key].zero, xFormat: (v) => `${Math.round(v)}`, yFormat: (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)), height: 360 });
}

function drawMitigation() {
  const data = state.data;
  const snappedQ = data.qstar_grid[qstarIndex(state.qstar, data.qstar_grid)];
  const base = { strat: state.traceStrat, dm: state.dm, qstar: snappedQ, vec: vec() };
  const candidates = proposeMitigations(data, base, ctx());
  const colorOf = {};
  candidates.forEach((c, i) => (colorOf[c.id] = CAND_COLORS[i % CAND_COLORS.length]));
  const primary = candidates.find((c) => c.id === state.mitPrimary) || candidates[0];
  const baseDerived = deriveStrategy(data, base.strat, base.dm, base.qstar, ctx(), base.vec);
  const selected = candidates.filter((c) => state.mitSel.includes(c.id));

  const chartEl = document.getElementById("mit-chart");
  if (chartEl) {
    const series = [{ ys: baseDerived.profit, color: "var(--exp-axis)", width: 2, opacity: 0.5 }];
    selected.forEach((c) => {
      const d = deriveStrategy(data, c.strat, c.dm, c.qstar, ctx(), c.vec);
      series.push({ ys: d.profit, color: colorOf[c.id], width: c.id === state.mitPrimary ? 2.8 : 2 });
    });
    renderChart(chartEl, { xs: data.t, series, xLabel: "months", yLabel: "$M / month", vGuides: [{ x: data.meta.params.t_shock, label: "price shock", color: "var(--exp-axis)" }], zeroLine: true, xFormat: (v) => `${Math.round(v)}`, yFormat: (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)), height: 300 });
  }
  const radarEl = document.getElementById("mit-radar");
  if (radarEl) {
    const baseRisk = deriveRiskScores(data, base.strat, base.dm, base.qstar, ctx(), base.vec);
    const primRisk = deriveRiskScores(data, primary.strat, primary.dm, primary.qstar, ctx(), primary.vec);
    renderRadar(radarEl, RADAR_AXES, [
      { label: "Before", color: "var(--exp-axis)", values: [baseRisk.cost, baseRisk.lockin, baseRisk.regulatory, baseRisk.innovation, baseRisk.resilience], dashed: true, fill: false },
      { label: "After", color: colorOf[primary.id], values: [primRisk.cost, primRisk.lockin, primRisk.regulatory, primRisk.innovation, primRisk.resilience], fill: true },
    ], 320);
  }
}

function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  state.dm = p.dm; state.qstar = p.qstar;
  state.innov = p.vec.innovation; state.resil = p.vec.resilience;
  state.reach = p.vec.platformReach ?? 50;
  state.tpf = p.ctx.tokenPriceFactor; state.reg = p.ctx.regPressure;
  state.activePreset = p.id;
  state.mitSel = null; state.mitAiDone = false;
  render();
}

async function generateInsight(derived) {
  state.aiError = null; state.aiInsight = null;
  const key = state.aiKey.trim();
  if (!key.startsWith("sk-ant-")) { state.aiError = "Enter a valid Anthropic API key (starts with sk-ant-)."; render(); return; }
  state.aiLoading = true; render();
  try {
    const snappedQ = state.data.qstar_grid[qstarIndex(state.qstar, state.data.qstar_grid)];
    const riskAll = state.data.meta.strategies.map((_, s) => deriveRiskScores(state.data, s, state.dm, snappedQ, ctx(), vec()));
    let best = 0;
    derived.forEach((d, i) => { if (d.cumProfit > derived[best].cumProfit) best = i; });
    const lines = derived.map((d, i) => {
      const r = riskAll[i];
      return `- ${d.label}: cumulative profit $${d.cumProfit.toFixed(0)}M; risks → cost ${Math.round(r.cost)}/100, lock-in ${Math.round(r.lockin)}/100, regulatory ${Math.round(r.regulatory)}/100`;
    });
    const prompt = [
      "You are a sober strategy advisor briefing a corporate executive on how aggressively to scale an AI product over the next 12-18 months.",
      "Internal levers the company controls are the strategy vector: quality, quality threshold, margin per customer, innovation and resilience. External factors it does not control are vendor token price and regulatory pressure (which feeds through into the effective token price).",
      "",
      "Current scenario assumptions (external):",
      `- Token price factor (vs. today): ${state.tpf}x`,
      `- Regulatory pressure: ${state.reg}/100`,
      "",
      "Model output for each strategy:",
      ...lines,
      "",
      `The model currently favours "${derived[best].label}" on cumulative profit.`,
      "",
      "Write a crisp executive briefing (max ~180 words). Be direct, no marketing language, no headings.",
      "Cover: (1) which path you recommend and why, (2) the single biggest risk and what would flip the decision, (3) a concrete adjustment to the strategy vector to mitigate the dominant external risk.",
      "Emphasise that 'margin per user' is an output of cost and user dynamics, not a real lever.",
    ].join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: "claude-3-5-sonnet-latest", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) { const txt = await res.text(); throw new Error(`Anthropic API error (${res.status}): ${txt.slice(0, 200)}`); }
    const json = await res.json();
    state.aiInsight = json?.content?.[0]?.text ?? "No response returned.";
  } catch (e) {
    state.aiError = e instanceof Error ? e.message : "Request failed.";
  } finally {
    state.aiLoading = false; render();
  }
}

init();
