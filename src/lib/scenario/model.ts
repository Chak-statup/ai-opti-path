// AI-strategy scenario model — a real, live dynamical simulation.
//
// The user base N(t) is SIMULATED in the browser (Euler–Maruyama on a logistic
// growth + churn + competition SDE) every time a lever moves, so the growth
// curve genuinely reacts to the strategy — nothing is a frozen precomputed
// trajectory. On top of the simulated N(t) we net a transparent P&L in euros.
//
// Two families of inputs:
//   • Strategy vector (INTERNAL — the company controls these), each a 0..100
//     slider with a documented, comparable effect (see CALIB):
//       – Platform reach       → scales the addressable market K (dynamics)
//       – In-house build       → lowers churn χ + lifts ARPU (dynamics + €)
//       – Vendor independence  → shields token-price spikes + lowers lock-in (€)
//       – Scaling aggressiveness → couples the ARPU premium Δm and quality bar Q*
//     plus the discrete strategy choice Q (product quality tier).
//   • Environment (EXTERNAL — not controlled):
//       – Token price factor   → per-user serving cost (COGS); a "pricing shock"
//                                is simply a high level of this.
//       – Regulatory pressure  → a DISTINCT force: raises fixed compliance cost
//                                and slows innovation throughput (not token price).

// ---- Calibration ---------------------------------------------------------
// One place for every magnitude, so no coefficient is hidden. Absolute euros
// unless noted. Every strategy slider is 0..100 (0 = minimal posture, 50 =
// today's baseline, 100 = maximum investment); the "full-scale" comments below
// state exactly what the slider does at 100.
export const CALIB = {
  // Market & growth (DYNAMICAL — these enter the simulated user ODE)
  K_min: 2_000_000, // addressable market at platform reach 0 (contained pilot)
  K_max: 15_000_000, // addressable market at platform reach 100 (mass-market)
  N0: 40_000, // active users at t = 0
  p: 0.008, // external acquisition rate / month
  r: 0.35, // word-of-mouth growth rate / month
  chiMin: 0.02, // churn floor / month
  chiMax: 0.3, // churn ceiling / month
  kappa: 12, // churn-cliff steepness
  phi: 0.35, // peak competitive-loss rate / month (ramps 0 → phi over horizon)
  sigma: 0.16, // demand volatility (state-proportional, drives sample spread)

  // In-house build (innovation) — DYNAMICAL + economic
  innovChurnCut: 0.3, // full build cuts churn by 30% (the retention channel)
  innovArpuLift: 0.2, // ... and lifts ARPU by 20%

  // Vendor independence (resilience) — economic (shock buffer)
  resilShield: 0.7, // full resilience absorbs 70% of a serving-cost spike
  resilLockCut: 0.6, // ... and cuts lock-in exposure by 60%

  // Economics (euros / active user / month unless noted)
  arpu0: 9, // base ARPU (revenue per active user / month) at Q = 0
  serve0: 2.5, // serving (token) cost per active user at price ×1.0
  cac: 20, // cost to (re)acquire one user (marketing/onboarding; NOT token-priced)

  // Fixed cost (euros / month)
  F0: 4_000_000, // baseline org / infra
  F_innov: 5_000_000, // full in-house build adds this (talent, dev)
  F_resil: 1_500_000, // full resilience adds this (portability engineering)
  F_reg: 3_000_000, // full regulation adds this (compliance, audit, legal)

  // Regulation (external) — distinct from token price
  regInnovDrag: 0.4, // full regulation slows innovation delivery by 40%
  regComplianceBuffer: 0.3, // resilience + build buy down compliance overhead

  // Timing
  tau: 6, // deployment → revenue lag (months)
  T: 54, // horizon (months)
  steps: 361, // integration steps
} as const;

const M = 1e6; // euros → €M
const MU = 1e6; // users → millions

