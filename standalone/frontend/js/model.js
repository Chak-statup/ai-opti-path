// model.js — pure arithmetic port of the scenario model (src/lib/scenario/model.ts).
// Operates on the precomputed N trajectories carried in runs.json.
//
// Two families of inputs:
//   • Strategy vector (INTERNAL — the company controls these): strategy Q,
//     quality threshold Q*, margin lever Δm, plus in-house build (innovation),
//     vendor independence (resilience) and platform reach.
//   • Environment / context (EXTERNAL): vendor token price and regulatory
//     pressure. Regulatory pressure feeds through into the effective token price.

const M = 1e6;
const K_UNIT = 1e3;

export const DEFAULT_VECTOR = { innovation: 50, resilience: 50, platformReach: 50 };
export const DEFAULT_CONTEXT = { tokenPriceFactor: 1.5, regPressure: 30 };

// How strongly regulatory pressure feeds into the effective token price.
const REG_TO_TOKEN = 0.6;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Platform Ecosystem axis: scales the user base N (0.6× .. 1.4×).
export function reachMul(vec) {
  return 0.6 + 0.8 * ((vec.platformReach ?? 50) / 100);
}

// Scaling Strategy axis: one 0..100 dial drives both Δm and Q* together.
export function scalingToKnobs(aggression, data) {
  const a = Math.max(0, Math.min(100, aggression)) / 100;
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  const grid = data.qstar_grid;
  const qLo = grid[0];
  const qHi = grid[grid.length - 1];
  return { dm: dmMin + (dmMax - dmMin) * a, qstar: qLo + (qHi - qLo) * a };
}

export function knobsToScaling(dm, data) {
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  if (dmMax === dmMin) return 50;
  return Math.max(0, Math.min(100, ((dm - dmMin) / (dmMax - dmMin)) * 100));
}

export function chi(Q, qstar, p) {
  return p.chi_min + (p.chi_max - p.chi_min) / (1 + Math.exp(p.kappa * (Q - qstar)));
}

// Snap a Q* value to the nearest grid point; return its index.
export function qstarIndex(qstar, grid) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < grid.length; i++) {
    const d = Math.abs(grid[i] - qstar);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Effective per-token cost multiplier the company actually faces.
export function effectiveTpf(ctx, vec) {
  const reg = clamp01(ctx.regPressure / 100);
  const raw = ctx.tokenPriceFactor * (1 + REG_TO_TOKEN * reg);
  const excess = raw - 1;
  const shield = 1 - 0.6 * (vec.resilience / 100);
  const shielded = excess > 0 ? excess * shield : excess;
  return 1 + shielded;
}

function trapezoid(y, x) {
  let s = 0;
  for (let i = 1; i < y.length; i++) {
    s += ((y[i] + y[i - 1]) / 2) * (x[i] - x[i - 1]);
  }
  return s;
}

// Derive money curves for one N trajectory (in $ per step and raw users).
function deriveRaw(N, Q, qstar, dm, p, t, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const n = N.length;
  const margin = new Array(n);
  const cost = new Array(n);
  const profit = new Array(n);

  const innov = (vec.innovation - 50) / 50; // -1..1
  const chiVal = chi(Q, qstar, p) * (1 - 0.15 * innov);
  const m = (p.m0 + dm * Q) * (1 + 0.25 * innov);
  const tpf = effectiveTpf(ctx, vec);
  const F = p.F * (1 + 0.4 * (vec.innovation / 100) + 0.2 * (vec.resilience / 100));

  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const gate = ti >= p.tau ? 1 : 0;
    const shock = ti >= p.t_shock ? 1 : 0;
    const comp = (p.phi * ti) / p.T;
    const om = gate * (m - p.dm_shock * shock) * N[i];
    const c = p.c_ac * tpf * (chiVal + comp) * N[i] + F;
    margin[i] = om;
    cost[i] = c;
    profit[i] = om - c;
  }
  return { margin, cost, profit };
}

function toUnits(raw, N) {
  return {
    users: N.map((v) => v / K_UNIT),
    margin: raw.margin.map((v) => v / M),
    cost: raw.cost.map((v) => v / M),
    profit: raw.profit.map((v) => v / M),
  };
}

