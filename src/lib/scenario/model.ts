// Scenario-explorer model: pure arithmetic on top of precomputed N trajectories.
// No simulation at runtime — runs.json carries the user trajectories.

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
) {
  const n = N.length;
  const margin = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);
  const chiVal = chi(Q, qstar, p);
  const m = p.m0 + dm * Q;
  // Token price factor scales the variable (per-user) cost — the "vendor
  // doubles token prices" lever. Regulatory pressure inflates fixed cost.
  const tpf = ctx.tokenPriceFactor;
  const F = p.F * (1 + ctx.regPressure / 100);
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
): StrategyDerived {
  const p = data.meta.params;
  const t = data.t;
  const qi = qstarIndex(qstar, data.qstar_grid);
  const snapped = data.qstar_grid[qi];
  const strat = data.meta.strategies[s];
  const Q = strat.Q;

  const N = data.N[s][qi];
  const rawDet = deriveRaw(N, Q, snapped, dm, p, t, ctx);
  const det = toUnits(rawDet, N);
  const cumProfit = trapezoid(rawDet.profit, t) / M;

  const samples: MetricSeries[] = data.N_samples[s][qi].map((Ns) =>
    toUnits(deriveRaw(Ns, Q, snapped, dm, p, t, ctx), Ns),
  );

  return { label: strat.label, Q, cumProfit, samples, ...det };
}

// View B: cumulative profit ($M) for every Q* in the grid, per strategy.
export function sweepCumProfit(
  data: RunsData,
  dm: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
): number[][] {
  const p = data.meta.params;
  const t = data.t;
  return data.meta.strategies.map((strat, s) =>
    data.qstar_grid.map((qstar, qi) => {
      const raw = deriveRaw(data.N[s][qi], strat.Q, qstar, dm, p, t, ctx);
      return trapezoid(raw.profit, t) / M;
    }),
  );
}


// ---- Interactive causal state -------------------------------------------
// Live values that drive the causal pathway diagram. Everything here is a
// direct read of the same arithmetic used for the trajectories, so the graph
// and the charts can never disagree.
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
  profitPos: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeCausalState(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
): CausalState {
  const p = data.meta.params;
  const qi = qstarIndex(qstar, data.qstar_grid);
  const snapped = data.qstar_grid[qi];
  const Q = data.meta.strategies[s].Q;

  const churn = chi(Q, snapped, p);
  const churnNorm = clamp01((churn - p.chi_min) / (p.chi_max - p.chi_min));

  const margin = p.m0 + dm * Q;
  const dmMax = data.meta.controls.dm.max ?? 12;
  const marginNorm = clamp01((margin - p.m0) / (dmMax * 1));

  const comp = clamp01(p.phi / 0.5);

  const d = deriveStrategy(data, s, dm, snapped, ctx);
  const usersEnd = d.users[d.users.length - 1];
  const usersNorm = clamp01(usersEnd / (p.K / 1000));

  const cumProfit = d.cumProfit;
  const profitNorm = clamp01(Math.abs(cumProfit) / 600);
  const shockNorm = clamp01((p.dm_shock + (ctx.tokenPriceFactor - 1) * 1.5) / Math.max(margin, 0.1));


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
    profitPos: cumProfit >= 0,
  };
}

// ---- Scenario context, risk radar & tipping points ----------------------
// Two extra knobs ground the "what could change" question. They feed the same
// arithmetic, so the radar and tipping points never disagree with the charts.
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
}

export const PRESETS: ScenarioPreset[] = [
  {
    id: "status-quo",
    label: "Status quo",
    blurb: "Today's prices, moderate compliance, balanced margin.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 30 },
    dm: 6,
    qstar: 0.5,
  },
  {
    id: "pricing-shock",
    label: "Pricing shock",
    blurb: "The vendor triples token prices after market consolidation.",
    ctx: { tokenPriceFactor: 3, regPressure: 30 },
    dm: 6,
    qstar: 0.5,
  },
  {
    id: "regulatory-stress",
    label: "Regulatory stress test",
    blurb: "Full audit duty for every AI app on an 18-month deadline.",
    ctx: { tokenPriceFactor: 1.5, regPressure: 80 },
    dm: 6,
    qstar: 0.5,
  },
  {
    id: "oss-breakthrough",
    label: "Open-source breakthrough",
    blurb: "An open model matches the frontier — token cost collapses.",
    ctx: { tokenPriceFactor: 0.6, regPressure: 30 },
    dm: 8,
    qstar: 0.5,
  },
];

function totals(data: RunsData, s: number, dm: number, qstar: number, ctx: ScenarioContext) {
  const d = deriveStrategy(data, s, dm, qstar, ctx);
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

// Each axis 0..100. Cost / lock-in / regulatory are risks; innovation /
// resilience are strengths. Plain-language text carries the direction.
export function deriveRiskScores(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
): RiskScores {
  const p = data.meta.params;
  const Q = data.meta.strategies[s].Q;
  const tt = totals(data, s, dm, qstar, ctx);

  const costRatio = tt.cumCost / Math.max(tt.cumMargin, 1e-9);
  const cost = clamp01(costRatio / 1.4) * 100;

  const lockin = clamp01(Q * (0.55 + 0.45 * (ctx.tokenPriceFactor / 4))) * 100;

  const regulatory = clamp01(ctx.regPressure / 100) * 100;

  const innovation = clamp01(Q * 1.05 - ctx.regPressure / 220) * 100;

  const resilience = clamp01(0.5 + tt.cumProfit / 600) * 100;

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
): TippingPoint[] {
  const r = deriveRiskScores(data, s, dm, qstar, ctx);
  const pts: TippingPoint[] = [
    {
      key: "cost",
      label: "Token cost risk",
      value: r.cost,
      threshold: 65,
      belowIsBad: false,
      crossed: r.cost >= 65,
      explanation:
        "Past this line, token cost outruns product margin — every new user at full scale adds a loss, and shutting apps off costs reputation.",
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
        "Below this line, the company loses pace with the market — competitors build a structural lead within a year.",
    },
  ];
  return pts;
}
