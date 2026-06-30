// Scenario-explorer model: pure arithmetic on top of precomputed N trajectories.
// No simulation at runtime — runs.json carries the user trajectories.
//
// Two families of inputs:
//   • Strategy vector (INTERNAL — the company controls these): strategy Q,
//     quality threshold Q*, margin lever Δm, plus innovation and resilience
//     orientation. These are the levers the demo lets you move.
//   • Environment / context (EXTERNAL — the company does NOT control these):
//     vendor token price and regulatory pressure. Regulatory pressure feeds
//     through into the effective token price (compliance overhead the vendor
//     passes on), so the two are coupled, not independent.

export interface Params {
  K: number;
  N0: number;
  p: number;
  r: number;
  chi_min: number;
  chi_max: number;
  kappa: number;
  m0: number;
  dm_shock: number;
  phi: number;
  sigma: number;
  c_ac: number;
  F: number;
  tau: number;
  t_shock: number;
  T: number;
}

export interface ControlSpec {
  min?: number;
  max?: number;
  default: number;
  step?: number;
  label: string;
}

export interface StrategySpec {
  label: string;
  Q: number;
}

export interface RunsData {
  meta: {
    params: Params;
    controls: { dm: ControlSpec; qstar: ControlSpec };
    strategies: StrategySpec[];
  };
  t: number[];
  qstar_grid: number[];
  N: number[][][]; // [strategy][qstar][time]
  N_samples: number[][][][]; // [strategy][qstar][sample][time]
}

export interface MetricSeries {
  users: number[]; // thousands
  margin: number[]; // $M / step
  cost: number[]; // $M / step
  profit: number[]; // $M / step
}

export interface StrategyDerived extends MetricSeries {
  label: string;
  Q: number;
  cumProfit: number; // $M over horizon
  samples: MetricSeries[]; // 10 noisy paths
}

// ---- Internal strategy vector -------------------------------------------
// Innovation and resilience are company-level investments, not outcomes you
// read off — they are levers. Innovation buys product quality (lower churn,
// richer margin) at a higher fixed cost. Resilience buys vendor independence
// (shields the effective token price from shocks, lowers lock-in) at a
// smaller fixed cost.
export interface StrategyVector {
  innovation: number; // 0..100  — Build vs Buy axis (in-house build)
  resilience: number; // 0..100  — Vendor Choice axis (vendor independence)
  platformReach?: number; // 0..100 — Platform Ecosystem axis (scale of user base)
}

export const DEFAULT_VECTOR: StrategyVector = {
  innovation: 50,
  resilience: 50,
  platformReach: 50,
};

// Platform Ecosystem axis: scales the user base N. Contained pilots (low reach)
// shrink the base; mass-market apps (high reach) grow it. Both revenue and the
// variable token cost scale with N, so reach amplifies upside and shock
// exposure alike — the shape of every curve is unchanged, only its magnitude.
export function reachMul(vec: StrategyVector): number {
  return 0.6 + 0.8 * ((vec.platformReach ?? 50) / 100); // 0.6× .. 1.4×
}

// Scaling Strategy axis: a single 0..100 "aggressiveness" dial drives both the
// margin push (Δm) and the quality bar committed to (Q*) together. Cautious
// scaling keeps both low; aggressive scaling pushes margin and commits to a
// higher quality bar (more upside, more churn risk if the bar is missed).
export function scalingToKnobs(
  aggression: number,
  data: RunsData,
): { dm: number; qstar: number } {
  const a = Math.max(0, Math.min(100, aggression)) / 100;
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  const grid = data.qstar_grid;
  const qLo = grid[0];
  const qHi = grid[grid.length - 1];
  return {
    dm: dmMin + (dmMax - dmMin) * a,
    qstar: qLo + (qHi - qLo) * a,
  };
}

// Inverse: recover the aggressiveness dial (0..100) from the current Δm.
export function knobsToScaling(dm: number, data: RunsData): number {
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  if (dmMax === dmMin) return 50;
  return Math.max(0, Math.min(100, ((dm - dmMin) / (dmMax - dmMin)) * 100));
}

