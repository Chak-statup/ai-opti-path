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
) {
  const n = N.length;
  const margin = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);
  const chiVal = chi(Q, qstar, p);
  const m = p.m0 + dm * Q;
  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const gate = ti >= p.tau ? 1 : 0;
    const shock = ti >= p.t_shock ? 1 : 0;
    const comp = (p.phi * ti) / p.T;
    const om = gate * (m - p.dm_shock * shock) * N[i];
    const c = p.c_ac * (chiVal + comp) * N[i] + p.F;
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
): StrategyDerived {
  const p = data.meta.params;
  const t = data.t;
  const qi = qstarIndex(qstar, data.qstar_grid);
  const snapped = data.qstar_grid[qi];
  const strat = data.meta.strategies[s];
  const Q = strat.Q;

  const N = data.N[s][qi];
  const rawDet = deriveRaw(N, Q, snapped, dm, p, t);
  const det = toUnits(rawDet, N);
  const cumProfit = trapezoid(rawDet.profit, t) / M;

  const samples: MetricSeries[] = data.N_samples[s][qi].map((Ns) =>
    toUnits(deriveRaw(Ns, Q, snapped, dm, p, t), Ns),
  );

  return { label: strat.label, Q, cumProfit, samples, ...det };
}

// View B: cumulative profit ($M) for every Q* in the grid, per strategy.
export function sweepCumProfit(data: RunsData, dm: number): number[][] {
  const p = data.meta.params;
  const t = data.t;
  return data.meta.strategies.map((strat, s) =>
    data.qstar_grid.map((qstar, qi) => {
      const raw = deriveRaw(data.N[s][qi], strat.Q, qstar, dm, p, t);
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

  const d = deriveStrategy(data, s, dm, snapped);
  const usersEnd = d.users[d.users.length - 1];
  const usersNorm = clamp01(usersEnd / (p.K / 1000));

  const cumProfit = d.cumProfit;
  const profitNorm = clamp01(Math.abs(cumProfit) / 600);
  const shockNorm = clamp01(p.dm_shock / Math.max(margin, 0.1));

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