// ---- Types --------------------------------------------------------------
export interface Params {
  K_min: number;
  K_max: number;
  N0: number;
  tau: number;
  T: number;
  dmMax: number; // scaling ARPU-premium ceiling (mirrors controls.dm.max)
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

// Metadata bundle passed around the app. N(t) is NOT stored here — it is
// simulated live inside deriveStrategy from the current strategy vector.
export interface RunsData {
  meta: {
    params: Params;
    controls: { dm: ControlSpec; qstar: ControlSpec };
    strategies: StrategySpec[];
  };
  t: number[];
  qstar_grid: number[];
}

export interface MetricSeries {
  users: number[]; // millions of active users
  revenue: number[]; // €M / month (ARPU × users, after the deployment lag)
  cost: number[]; // €M / month (serving + re-acquisition + fixed)
  profit: number[]; // €M / month (revenue − cost)
}

export interface StrategyDerived extends MetricSeries {
  label: string;
  Q: number;
  cumProfit: number; // €M over horizon
  cumRevenue: number; // €M over horizon
  samples: MetricSeries[]; // noisy demand paths (illustrative bands)
}

export interface StrategyVector {
  innovation: number; // 0..100 — In-house build (Build vs Buy)
  resilience: number; // 0..100 — Vendor independence
  platformReach?: number; // 0..100 — Platform reach (scales market size K)
}

export const DEFAULT_VECTOR: StrategyVector = {
  innovation: 50,
  resilience: 50,
  platformReach: 50,
};

export interface ScenarioContext {
  tokenPriceFactor: number; // 1 = today's serving price; a shock is a high value
  regPressure: number; // 0..100 regulatory / compliance load (distinct channel)
}

export const DEFAULT_CONTEXT: ScenarioContext = {
  tokenPriceFactor: 1.0,
  regPressure: 30,
};

// ---- Metadata builder ---------------------------------------------------
function linspace(a: number, b: number, n: number): number[] {
  const out = new Array<number>(n);
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + step * i;
  return out;
}

const QSTAR_GRID: number[] = Array.from({ length: 46 }, (_, k) =>
  Math.round((0.1 + 0.02 * k) * 100) / 100,
);

const STRATEGIES: StrategySpec[] = [
  { label: "Lean", Q: 0.3 },
  { label: "Balanced", Q: 0.6 },
  { label: "Premium", Q: 0.9 },
];

// Single source of truth for the app's model metadata. No fetch, no runs.json.
export function buildModelData(): RunsData {
  return {
    meta: {
      params: {
        K_min: CALIB.K_min,
        K_max: CALIB.K_max,
        N0: CALIB.N0,
        tau: CALIB.tau,
        T: CALIB.T,
        dmMax: 12,
      },
      controls: {
        dm: { min: 0, max: 12, default: 6, step: 0.5, label: "Δm — ARPU premium (€/user/month per unit quality)" },
        qstar: { default: 0.5, label: "Q* — churn quality threshold" },
      },
      strategies: STRATEGIES,
    },
    t: linspace(0, CALIB.T, CALIB.steps).map((x) => Math.round(x * 1e4) / 1e4),
    qstar_grid: QSTAR_GRID,
  };
}

// ---- Helpers ------------------------------------------------------------
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Deterministic PRNG (mulberry32) so sample bands are stable across renders.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Standard normal via Box–Muller from a uniform generator.
function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Effective innovation delivered: the slider, dragged down by regulation
// (compliance eats innovation cycles). 0..1.
export function innovEffective(vec: StrategyVector, ctx: ScenarioContext): number {
  const innN = clamp01(vec.innovation / 100);
  const regN = clamp01(ctx.regPressure / 100);
  return clamp01(innN * (1 - CALIB.regInnovDrag * regN));
}

// Addressable market K from platform reach (the Platform-ecosystem lever).
export function reachToK(vec: StrategyVector): number {
  const reachN = clamp01((vec.platformReach ?? 50) / 100);
  return CALIB.K_min + (CALIB.K_max - CALIB.K_min) * reachN;
}

// Churn rate χ: logistic cliff around Q*, then reduced by in-house build.
export function chi(Q: number, qstar: number, innovEff = 0): number {
  const base = CALIB.chiMin + (CALIB.chiMax - CALIB.chiMin) / (1 + Math.exp(CALIB.kappa * (Q - qstar)));
  return base * (1 - CALIB.innovChurnCut * innovEff);
}

// Effective serving-cost multiplier the company faces. Token price is the level
// the vendor charges; resilience shields the part of a spike above today's ×1.
export function effectiveTpf(ctx: ScenarioContext, vec: StrategyVector): number {
  const raw = ctx.tokenPriceFactor;
  const excess = raw - 1;
  const shield = 1 - CALIB.resilShield * clamp01(vec.resilience / 100);
  return 1 + (excess > 0 ? excess * shield : excess);
}

// Fixed cost: baseline + the two investments + regulation's compliance load
// (which resilience and in-house build partly buy down).
function fixedCost(vec: StrategyVector, ctx: ScenarioContext): number {
  const innN = clamp01(vec.innovation / 100);
  const resN = clamp01(vec.resilience / 100);
  const regN = clamp01(ctx.regPressure / 100);
  const buffer = clamp01(CALIB.regComplianceBuffer * (0.6 * resN + 0.4 * innN));
  const compliance = CALIB.F_reg * regN * (1 - buffer);
  return CALIB.F0 + CALIB.F_innov * innN + CALIB.F_resil * resN + compliance;
}

// Per-user monthly ARPU (a LEVER, not an output): base + scaling premium Δm·Q,
// lifted by in-house build. This is where "margin per user" is set.
function arpuPerUser(Q: number, dm: number, innovEff: number): number {
  return (CALIB.arpu0 + dm * Q) * (1 + CALIB.innovArpuLift * innovEff);
}

// ---- The simulation -----------------------------------------------------
// Euler–Maruyama on dN = [p(K−N) + rN(1−N/K) − χN − φ(t/T)N] dt + σN √dt dW.
function simulate(Q: number, qstar: number, K: number, innovEff: number, noise?: number[]): number[] {
  const n = CALIB.steps;
  const T = CALIB.T;
  const dt = T / (n - 1);
  const sdt = Math.sqrt(dt);
  const ch = chi(Q, qstar, innovEff);
  const N = new Array<number>(n);
  N[0] = CALIB.N0;
  for (let i = 1; i < n; i++) {
    const ti = (i - 1) * dt;
    const prev = N[i - 1];
    const comp = (CALIB.phi * ti) / T;
    const drift = CALIB.p * (K - prev) + CALIB.r * prev * (1 - prev / K) - ch * prev - comp * prev;
    let next = prev + drift * dt;
    if (noise) next += CALIB.sigma * prev * sdt * noise[i - 1];
    N[i] = Math.max(next, 0);
  }
  return N;
}

function trapezoid(y: number[], x: number[]): number {
  let s = 0;
  for (let i = 1; i < y.length; i++) s += ((y[i] + y[i - 1]) / 2) * (x[i] - x[i - 1]);
  return s;
}

function toUnits(raw: { revenue: number[]; cost: number[]; profit: number[] }, N: number[]): MetricSeries {
  return {
    users: N.map((v) => v / MU),
    revenue: raw.revenue.map((v) => v / M),
    cost: raw.cost.map((v) => v / M),
    profit: raw.profit.map((v) => v / M),
  };
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

export function deriveStrategy(
  data: RunsData,
  s: number,
  dm: number,
  qstar: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): StrategyDerived {
  const t = data.t;
  const strat = data.meta.strategies[s];
  const Q = strat.Q;
  const K = reachToK(vec);
  const innovEff = innovEffective(vec, ctx);

  const N = simulate(Q, qstar, K, innovEff);
  const rawDet = deriveRawExact(N, Q, qstar, dm, t, ctx, vec);
  const det = toUnits(rawDet, N);
  const cumProfit = trapezoid(rawDet.profit, t) / M;
  const cumRevenue = trapezoid(rawDet.revenue, t) / M;

  const rng = mulberry32(1000 + s * 97 + Math.round(qstar * 100));
  const samples: MetricSeries[] = Array.from({ length: 8 }, () => {
    const noise = Array.from({ length: CALIB.steps }, () => gauss(rng));
    const Ns = simulate(Q, qstar, K, innovEff, noise);
    return toUnits(deriveRawExact(Ns, Q, qstar, dm, t, ctx, vec), Ns);
  });

  return { label: strat.label, Q, cumProfit, cumRevenue, samples, ...det };
}

// Exact P&L given an explicit Q* (churn matches the simulated trajectory).
function deriveRawExact(
  N: number[],
  Q: number,
  qstar: number,
  dm: number,
  t: number[],
  ctx: ScenarioContext,
  vec: StrategyVector,
) {
  const n = N.length;
  const revenue = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);
  const innovEff = innovEffective(vec, ctx);
  const arpu = arpuPerUser(Q, dm, innovEff);
  const serve = CALIB.serve0 * effectiveTpf(ctx, vec);
  const churn = chi(Q, qstar, innovEff);
  const F = fixedCost(vec, ctx);
  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const gate = ti >= CALIB.tau ? 1 : 0;
    const comp = (CALIB.phi * ti) / CALIB.T;
    const rev = gate * arpu * N[i];
    const c = serve * N[i] + CALIB.cac * (churn + comp) * N[i] + F;
    revenue[i] = rev;
    cost[i] = c;
    profit[i] = rev - c;
  }
  return { revenue, cost, profit };
}