// How strongly regulatory pressure feeds through into the effective token
// price. At full regulatory pressure the effective token price is +60%.
const REG_TO_TOKEN = 0.6;

export function chi(Q: number, qstar: number, p: Params): number {
  return p.chi_min + (p.chi_max - p.chi_min) / (1 + Math.exp(p.kappa * (Q - qstar)));
}

// Snap a Q* value to the nearest grid point; returns its index.
export function qstarIndex(qstar: number, grid: number[]): number {
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Effective per-token cost multiplier the company actually faces. Regulatory
// pressure raises it (compliance cost passed through by the vendor); resilience
// investment shields the *upside* part of any spike.
export function effectiveTpf(ctx: ScenarioContext, vec: StrategyVector): number {
  const reg = clamp01(ctx.regPressure / 100);
  const raw = ctx.tokenPriceFactor * (1 + REG_TO_TOKEN * reg);
  const excess = raw - 1;
  const shield = 1 - 0.6 * (vec.resilience / 100); // up to 60% of the spike hedged away
  const shielded = excess > 0 ? excess * shield : excess;
  return 1 + shielded;
}

function trapezoid(y: number[], x: number[]): number {
  let s = 0;
  for (let i = 1; i < y.length; i++) {
    s += ((y[i] + y[i - 1]) / 2) * (x[i] - x[i - 1]);
  }
  return s;
}

// Derive money curves for one N trajectory (in $ per step and raw users).
function deriveRaw(
  N: number[],
  Q: number,
  qstar: number,
  dm: number,
  p: Params,
  t: number[],
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
) {
  const n = N.length;
  const margin = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);

  const innov = (vec.innovation - 50) / 50; // -1..1
  // Innovation lowers churn and lifts margin; resilience shields token cost.
  const chiVal = chi(Q, qstar, p) * (1 - 0.15 * innov);
  const m = (p.m0 + dm * Q) * (1 + 0.25 * innov);
  const tpf = effectiveTpf(ctx, vec);
  // Investing in innovation and resilience raises fixed cost.
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

const M = 1e6;
const K_UNIT = 1e3;

function toUnits(raw: { margin: number[]; cost: number[]; profit: number[] }, N: number[]): MetricSeries {
  return {
    users: N.map((v) => v / K_UNIT),
    margin: raw.margin.map((v) => v / M),
    cost: raw.cost.map((v) => v / M),
    profit: raw.profit.map((v) => v / M),
  };
}

export function deriveStrategy(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): StrategyDerived {
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

  const samples: MetricSeries[] = data.N_samples[s][qi].map((Ns0) => {
    const Ns = Ns0.map((v) => v * reach);
    return toUnits(deriveRaw(Ns, Q, snapped, dm, p, t, ctx, vec), Ns);
  });

  return { label: strat.label, Q, cumProfit, samples, ...det };
}

// View B: cumulative profit ($M) for every Q* in the grid, per strategy.
export function sweepCumProfit(
  data: RunsData,
  dm: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): number[][] {
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

// ---- Interactive causal state -------------------------------------------
export interface CausalState {
  Q: number;
  churn: number; // χ value
  churnNorm: number; // 0 good .. 1 bad
  margin: number; // m per user
  marginNorm: number; // 0 .. 1
  comp: number; // competition pressure 0 .. 1
  usersEnd: number; // final users (thousands)
  usersNorm: number; // 0 .. 1
  cumProfit: number; // $M over horizon
  profitNorm: number; // 0 .. 1 magnitude
  shockNorm: number; // 0 .. 1 size of price-shock hit
  tpfEff: number; // effective token price multiplier
  profitPos: boolean;
}

export function computeCausalState(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): CausalState {
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
    Q,
    churn,
    churnNorm,
    margin,
    marginNorm,
    comp,
    usersEnd,
    usersNorm,
    cumProfit,
    profitNorm,
    shockNorm,
    tpfEff,
    profitPos: cumProfit >= 0,
  };
}

// ---- Scenario context, risk radar & tipping points ----------------------
export interface ScenarioContext {
  tokenPriceFactor: number; // 1 = today, 3 = vendor triples token price
  regPressure: number; // 0..100 regulatory / compliance load
}

export const DEFAULT_CONTEXT: ScenarioContext = {
  tokenPriceFactor: 1.5,
  regPressure: 30,
};

export interface ScenarioPreset {
  id: string;
  label: string;
  blurb: string;
  ctx: ScenarioContext;
  dm: number;
  qstar: number;
  vec: StrategyVector;
}

export const PRESETS: ScenarioPreset[] = [
  {
    id: "status-quo",
    label: "Status quo",
    blurb: "Today's prices, moderate compliance, balanced strategy vector.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 30 },
    dm: 6,
    qstar: 0.5,
    vec: { innovation: 50, resilience: 50, platformReach: 50 },
  },
  {
    id: "pricing-shock",
    label: "Pricing shock",
    blurb: "The vendor triples token prices after market consolidation.",
    ctx: { tokenPriceFactor: 3, regPressure: 30 },
    dm: 6,
    qstar: 0.5,
    vec: { innovation: 50, resilience: 50 },
  },
  {
    id: "regulatory-stress",
    label: "Regulatory stress test",
    blurb: "Heavy audit duty raises the effective token price for every AI app.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 80 },
    dm: 6,
    qstar: 0.5,
    vec: { innovation: 50, resilience: 50 },
  },
  {
    id: "oss-breakthrough",
    label: "Open-source breakthrough",
    blurb: "An open model matches the frontier, token cost collapses.",
    ctx: { tokenPriceFactor: 0.6, regPressure: 30 },
    dm: 8,
    qstar: 0.5,
    vec: { innovation: 60, resilience: 60 },
  },
];

function totals(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext,
  vec: StrategyVector,
) {
  const d = deriveStrategy(data, s, dm, qstar, ctx, vec);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    cumMargin: sum(d.margin),
    cumCost: sum(d.cost),
    cumProfit: d.cumProfit,
    usersEnd: d.users[d.users.length - 1],
  };
}