export function deriveStrategy(data, s, dm, qstar, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const p = data.meta.params;
  const t = data.t;
  const qi = qstarIndex(qstar, data.qstar_grid);
  const snapped = data.qstar_grid[qi];
  const strat = data.meta.strategies[s];
  const Q = strat.Q;

  const reach = reachMul(vec);
  const N = data.N[s][qi].map((v) => v * reach);
  const rawDet = deriveRaw(N, Q, snapped, dm, p, t, ctx, vec);
  const det = toUnits(rawDet, N);
  const cumProfit = trapezoid(rawDet.profit, t) / M;

  const samples = data.N_samples[s][qi].map((Ns0) => {
    const Ns = Ns0.map((v) => v * reach);
    return toUnits(deriveRaw(Ns, Q, snapped, dm, p, t, ctx, vec), Ns);
  });

  return { label: strat.label, Q, cumProfit, samples, ...det };
}

// Cumulative profit ($M) for every Q* in the grid, per strategy.
export function sweepCumProfit(data, dm, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const p = data.meta.params;
  const t = data.t;
  const reach = reachMul(vec);
  return data.meta.strategies.map((strat, s) =>
    data.qstar_grid.map((qstar, qi) => {
      const N = data.N[s][qi].map((v) => v * reach);
      const raw = deriveRaw(N, strat.Q, qstar, dm, p, t, ctx, vec);
      return trapezoid(raw.profit, t) / M;
    }),
  );
}

// ---- Interactive causal state ------------------------------------------
export function computeCausalState(data, s, dm, qstar, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const p = data.meta.params;
  const qi = qstarIndex(qstar, data.qstar_grid);
  const snapped = data.qstar_grid[qi];
  const Q = data.meta.strategies[s].Q;

  const innov = (vec.innovation - 50) / 50;
  const churn = chi(Q, snapped, p) * (1 - 0.15 * innov);
  const churnNorm = clamp01((churn - p.chi_min) / (p.chi_max - p.chi_min));

  const margin = (p.m0 + dm * Q) * (1 + 0.25 * innov);
  const dmMax = data.meta.controls.dm.max ?? 12;
  const marginNorm = clamp01((margin - p.m0) / (dmMax * 1));

  const comp = clamp01(p.phi / 0.5);

  const d = deriveStrategy(data, s, dm, snapped, ctx, vec);
  const usersEnd = d.users[d.users.length - 1];
  const usersNorm = clamp01(usersEnd / (p.K / 1000));

  const cumProfit = d.cumProfit;
  const profitNorm = clamp01(Math.abs(cumProfit) / 600);
  const tpfEff = effectiveTpf(ctx, vec);
  const shockNorm = clamp01((p.dm_shock + (tpfEff - 1) * 1.5) / Math.max(margin, 0.1));

  return {
    Q, churn, churnNorm, margin, marginNorm, comp,
    usersEnd, usersNorm, cumProfit, profitNorm, shockNorm, tpfEff,
    profitPos: cumProfit >= 0,
  };
}

// ---- Scenario presets ---------------------------------------------------
export const PRESETS = [
  {
    id: "status-quo",
    label: "Status quo",
    blurb: "Today's prices, moderate compliance, balanced strategy vector.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 30 },
    dm: 6, qstar: 0.5,
    vec: { innovation: 50, resilience: 50, platformReach: 50 },
  },
  {
    id: "pricing-shock",
    label: "Pricing shock",
    blurb: "The vendor triples token prices after market consolidation.",
    ctx: { tokenPriceFactor: 3, regPressure: 30 },
    dm: 6, qstar: 0.5,
    vec: { innovation: 50, resilience: 50, platformReach: 70 },
  },
  {
    id: "regulatory-stress",
    label: "Regulatory stress test",
    blurb: "Heavy audit duty raises the effective token price for every AI app.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 80 },
    dm: 6, qstar: 0.5,
    vec: { innovation: 50, resilience: 50, platformReach: 50 },
  },
  {
    id: "oss-breakthrough",
    label: "Open-source breakthrough",
    blurb: "An open model matches the frontier, token cost collapses.",
    ctx: { tokenPriceFactor: 0.6, regPressure: 30 },
    dm: 8, qstar: 0.5,
    vec: { innovation: 60, resilience: 60, platformReach: 65 },
  },
];

function totals(data, s, dm, qstar, ctx, vec) {
  const d = deriveStrategy(data, s, dm, qstar, ctx, vec);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return {
    cumMargin: sum(d.margin),
    cumCost: sum(d.cost),
    cumProfit: d.cumProfit,
    usersEnd: d.users[d.users.length - 1],
  };
}