// View B: cumulative profit (€M) for every Q* in the grid, per strategy.
export function sweepCumProfit(
  data: RunsData,
  dm: number,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  vec: StrategyVector = DEFAULT_VECTOR,
): number[][] {
  const t = data.t;
  const K = reachToK(vec);
  const innovEff = innovEffective(vec, ctx);
  return data.meta.strategies.map((strat) =>
    data.qstar_grid.map((qstar) => {
      const N = simulate(strat.Q, qstar, K, innovEff);
      const raw = deriveRawExact(N, strat.Q, qstar, dm, t, ctx, vec);
      return trapezoid(raw.profit, t) / M;
    }),
  );
}

// ---- Scaling dial: one aggressiveness value drives Δm and Q* together -----
export function scalingToKnobs(aggression: number, data: RunsData): { dm: number; qstar: number } {
  const a = Math.max(0, Math.min(100, aggression)) / 100;
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  const grid = data.qstar_grid;
  const qLo = grid[0];
  const qHi = grid[grid.length - 1];
  return { dm: dmMin + (dmMax - dmMin) * a, qstar: qLo + (qHi - qLo) * a };
}

// Inverse: recover the aggressiveness dial from BOTH dm and qstar (their mean),
// so the dial can never disagree with the Q* actually in effect.
export function knobsToScaling(dm: number, data: RunsData, qstar?: number): number {
  const dmMin = data.meta.controls.dm.min ?? 0;
  const dmMax = data.meta.controls.dm.max ?? 12;
  const aDm = dmMax === dmMin ? 0.5 : (dm - dmMin) / (dmMax - dmMin);
  const grid = data.qstar_grid;
  const qLo = grid[0];
  const qHi = grid[grid.length - 1];
  const aQ = qstar === undefined || qHi === qLo ? aDm : (qstar - qLo) / (qHi - qLo);
  return Math.max(0, Math.min(100, ((aDm + aQ) / 2) * 100));
}