export interface RiskScores {
  cost: number; // risk: higher = worse
  lockin: number; // risk
  regulatory: number; // risk
  innovation: number; // strength: higher = better
  resilience: number; // strength
}

export function deriveRiskScores(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): RiskScores {
  const Q = data.meta.strategies[s].Q;
  const tt = totals(data, s, dm, qstar, ctx, vec);
  const tpfEff = effectiveTpf(ctx, vec);

  const costRatio = tt.cumCost / Math.max(tt.cumMargin, 1e-9);
  const cost = clamp01(costRatio / 1.4) * 100;

  // Lock-in grows with quality and effective price, but resilience investment
  // (multi-vendor / hedging) buys it back down.
  const lockin =
    clamp01(Q * (0.55 + 0.45 * (tpfEff / 4)) * (1 - 0.5 * (vec.resilience / 100))) * 100;

  const regulatory = clamp01(ctx.regPressure / 100) * 100;

  // Innovation strength is mostly the investment, with a quality contribution
  // and a regulatory drag.
  const innovation = clamp01(0.6 * (vec.innovation / 100) + 0.4 * Q - ctx.regPressure / 300) * 100;

  // Resilience strength is the investment plus a profit cushion.
  const resilience = clamp01(0.3 + 0.5 * (vec.resilience / 100) + tt.cumProfit / 1000) * 100;

  return { cost, lockin, regulatory, innovation, resilience };
}

export interface TippingPoint {
  key: string;
  label: string;
  value: number; // 0..100
  threshold: number;
  belowIsBad: boolean;
  crossed: boolean;
  explanation: string;
}