export function deriveRiskScores(data, s, dm, qstar, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const Q = data.meta.strategies[s].Q;
  const tt = totals(data, s, dm, qstar, ctx, vec);
  const tpfEff = effectiveTpf(ctx, vec);

  const costRatio = tt.cumCost / Math.max(tt.cumMargin, 1e-9);
  const cost = clamp01(costRatio / 1.4) * 100;

  const lockin =
    clamp01(Q * (0.55 + 0.45 * (tpfEff / 4)) * (1 - 0.5 * (vec.resilience / 100))) * 100;

  const regulatory = clamp01(ctx.regPressure / 100) * 100;

  const innovation = clamp01(0.6 * (vec.innovation / 100) + 0.4 * Q - ctx.regPressure / 300) * 100;

  const resilience = clamp01(0.3 + 0.5 * (vec.resilience / 100) + tt.cumProfit / 1000) * 100;

  return { cost, lockin, regulatory, innovation, resilience };
}

export function deriveTippingPoints(data, s, dm, qstar, ctx = DEFAULT_CONTEXT, vec = DEFAULT_VECTOR) {
  const r = deriveRiskScores(data, s, dm, qstar, ctx, vec);
  return [
    {
      key: "cost", label: "Token cost risk", value: r.cost, threshold: 65,
      belowIsBad: false, crossed: r.cost >= 65,
      explanation:
        "Past this line, token cost outruns product margin, every new user at full scale adds a loss, and shutting apps off costs reputation.",
    },
    {
      key: "lockin", label: "Vendor lock-in", value: r.lockin, threshold: 70,
      belowIsBad: false, crossed: r.lockin >= 70,
      explanation:
        "Past this line, switching costs exceed the migration benefit. Price negotiations lose their basis and market power shifts to the vendor.",
    },
    {
      key: "regulatory", label: "Regulatory load", value: r.regulatory, threshold: 72,
      belowIsBad: false, crossed: r.regulatory >= 72,
      explanation:
        "Past this line, compliance consumes most of the AI build capacity and innovation cycles stretch beyond 18 months.",
    },
    {
      key: "innovation", label: "Innovation erosion", value: r.innovation, threshold: 40,
      belowIsBad: true, crossed: r.innovation < 40,
      explanation:
        "Below this line, the company loses pace with the market, competitors build a structural lead within a year.",
    },
  ];
}

// ---- Mitigation engine --------------------------------------------------
export function proposeMitigations(data, base, ctx = DEFAULT_CONTEXT) {
  const dmMax = data.meta.controls.dm.max ?? 12;
  const dmMin = data.meta.controls.dm.min ?? 0;
  const grid = data.qstar_grid;
  const lo = grid[0];
  const hi = grid[grid.length - 1];
  const nStrat = data.meta.strategies.length;
  const clampDm = (v) => Math.max(dmMin, Math.min(dmMax, v));
  const clampQ = (v) => Math.max(lo, Math.min(hi, v));

  const baseProfit = deriveStrategy(data, base.strat, base.dm, base.qstar, ctx, base.vec).cumProfit;

  const raw = [
    {
      id: "hedge", label: "Hedge the vendor",
      rationale:
        "Invest hard in resilience, multi-vendor serving and open-weight fallbacks, to absorb the token-price spike instead of passing it on.",
      strat: base.strat, dm: base.dm, qstar: base.qstar,
      vec: { innovation: base.vec.innovation, resilience: 90, platformReach: base.vec.platformReach },
    },
    {
      id: "retain", label: "Defend through retention",
      rationale:
        "Push innovation and per-customer margin to keep users longer, so you refill a smaller, cheaper churn bucket as cost rises.",
      strat: base.strat, dm: clampDm(base.dm + 3), qstar: clampQ(base.qstar - 0.1),
      vec: { innovation: 85, resilience: Math.max(60, base.vec.resilience), platformReach: base.vec.platformReach },
    },
    {
      id: "trim", label: "Trim exposure",
      rationale:
        "Step down to a lighter strategy and a lower quality bar, cutting the per-user serving cost most exposed to the shock.",
      strat: Math.max(0, base.strat - 1), dm: base.dm, qstar: clampQ(base.qstar - 0.12),
      vec: { innovation: Math.min(60, base.vec.innovation), resilience: 75, platformReach: base.vec.platformReach },
    },
    {
      id: "balance", label: "Balanced reset",
      rationale:
        "Re-center the whole vector: mid strategy, balanced margin, and a healthy lift in both innovation and resilience.",
      strat: Math.min(nStrat - 1, 1), dm: clampDm(6), qstar: clampQ(0.5),
      vec: { innovation: 65, resilience: 70, platformReach: base.vec.platformReach },
    },
  ];

  return raw
    .map((c) => {
      const cumProfit = deriveStrategy(data, c.strat, c.dm, c.qstar, ctx, c.vec).cumProfit;
      return { ...c, cumProfit, deltaVsBaseline: cumProfit - baseProfit };
    })
    .sort((a, b) => b.cumProfit - a.cumProfit);
}