// ---- Interactive causal state -------------------------------------------
export interface CausalState {
  Q: number;
  churn: number;
  churnNorm: number; // 0 good .. 1 bad
  margin: number; // ARPU €/user
  marginNorm: number; // 0 .. 1 (higher = richer margin)
  comp: number; // competition pressure 0 .. 1
  usersEnd: number; // final users (millions)
  usersNorm: number; // 0 .. 1
  cumProfit: number; // €M over horizon
  profitNorm: number; // 0 .. 1 magnitude
  shockNorm: number; // 0 .. 1 token-price pressure
  tpfEff: number; // effective serving-cost multiplier
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
  const Q = data.meta.strategies[s].Q;
  const innovEff = innovEffective(vec, ctx);

  const churn = chi(Q, qstar, innovEff);
  const churnNorm = clamp01((churn - CALIB.chiMin) / (CALIB.chiMax - CALIB.chiMin));

  const margin = arpuPerUser(Q, dm, innovEff);
  const marginFloor = CALIB.arpu0; // dm = 0
  const marginCeil = (CALIB.arpu0 + (data.meta.params.dmMax ?? 12) * Q) * (1 + CALIB.innovArpuLift);
  const marginNorm = clamp01((margin - marginFloor) / Math.max(marginCeil - marginFloor, 1e-6));

  const comp = clamp01(CALIB.phi / 0.5); // standing competition drag (grows over time)

  const d = deriveStrategy(data, s, dm, qstar, ctx, vec);
  const usersEnd = d.users[d.users.length - 1];
  const K = reachToK(vec) / MU;
  // Normalize the end-of-horizon base against a realistic retained fraction of
  // the market, so a healthy strategy reads calm and a bleeding one reads red.
  const usersNorm = clamp01(usersEnd / (0.25 * K));

