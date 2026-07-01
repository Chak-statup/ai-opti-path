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
// today's baseline, 100 = maximum investment).
//
// SOURCES: every value is cited in docs/references.md (citation-audited 2026-07-01).
// Provenance tags below: [src] grounded in a real source · [assume] internal
// modelling assumption · [bound] deliberate worst-case ceiling, not a median.
export const CALIB = {
  // Market & growth (DYNAMICAL — these enter the simulated user ODE)
  K_min: 200_000, // [assume] addressable market at platform reach 0 (contained pilot)
  K_max: 1_500_000, // [assume] addressable market at platform reach 100 (mass-market)
  N0: 4_000, // [assume] active users at t = 0 (fit to pilot telemetry)
  p: 0.008, // [src] Bass innovation coeff (PyMC-Marketing; canonical 0.01–0.03)
  r: 0.35, // [src] Bass imitation coeff (PyMC-Marketing; canonical 0.3–0.5)
  chiMin: 0.02, // [src] churn floor/mo (Optifai B2B SaaS; enterprise 1–2%/mo)
  chiMax: 0.3, // [bound] churn ceiling/mo (worst case; empirical ~0.10–0.15)
  kappa: 12, // [assume] churn-cliff steepness (fit to a quality→churn gradient)
  phi: 0.35, // [bound] peak competition/mo (ramps 0→phi; central ~0.07–0.12)
  sigma: 0.16, // [src] demand volatility CV (frePPLe SBC; <0.70 = smooth)

  // In-house build (innovation) — DYNAMICAL + economic
  innovChurnCut: 0.3, // [assume] full build cuts churn 30% (needs A/B cohort data)
  innovArpuLift: 0.2, // [assume] ... and lifts ARPU 20% (needs monetization experiment)

  // Vendor independence (resilience) — economic (shock buffer)
  maxHedge: 0.7, // [src/bound] RouteLLM 70–87% routable at ~95% quality (realized ~19%)

  // Economics (euros / active user / month unless noted)
  arpu0: 9, // [src] base ARPU €/user/mo (Slack Pro €6.75–8.25/seat)
  serve0: 2.5, // [src+assume] API price grounded × assumed ~0.5–1M tokens/user/mo
  cac: 20, // [src] €/user (First Page Sage; per-seat — benchmarks per-account ~35× higher)

  // Fixed cost (euros / month)
  F0: 400_000, // [src] baseline org/infra (~15–25 EU ML FTE + infra; ×10 = €4M/mo)
  F_innov: 500_000, // [src] full in-house build (~40 FTE @ €130–160k loaded)
  F_resil: 150_000, // [src] full resilience (~11 FTE portability team)
  F_reg: 300_000, // [src] compliance (Fourthline; ×10 = €36M/yr is the grounded figure)

  // Regulation (external) — distinct from token price
  regInnovDrag: 0.4, // [bound] full-load innovation drag (MIT Sloan; expected ~0.25–0.33)
  regComplianceBuffer: 0.3, // [assume] resilience+build buy down 30% of compliance

  // Timing
  tau: 6, // [assume] deployment → revenue lag (months; fit to sales cycle)
  T: 54, // [design] horizon (months)
  steps: 361, // [design] integration steps
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
  tokenPriceFactor: number; // the prevailing serving-price level (1 = today)
  regPressure: number; // 0..100 regulatory / compliance load (distinct channel)
  // If set, the serving price is ×1 (today) before this month and steps up to
  // tokenPriceFactor after it — a real, visible pricing shock at a point in time.
  shockMonth?: number;
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

// Vendor independence as a portfolio: hedgeShare(R) = maxHedge · R/100 is the
// fraction of serving you can run on cheaper / alternative models.
export function hedgeShare(vec: StrategyVector): number {
  return CALIB.maxHedge * clamp01(vec.resilience / 100);
}

// Serving-cost multiplier at a given raw vendor price — a BLENDED price:
// only the un-hedged share (1 − h) pays the vendor's price; the hedged share h
// runs on alternatives at today's ×1. (If the price falls, take the full
// benefit — no reason to hedge a cheaper price.) So at h = 0.7 a vendor that
// triples its price (×3) only lifts your blended cost to 0.3·3 + 0.7 = ×1.6.
export function shieldedTpf(rawTpf: number, vec: StrategyVector): number {
  if (rawTpf <= 1) return rawTpf;
  const h = hedgeShare(vec);
  return (1 - h) * rawTpf + h * 1;
}

// Effective serving-cost multiplier at the prevailing (post-shock) price level —
// the exposure the company is carrying. Used by the risk radar and causal state.
export function effectiveTpf(ctx: ScenarioContext, vec: StrategyVector): number {
  return shieldedTpf(ctx.tokenPriceFactor, vec);
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
  // Serving cost is the token COGS per user. If the scenario carries a shock,
  // it is today's price (×1) until shockMonth, then steps to the prevailing level.
  const servePost = CALIB.serve0 * shieldedTpf(ctx.tokenPriceFactor, vec);
  const servePre = CALIB.serve0 * shieldedTpf(1, vec);
  const churn = chi(Q, qstar, innovEff);
  const F = fixedCost(vec, ctx);
  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const gate = ti >= CALIB.tau ? 1 : 0;
    const comp = (CALIB.phi * ti) / CALIB.T;
    const serve = ctx.shockMonth !== undefined && ti < ctx.shockMonth ? servePre : servePost;
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
    blurb: "At month 16 the vendor triples serving prices after market consolidation.",
    ctx: { tokenPriceFactor: 3.0, regPressure: 30, shockMonth: 16 },
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
  cost: number; // Cost exposure — (shielded) token price × how many users you serve
  lockin: number; // Vendor lock-in — low independence × product depth
  capability: number; // Capability gap — low in-house build, amplified by regulation
  scaling: number; // Scaling risk — aggressiveness + committing above your quality
  regulatory: number; // Regulatory load — regulation, buffered by resilience + build
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
  // Shielded price stress: 0 at today's price, 1 at a heavy spike after resilience.
  const stress = clamp01((effectiveTpf(ctx, vec) - 1) / 2);
  // Cliff: how far the committed quality bar Q* sits above your actual quality Q.
  const cliff = clamp01((qstar - Q) / 0.4);

  // Cost exposure: ~0 at today's price; climbs with the (shielded) serving price
  // and with how many users you serve — so a pricing shock at scale drives it to
  // the rim. Resilience (via stress) and in-house build pull it back.
  const cost = clamp01(0.15 * reachN + 0.5 * stress + 0.9 * stress * reachN + 0.15 * stress * (1 - innN)) * 100;
  // Vendor lock-in: deep dependence on one vendor, bought down by independence.
  const lockin = clamp01((1 - resN) * (0.6 + 0.4 * Q) + 0.15 * stress) * 100;
  // Capability gap: how little you build in-house, amplified by regulation.
  const capability = clamp01((1 - innN) * (0.8 + 0.4 * regN)) * 100;
  // Scaling risk: aggressiveness plus committing to a bar above your quality.
  const scaling = clamp01(0.55 * aggN + 0.85 * cliff + 0.2 * aggN * stress) * 100;
  // Regulatory load: compliance burden net of what resilience/build can absorb.
  const regulatory = clamp01(regN * (1.1 - 0.35 * resN - 0.15 * innN)) * 100;

  return { cost, lockin, capability, scaling, regulatory };
}

// Axis metadata (labels + which sliders move each spoke) — used by the UI so
// the radar can explain itself.
export const RISK_AXES: { key: keyof RiskScores; label: string; driver: string; rises: string }[] = [
  { key: "cost", label: "Cost exposure", driver: "Token price ↑ · Platform reach ↑ · Vendor independence ↓", rises: "the serving price climbs while you serve many users" },
  { key: "lockin", label: "Vendor lock-in", driver: "Vendor independence ↓ · Quality ↑", rises: "you sit deep on one vendor with no cheap way to switch" },
  { key: "capability", label: "Capability gap", driver: "In-house build ↓ · Regulation ↑", rises: "you build little in-house and lean on the vendor's roadmap" },
  { key: "scaling", label: "Scaling risk", driver: "Scaling aggressiveness ↑ (a bar above your quality)", rises: "you push margin and a quality bar the product can't yet meet" },
  { key: "regulatory", label: "Regulatory load", driver: "Regulation ↑ · Vendor independence & build ↓", rises: "compliance duty outpaces what your capability absorbs" },
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
      "cost",
      "Cost exposure",
      70,
      "Past this line the serving price is eating margin across a large user base: every user is expensive to serve and a forced shutdown carries real cost. Vendor independence is the lever that pulls it back.",
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
      "Scaling risk",
      70,
      "Past this line you have committed to a quality bar above what the product delivers: churn accelerates off the cliff and the aggressive margin push turns loss-making.",
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
  const order: (keyof RiskScores)[] = ["cost", "lockin", "capability", "scaling", "regulatory"];
  const dominant = order.reduce((a, b) => (baseRisk[b] > baseRisk[a] ? b : a), order[0]);
  const RISK_NAME: Record<keyof RiskScores, string> = {
    cost: "cost exposure",
    lockin: "vendor lock-in",
    capability: "capability gap",
    scaling: "scaling risk",
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
  if (dominant === "cost") {
    targeted.push({
      id: "hedge", label: "Hedge the vendor", targetRisk: RISK_NAME.cost,
      rationale: "Raise vendor independence hard so multi-vendor and open-weight fallbacks absorb the serving-price spike, cutting the cost at its source across the whole user base.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
    });
    targeted.push({
      id: "contain", label: "Contain the footprint", targetRisk: RISK_NAME.cost,
      rationale: "Pull platform reach back so fewer users are exposed to the vendor's pricing at once — a smaller, cheaper base to serve while the price is high.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ platformReach: Math.max(20, reach - 30), resilience: Math.max(70, base.vec.resilience) }),
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

  const scored = raw.map((c) => {
    const d = deriveStrategy(data, c.strat, c.dm, c.qstar, ctx, c.vec);
    const r = deriveRiskScores(data, c.strat, c.dm, c.qstar, ctx, c.vec);
    return {
      ...c,
      cumProfit: d.cumProfit,
      deltaVsBaseline: d.cumProfit - baseProfit,
      riskReduction: baseRisk[dominant] - r[dominant],
    };
  });

  // Credible options only: each must materially cut the dominant risk AND not
  // make profit meaningfully worse than the baseline — so we never headline a
  // money-losing "mitigation". If none qualify, fall back to the single
  // best-profit risk-reducer so there is always something honest to show.
  const floor = -Math.max(3, 0.02 * Math.abs(baseProfit));
  let pool = scored.filter((c) => c.riskReduction > 1 && c.deltaVsBaseline >= floor);
  if (pool.length === 0) {
    pool = scored
      .filter((c) => c.riskReduction > 1)
      .sort((a, b) => b.cumProfit - a.cumProfit)
      .slice(0, 1);
  }

  // De-duplicate identical strategy vectors, then rank by how much each cuts the
  // dominant risk (all shown options are already profit-credible).
  const seen = new Set<string>();
  return pool
    .filter((c) => {
      const k = `${c.strat}|${c.dm.toFixed(1)}|${c.qstar.toFixed(2)}|${c.vec.innovation}|${c.vec.resilience}|${c.vec.platformReach ?? 50}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    // Rank by dominant-risk reduction, but when two options cut the risk by a
    // comparable amount (same ~20-point band) prefer the more profitable one —
    // so the headline is both a real risk fix and the best business outcome.
    .sort((a, b) => {
      const ba = Math.round(a.riskReduction / 20);
      const bb = Math.round(b.riskReduction / 20);
      if (ba !== bb) return bb - ba;
      return b.cumProfit - a.cumProfit;
    })
    .slice(0, 4);
}