export function deriveTippingPoints(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): TippingPoint[] {
  const r = deriveRiskScores(data, s, dm, qstar, ctx, vec);
  const pts: TippingPoint[] = [
    {
      key: "cost",
      label: "Token cost risk",
      value: r.cost,
      threshold: 65,
      belowIsBad: false,
      crossed: r.cost >= 65,
      explanation:
        "Past this line, token cost outruns product margin, every new user at full scale adds a loss, and shutting apps off costs reputation.",
    },
    {
      key: "lockin",
      label: "Vendor lock-in",
      value: r.lockin,
      threshold: 70,
      belowIsBad: false,
      crossed: r.lockin >= 70,
      explanation:
        "Past this line, switching costs exceed the migration benefit. Price negotiations lose their basis and market power shifts to the vendor.",
    },
    {
      key: "regulatory",
      label: "Regulatory load",
      value: r.regulatory,
      threshold: 72,
      belowIsBad: false,
      crossed: r.regulatory >= 72,
      explanation:
        "Past this line, compliance consumes most of the AI build capacity and innovation cycles stretch beyond 18 months.",
    },
    {
      key: "innovation",
      label: "Innovation erosion",
      value: r.innovation,
      threshold: 40,
      belowIsBad: true,
      crossed: r.innovation < 40,
      explanation:
        "Below this line, the company loses pace with the market, competitors build a structural lead within a year.",
    },
  ];
  return pts;
}

// ---- Mitigation engine --------------------------------------------------
// Given the current (possibly shocked) scenario, propose several alternative
// strategy vectors and simulate each against the same environment. This is the
// "what do we change, and what happens" engine behind the before/after view.
export interface MitigationCandidate {
  id: string;
  label: string;
  rationale: string;
  strat: number;
  dm: number;
  qstar: number;
  vec: StrategyVector;
  cumProfit: number;
  deltaVsBaseline: number;
}

export interface MitigationBaseline {
  strat: number;
  dm: number;
  qstar: number;
  vec: StrategyVector;
}

export function proposeMitigations(
  data: RunsData,
  base: MitigationBaseline,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
): MitigationCandidate[] {
  const dmMax = data.meta.controls.dm.max ?? 12;
  const dmMin = data.meta.controls.dm.min ?? 0;
  const grid = data.qstar_grid;
  const lo = grid[0];
  const hi = grid[grid.length - 1];
  const nStrat = data.meta.strategies.length;
  const clampDm = (v: number) => Math.max(dmMin, Math.min(dmMax, v));
  const clampQ = (v: number) => Math.max(lo, Math.min(hi, v));

  const baseProfit = deriveStrategy(data, base.strat, base.dm, base.qstar, ctx, base.vec).cumProfit;

  const raw: Omit<MitigationCandidate, "cumProfit" | "deltaVsBaseline">[] = [
    {
      id: "hedge",
      label: "Hedge the vendor",
      rationale:
        "Invest hard in resilience, multi-vendor serving and open-weight fallbacks, to absorb the token-price spike instead of passing it on.",
      strat: base.strat,
      dm: base.dm,
      qstar: base.qstar,
      vec: { innovation: base.vec.innovation, resilience: 90 },
    },
    {
      id: "retain",
      label: "Defend through retention",
      rationale:
        "Push innovation and per-customer margin to keep users longer, so you refill a smaller, cheaper churn bucket as cost rises.",
      strat: base.strat,
      dm: clampDm(base.dm + 3),
      qstar: clampQ(base.qstar - 0.1),
      vec: { innovation: 85, resilience: Math.max(60, base.vec.resilience) },
    },
    {
      id: "trim",
      label: "Trim exposure",
      rationale:
        "Step down to a lighter strategy and a lower quality bar, cutting the per-user serving cost most exposed to the shock.",
      strat: Math.max(0, base.strat - 1),
      dm: base.dm,
      qstar: clampQ(base.qstar - 0.12),
      vec: { innovation: Math.min(60, base.vec.innovation), resilience: 75 },
    },
    {
      id: "balance",
      label: "Balanced reset",
      rationale:
        "Re-center the whole vector: mid strategy, balanced margin, and a healthy lift in both innovation and resilience.",
      strat: Math.min(nStrat - 1, 1),
      dm: clampDm(6),
      qstar: clampQ(0.5),
      vec: { innovation: 65, resilience: 70 },
    },
  ];

  return raw
    .map((c) => {
      const cumProfit = deriveStrategy(data, c.strat, c.dm, c.qstar, ctx, c.vec).cumProfit;
      return { ...c, cumProfit, deltaVsBaseline: cumProfit - baseProfit };
    })
    .sort((a, b) => b.cumProfit - a.cumProfit);
}