  const cumProfit = d.cumProfit;
  const profitNorm = clamp01(Math.abs(cumProfit) / 1500);
  const tpfEff = effectiveTpf(ctx, vec);
  const shockNorm = clamp01((tpfEff - 1) / 2);

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

// ---- Scenario presets: ENVIRONMENT ONLY ---------------------------------
// A scenario changes the outside world. Your strategy sliders stay where you
// set them, so you can watch the SAME strategy face four different futures.
// The strategy response lives in the Mitigation step (the two-stage story:
// shock lands here → recommended response there).
export interface ScenarioPreset {
  id: string;
  label: string;
  blurb: string;
  ctx: ScenarioContext;
}

export const PRESETS: ScenarioPreset[] = [
  {
    id: "status-quo",
    label: "Status quo",
    blurb: "Today's serving price (×1.0) and moderate compliance load.",
    ctx: { tokenPriceFactor: 1.0, regPressure: 30 },
  },
  {
    id: "pricing-shock",
    label: "Pricing shock",
    blurb: "The vendor triples serving prices after market consolidation.",
    ctx: { tokenPriceFactor: 3.0, regPressure: 30 },
  },
  {
    id: "regulatory-stress",
    label: "Regulatory stress test",
    blurb: "Heavy audit and governance duty across the sector (token price unchanged).",
    ctx: { tokenPriceFactor: 1.0, regPressure: 85 },
  },
  {
    id: "oss-breakthrough",
    label: "Open-source breakthrough",
    blurb: "An open model matches the frontier; serving cost collapses to ×0.5.",
    ctx: { tokenPriceFactor: 0.5, regPressure: 30 },
  },
];

// ---- Risk radar: 5 axes, all RISK (higher = worse) ----------------------
// One spoke per Problem-page decision axis + one for the environment, each
// owned by identifiable sliders and monotonic in them.
export interface RiskScores {
  platform: number; // Platform-ecosystem risk (reach × token exposure)
  lockin: number; // Vendor lock-in risk (low resilience × quality/scale × price)
  capability: number; // Build-vs-buy capability gap (low in-house build + reg drag)
  scaling: number; // Scaling / cost-structure risk (aggressiveness × cost pressure)
  regulatory: number; // Regulatory / compliance risk (reg, buffered by resil + build)
}

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
  return { cumRevenue: sum(d.revenue), cumCost: sum(d.cost), cumProfit: d.cumProfit };
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
  const reachN = clamp01((vec.platformReach ?? 50) / 100);
  const resN = clamp01(vec.resilience / 100);
  const innN = clamp01(vec.innovation / 100);
  const regN = clamp01(ctx.regPressure / 100);
  const aggN = clamp01(knobsToScaling(dm, data, qstar) / 100);
  const tpfEff = effectiveTpf(ctx, vec);
  const tpN = clamp01((tpfEff - 1) / 3); // effective token-price exposure

  const tt = totals(data, s, dm, qstar, ctx, vec);
  const costR = clamp01(tt.cumCost / Math.max(tt.cumRevenue, 1e-9) / 1.2);

  const platform = clamp01(0.6 * reachN + 0.4 * tpN) * 100;
  const lockin = clamp01(0.5 * (1 - resN) + 0.3 * Q + 0.2 * tpN) * 100;
  const capability = clamp01(0.7 * (1 - innN) + 0.3 * regN) * 100;
  const scaling = clamp01(0.55 * aggN + 0.45 * costR) * 100;
  const regulatory = clamp01(regN * (1 - 0.35 * resN - 0.15 * innN)) * 100;

  return { platform, lockin, capability, scaling, regulatory };
}

// Axis metadata (labels + which sliders move each spoke) — used by the UI so
// the radar can explain itself.
export const RISK_AXES: { key: keyof RiskScores; label: string; driver: string }[] = [
  { key: "platform", label: "Platform exposure", driver: "Platform reach & token price" },
  { key: "lockin", label: "Vendor lock-in", driver: "Vendor independence (−)" },
  { key: "capability", label: "Capability gap", driver: "In-house build (−)" },
  { key: "scaling", label: "Scaling risk", driver: "Scaling aggressiveness & cost" },
  { key: "regulatory", label: "Regulatory load", driver: "Regulation, buffered by resilience/build" },
];

