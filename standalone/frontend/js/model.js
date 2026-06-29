// model.js — pure arithmetic port of the scenario model (from src/lib/scenario/model.ts).
// Operates on the precomputed N trajectories carried in runs.json.

const M = 1e6;
const K_UNIT = 1e3;

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

function trapezoid(y, x) {
  let s = 0;
  for (let i = 1; i < y.length; i++) {
    s += ((y[i] + y[i - 1]) / 2) * (x[i] - x[i - 1]);
  }
  return s;
}

// Derive money curves for one N trajectory (in $ per step and raw users).
function deriveRaw(N, Q, qstar, dm, p, t) {
  const n = N.length;
  const margin = new Array(n);
  const cost = new Array(n);
  const profit = new Array(n);
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

function toUnits(raw, N) {
  return {
    users: N.map((v) => v / K_UNIT),
    margin: raw.margin.map((v) => v / M),
    cost: raw.cost.map((v) => v / M),
    profit: raw.profit.map((v) => v / M),
  };
}

export function deriveStrategy(data, s, dm, qstar) {
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

  const samples = data.N_samples[s][qi].map((Ns) =>
    toUnits(deriveRaw(Ns, Q, snapped, dm, p, t), Ns),
  );

  return { label: strat.label, Q, cumProfit, samples, ...det };
}

// Cumulative profit ($M) for every Q* in the grid, per strategy.
export function sweepCumProfit(data, dm) {
  const p = data.meta.params;
  const t = data.t;
  return data.meta.strategies.map((strat, s) =>
    data.qstar_grid.map((qstar, qi) => {
      const raw = deriveRaw(data.N[s][qi], strat.Q, qstar, dm, p, t);
      return trapezoid(raw.profit, t) / M;
    }),
  );
}