// ---- Tipping points -----------------------------------------------------
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
  const mk = (
    key: keyof RiskScores,
    label: string,
    threshold: number,
    explanation: string,
  ): TippingPoint => ({
    key,
    label,
    value: r[key],
    threshold,
    belowIsBad: false,
    crossed: r[key] >= threshold,
    explanation,
  });
  return [
    mk(
      "platform",
      "Platform exposure",
      70,
      "Past this line the user base is large and priced on a single vendor: a serving-price spike now hits enough users to swamp the margin, and a forced shutdown carries real reputational cost.",
    ),
    mk(
      "lockin",
      "Vendor lock-in",
      70,
      "Past this line switching cost exceeds the migration benefit — price negotiation loses its basis and pricing power sits with the vendor. Vendor independence is the only lever that pulls it back.",
    ),
    mk(
      "capability",
      "Capability gap",
      65,
      "Past this line too little is built in-house: the roadmap is set by the vendor and by compliance, and a competitor that builds can open a durable lead.",
    ),
    mk(
      "scaling",
      "Scaling / cost structure",
      70,
      "Past this line aggressiveness has pushed cost close to revenue: each new user at full scale adds little or negative contribution and the cost structure tips.",
    ),
    mk(
      "regulatory",
      "Regulatory load",
      70,
      "Past this line compliance overhead is heavy relative to what resilience and in-house capability can absorb, and innovation cycles stretch.",
    ),
  ];
}

// ---- Diagnostic mitigation ----------------------------------------------
// Find the DOMINANT risk, then recommend the lever(s) that actually reduce it
// (grounded in the equations above), re-simulate under the SAME environment,
// and rank by how much they cut the dominant risk — profit-guarded.
export interface MitigationCandidate {
  id: string;
  label: string;
  rationale: string;
  targetRisk: string; // which risk axis this addresses
  strat: number;
  dm: number;
  qstar: number;
  vec: StrategyVector;
  cumProfit: number;
  deltaVsBaseline: number;
  riskReduction: number; // points cut on the dominant axis
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
  const reach = base.vec.platformReach ?? 50;

  const baseline = deriveStrategy(data, base.strat, base.dm, base.qstar, ctx, base.vec);
  const baseProfit = baseline.cumProfit;
  const baseRisk = deriveRiskScores(data, base.strat, base.dm, base.qstar, ctx, base.vec);

  // Dominant risk axis.
  const order: (keyof RiskScores)[] = ["platform", "lockin", "capability", "scaling", "regulatory"];
  const dominant = order.reduce((a, b) => (baseRisk[b] > baseRisk[a] ? b : a), order[0]);
  const RISK_NAME: Record<keyof RiskScores, string> = {
    platform: "platform exposure",
    lockin: "vendor lock-in",
    capability: "capability gap",
    scaling: "scaling / cost-structure risk",
    regulatory: "regulatory load",
  };

  type Raw = Omit<MitigationCandidate, "cumProfit" | "deltaVsBaseline" | "riskReduction">;
  const V = (over: Partial<StrategyVector>): StrategyVector => ({
    innovation: base.vec.innovation,
    resilience: base.vec.resilience,
    platformReach: reach,
    ...over,
  });

  // Targeted responses per dominant risk (each grounded in the model).
  const targeted: Raw[] = [];
  if (dominant === "platform") {
    targeted.push({
      id: "hedge", label: "Hedge the platform", targetRisk: RISK_NAME.platform,
      rationale: "Raise vendor independence hard so the large user base is shielded from a serving-price spike, cutting the exposure that scale created.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 90 }),
    });
    targeted.push({
      id: "contain", label: "Contain the footprint", targetRisk: RISK_NAME.platform,
      rationale: "Pull platform reach back toward a contained deployment so fewer users are exposed to the vendor's pricing at once.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ platformReach: Math.max(20, reach - 30), resilience: Math.max(65, base.vec.resilience) }),
    });
  } else if (dominant === "lockin") {
    targeted.push({
      id: "independence", label: "Buy vendor independence", targetRisk: RISK_NAME.lockin,
      rationale: "Invest in multi-vendor / open-weight serving so switching stays cheap and pricing power does not shift to the vendor.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
    });
    targeted.push({
      id: "step-down", label: "Step down the quality tier", targetRisk: RISK_NAME.lockin,
      rationale: "Move to a lighter strategy so less of the product is welded to one frontier vendor, with a resilience lift on top.",
      strat: Math.max(0, base.strat - 1), dm: base.dm, qstar: clampQ(base.qstar - 0.08), vec: V({ resilience: 80 }),
    });
  } else if (dominant === "capability") {
    targeted.push({
      id: "build", label: "Build in-house", targetRisk: RISK_NAME.capability,
      rationale: "Raise in-house build to close the capability gap: it lowers churn in the trajectory and lifts ARPU, at a higher fixed cost.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ innovation: 88 }),
    });
    targeted.push({
      id: "build-premium", label: "Build + move upmarket", targetRisk: RISK_NAME.capability,
      rationale: "Combine an in-house build push with a higher-quality strategy so capability and product tier rise together.",
      strat: Math.min(nStrat - 1, base.strat + 1), dm: base.dm, qstar: base.qstar, vec: V({ innovation: 85 }),
    });
  } else if (dominant === "scaling") {
    targeted.push({
      id: "ease-off", label: "Ease off scaling", targetRisk: RISK_NAME.scaling,
      rationale: "Reduce scaling aggressiveness so the ARPU push and quality bar retreat from the cost-structure tipping point.",
      strat: base.strat, dm: clampDm(base.dm - 3.5), qstar: clampQ(base.qstar - 0.12), vec: V({}),
    });
    targeted.push({
      id: "ease-and-retain", label: "Ease off + retain", targetRisk: RISK_NAME.scaling,
      rationale: "Ease scaling and lift in-house build so lower churn shrinks the re-acquisition bill that the cost structure is straining under.",
      strat: base.strat, dm: clampDm(base.dm - 2.5), qstar: clampQ(base.qstar - 0.08), vec: V({ innovation: 80 }),
    });
  } else {
    targeted.push({
      id: "absorb", label: "Absorb the compliance load", targetRisk: RISK_NAME.regulatory,
      rationale: "Regulation is external, but resilience (approved-model flexibility) and in-house build (compliance capability) buy down the overhead you actually carry.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 85, innovation: 80 }),
    });
  }

  // When the serving price is elevated (a pricing shock), always offer a pure
  // vendor hedge — raising resilience shields the serving cost at its source,
  // which is the true fix even when the dominant axis reads as cost-structure.
  const serveMul = effectiveTpf(ctx, base.vec);
  const hedge: Raw[] =
    serveMul > 1.3 && !targeted.some((c) => (c.vec.resilience ?? 0) >= 88)
      ? [
          {
            id: "hedge-vendor", label: "Hedge the vendor", targetRisk: "serving-cost exposure",
            rationale: "Serving price is elevated, so raise vendor independence hard: multi-vendor and open-weight fallbacks absorb most of the spike and cut the cost at its source.",
            strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
          },
        ]
      : [];

  // Always include a balanced guardrail option.
  const guardrail: Raw = {
    id: "balance", label: "Balanced reset", targetRisk: "overall",
    rationale: "Re-centre the vector: healthy in-house build and resilience with moderate scaling — a robust default when no single risk dominates.",
    strat: Math.min(nStrat - 1, 1), dm: clampDm(6), qstar: clampQ(0.5),
    vec: V({ innovation: 70, resilience: 72 }),
  };

  const raw = [...targeted, ...hedge, guardrail];

  return raw
    .map((c) => {
      const d = deriveStrategy(data, c.strat, c.dm, c.qstar, ctx, c.vec);
      const r = deriveRiskScores(data, c.strat, c.dm, c.qstar, ctx, c.vec);
      return {
        ...c,
        cumProfit: d.cumProfit,
        deltaVsBaseline: d.cumProfit - baseProfit,
        riskReduction: baseRisk[dominant] - r[dominant],
      };
    })
    // Drop candidates that wreck profit outright.
    .filter((c) => c.deltaVsBaseline > -Math.max(200, Math.abs(baseProfit)))
    // Rank profit-guarded: options that don't make profit worse than the
    // baseline come first (never headline a money-loser), then by how much
    // each cuts the dominant risk, then by absolute profit.
    .sort((a, b) => {
      const aw = a.deltaVsBaseline >= 0 ? 1 : 0;
      const bw = b.deltaVsBaseline >= 0 ? 1 : 0;
      if (aw !== bw) return bw - aw;
      return b.riskReduction - a.riskReduction || b.cumProfit - a.cumProfit;
    });
}
