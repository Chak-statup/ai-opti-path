// AI-strategy scenario model; a real, live dynamical simulation.
//
// The user base N(t) is SIMULATED in the browser (Euler–Maruyama on a logistic
// growth + churn + competition SDE) every time a lever moves, so the growth
// curve genuinely reacts to the strategy; nothing is a frozen precomputed
// trajectory. On top of the simulated N(t) we net a transparent P&L in euros.
//
// Two families of inputs:
//   • Strategy vector (INTERNAL; the company controls these), each a 0..100
//     slider with a documented, comparable effect (see CALIB):
//       – Platform reach       → scales the addressable market K (dynamics)
//       – In-house build       → raises delivered quality (→ lower churn) + lifts ARPU
//       – Vendor independence  → shields token-price spikes + lowers lock-in (€)
//       – Scaling aggressiveness → couples the ARPU premium Δm and quality bar Q*
//     plus the discrete strategy choice Q (product quality tier). A higher tier
//     runs richer (frontier) models, so it costs MORE per user to serve; the
//     tier choice is a genuine trade-off, not a free lunch.
//   • Environment (EXTERNAL; not controlled):
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
  // Market & growth (DYNAMICAL; these enter the simulated user ODE)
  // Scale: DEMO scale, set by user direction 2026-07-02 (cumulative profit in
  // single-digit €M so the exhibit does not read as an exaggerated forecast).
  // Per-UNIT economics (ARPU, serving, CAC) are real and unscaled; only the
  // aggregates (market size, fixed cost) are ÷100 of a flagship deployment.
  K_min: 20_000, // [assume] addressable market at platform reach 0 (contained pilot)
  K_max: 150_000, // [assume] addressable market at platform reach 100 (mass-market)
  N0: 400, // [assume] active users at t = 0 (fit to pilot telemetry)
  p: 0.008, // [src] Bass innovation coeff (PyMC-Marketing; canonical 0.01–0.03)
  r: 0.35, // [src] Bass imitation coeff (PyMC-Marketing; canonical 0.3–0.5)
  chiMin: 0.02, // [src] churn floor/mo (Optifai B2B SaaS; enterprise 1–2%/mo)
  chiMax: 0.3, // [bound] churn ceiling/mo (worst case; empirical ~0.10–0.15)
  kappa: 12, // [assume] churn-cliff steepness (fit to a quality→churn gradient)
  phi: 0.35, // [bound] peak competition/mo (ramps 0→phi; central ~0.07–0.12)
  sigma: 0.16, // [src] demand volatility CV (frePPLe SBC; <0.70 = smooth)

  // In-house build (innovation); DYNAMICAL + economic
  innovQualityLift: 0.15, // [assume] full build raises DELIVERED quality +0.15 (~half a tier); churn responds through the same logistic cliff (needs A/B cohort data)
  innovArpuLift: 0.2, // [assume] ... and lifts ARPU 20% (needs monetization experiment)

  // Vendor independence (resilience); economic (shock buffer)
  maxHedge: 0.7, // [src/bound] RouteLLM 70–87% routable at ~95% quality (realized ~19%)

  // Economics (euros / active user / month unless noted)
  arpu0: 9, // [src] base ARPU €/user/mo (Slack Pro €6.75–8.25/seat)
  serve0: 2.5, // [src+assume] API price grounded × assumed ~0.5–1M tokens/user/mo; at the BALANCED tier
  qualityServeSlope: 2.0, // [src-anchored] serving factor 1+slope·(Q−0.6): Lean ×0.4, Balanced ×1.0, Premium ×1.6; a higher tier runs pricier frontier models (cross-tier API spreads are 3–5×)
  cac: 20, // [src] blended €/user charged on every GROSS ADD the growth equation generates (First Page Sage; per-seat; benchmarks per-account ~35× higher)

  // Fixed cost (euros / month); demo scale (÷100 of a flagship deployment,
  // same ratios; the grounded flagship magnitudes live in docs/references.md)
  F0: 40_000, // [src-ratio] baseline org/infra
  F_innov: 50_000, // [src-ratio] full in-house build
  F_resil: 15_000, // [src-ratio] full resilience / portability team
  F_reg: 30_000, // [src-ratio] compliance load at full regulation

  // Regulation (external); distinct from token price
  regInnovDrag: 0.4, // [bound] full-load innovation drag (MIT Sloan; expected ~0.25–0.33)
  regComplianceBuffer: 0.3, // [assume] in-house build absorbs up to 30% of compliance (one coefficient, kept deliberately simple)

  // Tier fairness: the quality bar a tier is held to scales with its ambition.
  // A Lean product (Q 0.3) promises and is judged against a LOWER bar than a
  // Premium one (Q 0.9): bar(tier) = Q* · Q / qRef. Without this, one shared
  // bar executes the Lean tier at Premium's standard in every scenario.
  qRef: 0.6, // [design] reference tier (Balanced) whose bar equals the dial's Q*

  // Display normalization (colors/intensities ONLY; never enters the dynamics)
  chiDisplay: 0.12, // [src] empirical churn ceiling (~0.10–0.15/mo); the model keeps the 0.30 worst-case bound for the cliff itself
  profitDisplay: 10, // [assume] |cumProfit| €M at which the profit node reads fully saturated

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

// Metadata bundle passed around the app. N(t) is NOT stored here; it is
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
  cost: number[]; // €M / month (serving + acquisition of gross adds + fixed)
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
  innovation: number; // 0..100; In-house build (Build vs Buy)
  resilience: number; // 0..100; Vendor independence
  platformReach?: number; // 0..100; Platform reach (scales market size K)
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
  // tokenPriceFactor after it; a real, visible pricing shock at a point in time.
  shockMonth?: number;
  // Quality the users actually get, shifted DOWN by scenarios that trade quality
  // for cost (e.g. adopting open-source models). 0 = no shift; 0.2 = a real hit.
  qualityShift?: number;
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
        dm: { min: 0, max: 12, default: 6, step: 0.5, label: "dm: ARPU premium (€/user/month per unit quality)" },
        qstar: { default: 0.5, label: "Q*: churn quality threshold" },
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

// Churn rate χ: a pure logistic cliff around Q*. Everything that changes churn
// does so through ONE channel; the quality users actually experience.
export function chi(Q: number, qstar: number): number {
  return CALIB.chiMin + (CALIB.chiMax - CALIB.chiMin) / (1 + Math.exp(CALIB.kappa * (Q - qstar)));
}

// The bar a given tier is actually held to: the scaling dial's Q*, scaled by
// the tier's ambition (Lean promises less than Premium, and its users judge it
// against that promise). At the reference tier (Balanced) bar === Q*.
export function tierBar(qstar: number, Q: number): number {
  return clamp01(qstar * (Q / CALIB.qRef));
}

// Quality that actually reaches users under a scenario. Some scenarios trade
// quality for cost; adopting open-source models is cheaper to serve but lower
// quality; which shifts effective quality down, lifting churn and cutting users.
export function scenarioQuality(Q: number, ctx: ScenarioContext): number {
  return clamp01(Q - (ctx.qualityShift ?? 0));
}

// The quality users EXPERIENCE: the tier, shifted down by scenario trades
// (open-source adoption) and lifted by in-house build (regulation-dragged).
// This is the single quality that drives churn; so in-house build genuinely
// mitigates a scenario quality drop by climbing back over the bar Q*.
export function effectiveQuality(Q: number, ctx: ScenarioContext, vec: StrategyVector): number {
  return clamp01(scenarioQuality(Q, ctx) + CALIB.innovQualityLift * innovEffective(vec, ctx));
}

// Serving-cost factor of the quality tier: a premium product runs richer
// (frontier) models and burns more tokens, a lean one runs cheaper models.
// Anchored ×1 at the Balanced tier (Q = 0.6).
export function qualityServeFactor(Q: number): number {
  return Math.max(0.2, 1 + CALIB.qualityServeSlope * (Q - 0.6));
}

// Vendor independence as a portfolio: hedgeShare(R) = maxHedge · R/100 is the
// fraction of serving you can run on cheaper / alternative models.
export function hedgeShare(vec: StrategyVector): number {
  return CALIB.maxHedge * clamp01(vec.resilience / 100);
}

// Serving-cost multiplier at a given raw vendor price; a BLENDED price:
// only the un-hedged share (1 − h) pays the vendor's price; the hedged share h
// runs on alternatives at today's ×1. (If the price falls, take the full
// benefit; no reason to hedge a cheaper price.) So at h = 0.7 a vendor that
// triples its price (×3) only lifts your blended cost to 0.3·3 + 0.7 = ×1.6.
export function shieldedTpf(rawTpf: number, vec: StrategyVector): number {
  if (rawTpf <= 1) return rawTpf;
  const h = hedgeShare(vec);
  return (1 - h) * rawTpf + h * 1;
}

// Effective serving-cost multiplier at the prevailing (post-shock) price level;
// the exposure the company is carrying. Used by the risk radar and causal state.
export function effectiveTpf(ctx: ScenarioContext, vec: StrategyVector): number {
  return shieldedTpf(ctx.tokenPriceFactor, vec);
}

// Per-user serving cost (€/user/mo) at the prevailing (post-shock) price level:
// tier picks the models, aggressive scaling burns more tokens, the hedge blends
// the vendor's price. This is the value the causal diagram's s node shows.
export function servePerUser(tierQ: number, ctx: ScenarioContext, vec: StrategyVector): number {
  return CALIB.serve0 * qualityServeFactor(tierQ) * shieldedTpf(ctx.tokenPriceFactor, vec);
}

// Fixed cost: baseline + the two investments + regulation's compliance load
// (which resilience and in-house build partly buy down). Exported decomposed
// so the causal diagram can show WHERE the fixed spend sits, line by line.
export interface FixedCostParts {
  base: number; // € / month
  build: number;
  indep: number;
  compliance: number;
  total: number;
}

export function fixedCostParts(vec: StrategyVector, ctx: ScenarioContext): FixedCostParts {
  const innN = clamp01(vec.innovation / 100);
  const resN = clamp01(vec.resilience / 100);
  const regN = clamp01(ctx.regPressure / 100);
  const buffer = clamp01(CALIB.regComplianceBuffer * innN);
  const base = CALIB.F0;
  const build = CALIB.F_innov * innN;
  const indep = CALIB.F_resil * resN;
  const compliance = CALIB.F_reg * regN * (1 - buffer);
  return { base, build, indep, compliance, total: base + build + indep + compliance };
}

function fixedCost(vec: StrategyVector, ctx: ScenarioContext): number {
  return fixedCostParts(vec, ctx).total;
}

// Per-user monthly ARPU (a LEVER, not an output): base + scaling premium Δm·Q,
// lifted by in-house build. This is where "margin per user" is set.
function arpuPerUser(Q: number, dm: number, innovEff: number): number {
  return (CALIB.arpu0 + dm * Q) * (1 + CALIB.innovArpuLift * innovEff);
}

// ---- The simulation -----------------------------------------------------
// Euler–Maruyama on dN = [p(K−N) + rN(1−N/K) − χN − φ(t/T)N] dt + σN √dt dW.
// Q here is the EFFECTIVE quality (tier + scenario shift + in-house build).
function simulate(Qeff: number, qstar: number, K: number, noise?: number[]): number[] {
  const n = CALIB.steps;
  const T = CALIB.T;
  const dt = T / (n - 1);
  const sdt = Math.sqrt(dt);
  const ch = chi(Qeff, qstar);
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
  const Qs = scenarioQuality(Q, ctx); // quality users get before the build lift (prices the ARPU)
  const Qeff = effectiveQuality(Q, ctx, vec); // quality users experience (drives churn)
  const K = reachToK(vec);
  const bar = tierBar(qstar, Q); // the bar THIS tier is held to

  const N = simulate(Qeff, bar, K);
  const rawDet = deriveRawExact(N, Q, Qs, dm, t, ctx, vec, K);
  const det = toUnits(rawDet, N);
  const cumProfit = trapezoid(rawDet.profit, t) / M;
  const cumRevenue = trapezoid(rawDet.revenue, t) / M;

  const rng = mulberry32(1000 + s * 97 + Math.round(qstar * 100));
  const samples: MetricSeries[] = Array.from({ length: 8 }, () => {
    const noise = Array.from({ length: CALIB.steps }, () => gauss(rng));
    const Ns = simulate(Qeff, bar, K, noise);
    return toUnits(deriveRawExact(Ns, Q, Qs, dm, t, ctx, vec, K), Ns);
  });

  return { label: strat.label, Q, cumProfit, cumRevenue, samples, ...det };
}

// Exact P&L on a simulated trajectory. tierQ prices the serving cost (which
// models the tier runs); Qs prices the ARPU (what the delivered product can
// charge). Acquisition is charged on the GROSS ADDS the growth equation
// actually generates; p(K−N) paid + rN(1−N/K) word-of-mouth; at the blended
// CAC, so growing the base costs money and churned users are only "replaced"
// insofar as the dynamics actually replace them.
function deriveRawExact(
  N: number[],
  tierQ: number,
  Qs: number,
  dm: number,
  t: number[],
  ctx: ScenarioContext,
  vec: StrategyVector,
  K: number,
) {
  const n = N.length;
  const revenue = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);
  const innovEff = innovEffective(vec, ctx);
  const arpu = arpuPerUser(Qs, dm, innovEff);
  // Serving cost is the token COGS per user: the tier sets which models you
  // run (qualityServeFactor); aggressive scaling (a richer product) burns more
  // tokens per user on top.
  const serveScale = qualityServeFactor(tierQ);
  // If the scenario carries a shock, price is today's ×1 until shockMonth, then
  // steps to the prevailing level.
  const servePost = CALIB.serve0 * serveScale * shieldedTpf(ctx.tokenPriceFactor, vec);
  const servePre = CALIB.serve0 * serveScale * shieldedTpf(1, vec);
  const F = fixedCost(vec, ctx);
  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const gate = ti >= CALIB.tau ? 1 : 0;
    const serve = ctx.shockMonth !== undefined && ti < ctx.shockMonth ? servePre : servePost;
    const adds = Math.max(0, CALIB.p * (K - N[i]) + CALIB.r * N[i] * (1 - N[i] / K));
    const rev = gate * arpu * N[i];
    const c = serve * N[i] + CALIB.cac * adds + F;
    revenue[i] = rev;
    cost[i] = c;
    profit[i] = rev - c;
  }
  return { revenue, cost, profit };
}

// ---- Switched response: the honest two-stage story ------------------------
// A mitigation is a decision taken WHEN the risk is realised, not at t = 0.
// This simulates the baseline posture up to switchMonth, then switches the
// strategy (tier, scaling, vector) and lets the SAME user trajectory continue
// from N(switchMonth) under the new parameters. The P&L switches with it
// (ARPU, serving mix, fixed cost, CAC on the adds the new dynamics generate);
// the environment; including the price step at shockMonth; stays identical.
// With cand ≡ base this reproduces deriveStrategy's deterministic path exactly.
export interface SwitchedDerived extends MetricSeries {
  cumProfit: number; // €M over horizon
  switchMonth: number;
}

interface SegmentParams {
  Qeff: number;
  qstar: number;
  K: number;
  arpu: number;
  serveScale: number; // serve0 × tier factor × scaling bump (pre price factor)
  vec: StrategyVector;
  F: number;
}

function segmentParams(data: RunsData, b: MitigationBaseline, ctx: ScenarioContext): SegmentParams {
  const Q = data.meta.strategies[b.strat].Q;
  const Qs = scenarioQuality(Q, ctx);
  return {
    Qeff: effectiveQuality(Q, ctx, b.vec),
    qstar: tierBar(b.qstar, Q),
    K: reachToK(b.vec),
    arpu: arpuPerUser(Qs, b.dm, innovEffective(b.vec, ctx)),
    serveScale: CALIB.serve0 * qualityServeFactor(Q),
    vec: b.vec,
    F: fixedCost(b.vec, ctx),
  };
}

export function deriveSwitched(
  data: RunsData,
  base: MitigationBaseline,
  cand: MitigationBaseline,
  ctx: ScenarioContext = DEFAULT_CONTEXT,
  switchMonthOpt?: number,
): SwitchedDerived {
  const switchMonth = switchMonthOpt ?? ctx.shockMonth ?? 0;
  const A = segmentParams(data, base, ctx);
  const B = segmentParams(data, cand, ctx);
  const t = data.t;
  const n = CALIB.steps;
  const dt = CALIB.T / (n - 1);

  // User dynamics, piecewise (deterministic; mitigation compares expectations).
  const N = new Array<number>(n);
  N[0] = CALIB.N0;
  for (let i = 1; i < n; i++) {
    const ti = (i - 1) * dt;
    const seg = ti >= switchMonth ? B : A;
    const ch = chi(seg.Qeff, seg.qstar);
    const prev = N[i - 1];
    const comp = (CALIB.phi * ti) / CALIB.T;
    const drift =
      CALIB.p * (seg.K - prev) + CALIB.r * prev * (1 - prev / seg.K) - ch * prev - comp * prev;
    N[i] = Math.max(prev + drift * dt, 0);
  }

  // P&L, piecewise, with the price step at shockMonth independent of the switch.
  const revenue = new Array<number>(n);
  const cost = new Array<number>(n);
  const profit = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const ti = t[i];
    const seg = ti >= switchMonth ? B : A;
    const gate = ti >= CALIB.tau ? 1 : 0;
    const price = ctx.shockMonth !== undefined && ti < ctx.shockMonth ? 1 : ctx.tokenPriceFactor;
    const serve = seg.serveScale * shieldedTpf(price, seg.vec);
    const adds = Math.max(0, CALIB.p * (seg.K - N[i]) + CALIB.r * N[i] * (1 - N[i] / seg.K));
    const rev = gate * seg.arpu * N[i];
    const c = serve * N[i] + CALIB.cac * adds + seg.F;
    revenue[i] = rev;
    cost[i] = c;
    profit[i] = rev - c;
  }
  const cumProfit = trapezoid(profit, t) / M;
  return { ...toUnits({ revenue, cost, profit }, N), cumProfit, switchMonth };
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
  return data.meta.strategies.map((strat) => {
    const Qs = scenarioQuality(strat.Q, ctx);
    const Qeff = effectiveQuality(strat.Q, ctx, vec);
    return data.qstar_grid.map((qstar) => {
      const N = simulate(Qeff, tierBar(qstar, strat.Q), K);
      const raw = deriveRawExact(N, strat.Q, Qs, dm, t, ctx, vec, K);
      return trapezoid(raw.profit, t) / M;
    });
  });
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
  churnNorm: number; // 0 good .. 1 bad (normalized over the REALISTIC churn band)
  margin: number; // ARPU €/user
  marginNorm: number; // 0 .. 1 (higher = richer margin)
  comp: number; // competition pressure 0 .. 1
  usersEnd: number; // final users (millions)
  usersNorm: number; // 0 .. 1 (against a FIXED market scale, so reach moves it)
  cumProfit: number; // €M over horizon
  profitNorm: number; // 0 .. 1 magnitude
  shockNorm: number; // 0 .. 1 token-price pressure
  tpfEff: number; // effective serving-cost multiplier (blended)
  tpfRaw: number; // the vendor's raw price factor
  profitPos: boolean;
  // Channels the diagram renders explicitly:
  KM: number; // addressable market (millions); set by platform reach
  reachN: number; // 0 .. 1
  regN: number; // 0 .. 1 regulatory load
  hedge: number; // 0 .. 1 share of serving on alternatives (vendor independence)
  serve: number; // €/user/mo serving cost at the prevailing (post-shock) price
  fixed: FixedCostParts; // €/month decomposition (base | build | indep | compliance)
  bar: number; // the quality bar THIS tier is held to (tier-scaled Q*)
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
  const Qs = scenarioQuality(Q, ctx); // scenario quality (prices the ARPU)
  const Qeff = effectiveQuality(Q, ctx, vec); // quality users experience (drives churn)
  const innovEff = innovEffective(vec, ctx);
  const bar = tierBar(qstar, Q);

  const churn = chi(Qeff, bar);
  // Display norm over the REALISTIC churn band (chiMin .. chiDisplay), not the
  // worst-case model bound chiMax; so realistic slider moves actually change
  // the color, instead of living in the bottom fifth of the scale.
  const churnNorm = clamp01((churn - CALIB.chiMin) / (CALIB.chiDisplay - CALIB.chiMin));

  const margin = arpuPerUser(Qs, dm, innovEff);
  const marginFloor = CALIB.arpu0; // dm = 0
  const marginCeil = (CALIB.arpu0 + (data.meta.params.dmMax ?? 12) * Q) * (1 + CALIB.innovArpuLift);
  const marginNorm = clamp01((margin - marginFloor) / Math.max(marginCeil - marginFloor, 1e-6));

  // Competition is exogenous (a linear 0→φ ramp over the horizon, moved by no
  // lever): show its horizon-average rate φ/2 against the churn scale.
  const comp = clamp01(CALIB.phi / 2 / CALIB.chiMax);

  const d = deriveStrategy(data, s, dm, qstar, ctx, vec);
  const usersEnd = d.users[d.users.length - 1];
  const KM = reachToK(vec) / MU;
  // Normalize the end-of-horizon base against a FIXED scale, NOT against the
  // reach-dependent K; dividing by K made the node exactly invariant to the
  // reach slider. 15% of the maximum market retained at horizon ≈ saturated:
  // the default posture reads mid-scale, full reach strong, a contained pilot weak.
  const usersNorm = clamp01(usersEnd / (0.15 * (CALIB.K_max / MU)));

  const cumProfit = d.cumProfit;
  // Magnitude norm at demo scale: |cumProfit| ≈ €10M reads fully saturated.
  const profitNorm = clamp01(Math.abs(cumProfit) / CALIB.profitDisplay);
  const tpfEff = effectiveTpf(ctx, vec);
  const shockNorm = clamp01((tpfEff - 1) / 2);

  return {
    Q: Qeff,
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
    tpfRaw: ctx.tokenPriceFactor,
    profitPos: cumProfit >= 0,
    KM,
    reachN: clamp01((vec.platformReach ?? 50) / 100),
    regN: clamp01(ctx.regPressure / 100),
    hedge: hedgeShare(vec),
    serve: servePerUser(Q, ctx, vec),
    fixed: fixedCostParts(vec, ctx),
    bar,
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
    label: "Regulatory pressure",
    blurb: "Heavy audit and governance duty across the sector (token price unchanged).",
    ctx: { tokenPriceFactor: 1.0, regPressure: 85 },
  },
  {
    id: "oss-breakthrough",
    label: "Open-source adoption",
    blurb: "You move to open-source models: serving cost collapses to ×0.5, but quality drops and retention takes a hit.",
    ctx: { tokenPriceFactor: 0.5, regPressure: 30, qualityShift: 0.2 },
  },
];

// ---- Risk radar: 5 axes, all RISK (higher = worse) ----------------------
// One spoke per Problem-page decision axis + one for the environment, each
// owned by identifiable sliders and monotonic in them.
export interface RiskScores {
  cost: number; // Cost exposure; (shielded) token price × how many users you serve
  lockin: number; // Vendor lock-in; low independence × product depth
  capability: number; // Capability gap; low in-house build, amplified by regulation
  scaling: number; // Scaling risk; aggressiveness + committing above your quality
  regulatory: number; // Regulatory load; regulation, buffered by resilience + build
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
  // Cliff: how far the bar THIS TIER is held to sits above the quality users
  // actually experience (scenario-shifted down, lifted by in-house build; so
  // building genuinely reduces the cliff a quality-losing scenario opens).
  const cliff = clamp01((tierBar(qstar, Q) - effectiveQuality(Q, ctx, vec)) / 0.4);

  // Cost exposure: ~0 at today's price; climbs with the (shielded) serving price
  // and with how many users you serve; so a pricing shock at scale drives it to
  // the rim. Resilience (via stress) and in-house build pull it back.
  const cost = clamp01(0.15 * reachN + 0.5 * stress + 0.9 * stress * reachN + 0.15 * stress * (1 - innN)) * 100;
  // Vendor lock-in: deep dependence on one vendor, bought down by independence.
  const lockin = clamp01((1 - resN) * (0.6 + 0.4 * Q) + 0.15 * stress) * 100;
  // Capability gap: how little you build in-house, amplified by regulation.
  const capability = clamp01((1 - innN) * (0.8 + 0.4 * regN)) * 100;
  // Scaling risk: aggressiveness plus committing to a bar above your quality.
  const scaling = clamp01(0.55 * aggN + 0.85 * cliff + 0.2 * aggN * stress) * 100;
  // Regulatory load: compliance burden net of what in-house build absorbs.
  const regulatory = clamp01(regN * (1.1 - 0.4 * innN)) * 100;

  return { cost, lockin, capability, scaling, regulatory };
}

// Axis metadata (labels + which sliders move each spoke); used by the UI so
// the radar can explain itself.
export const RISK_AXES: { key: keyof RiskScores; label: string; driver: string; rises: string }[] = [
  { key: "cost", label: "Cost exposure", driver: "Token price ↑ · Platform reach ↑ · Vendor independence ↓", rises: "the serving price climbs while you serve many users" },
  { key: "lockin", label: "Vendor lock-in", driver: "Vendor independence ↓ · Quality ↑", rises: "you sit deep on one vendor with no cheap way to switch" },
  { key: "capability", label: "Capability gap", driver: "In-house build ↓ · Regulation ↑", rises: "you build little in-house and lean on the vendor's roadmap" },
  { key: "scaling", label: "Scaling risk", driver: "Scaling intensity ↑ · delivered quality ↓ (in-house build restores it)", rises: "your price implies more quality than users actually experience" },
  { key: "regulatory", label: "Regulatory load", driver: "Regulation ↑ · In-house build ↓", rises: "compliance duty outpaces what your in-house capability absorbs" },
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
      "Past this line switching cost exceeds the migration benefit; price negotiation loses its basis and pricing power sits with the vendor. Vendor independence is the only lever that pulls it back.",
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
      "Past this line the expectations implied by your price sit above what the product delivers: churn accelerates off the cliff and the aggressive margin push turns loss-making.",
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
// and rank by how much they cut the dominant risk; profit-guarded.
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
      id: "hedge", label: "Shift serving off-vendor now", targetRisk: RISK_NAME.cost,
      rationale: "Push vendor independence to the ceiling: most traffic moves to alternative models at today's price, so the spike only touches the sliver that still runs on the expensive vendor.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
    });
    targeted.push({
      id: "contain", label: "Serve fewer users while prices are high", targetRisk: RISK_NAME.cost,
      rationale: "Pull platform reach back: a smaller base is cheaper to serve at spiked prices, and you re-expand when the price normalises.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ platformReach: Math.max(20, reach - 30), resilience: Math.max(70, base.vec.resilience) }),
    });
  } else if (dominant === "lockin") {
    // NOTE: mitigations move the four LEVERS only; the tier is the strategy
    // under test, and "switch strategy" is not a mitigation of it.
    targeted.push({
      id: "independence", label: "Make yourself switchable", targetRisk: RISK_NAME.lockin,
      rationale: "Invest in multi-vendor / open-weight serving so switching stays cheap and pricing power does not shift to the vendor.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
    });
    targeted.push({
      id: "independence-lean", label: "Switchable + smaller promise", targetRisk: RISK_NAME.lockin,
      rationale: "Raise vendor independence and ease the scaling push, so less of the product's economics is welded to one vendor's price while switching stays cheap.",
      strat: base.strat, dm: clampDm(base.dm - 2.5), qstar: clampQ(base.qstar - 0.08), vec: V({ resilience: 85 }),
    });
  } else if (dominant === "capability") {
    targeted.push({
      id: "build", label: "Invest in your own capability", targetRisk: RISK_NAME.capability,
      rationale: "Raise in-house build to close the capability gap: it raises the quality users experience (churn falls through the same cliff) and lifts ARPU, at a higher fixed cost.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ innovation: 88 }),
    });
    targeted.push({
      id: "build-monetise", label: "Build it, then charge for it", targetRisk: RISK_NAME.capability,
      rationale: "Push in-house build and lean modestly into the ARPU premium the better product can carry; capability closes the gap, pricing captures it.",
      strat: base.strat, dm: clampDm(base.dm + 1.5), qstar: base.qstar, vec: V({ innovation: 85 }),
    });
  } else if (dominant === "scaling") {
    targeted.push({
      id: "ease-off", label: "Promise less, keep your users", targetRisk: RISK_NAME.scaling,
      rationale: "Reduce scaling intensity so the ARPU push and quality bar retreat from the cost-structure tipping point.",
      strat: base.strat, dm: clampDm(base.dm - 3.5), qstar: clampQ(base.qstar - 0.12), vec: V({}),
    });
    targeted.push({
      id: "ease-and-retain", label: "Promise less, deliver more", targetRisk: RISK_NAME.scaling,
      rationale: "Ease scaling and lift in-house build: the quality bar retreats while delivered quality rises, so churn falls on both counts.",
      strat: base.strat, dm: clampDm(base.dm - 2.5), qstar: clampQ(base.qstar - 0.08), vec: V({ innovation: 80 }),
    });
    if ((ctx.qualityShift ?? 0) > 0) {
      targeted.push({
        id: "rebuild-quality", label: "Rebuild the lost quality yourself", targetRisk: RISK_NAME.scaling,
        rationale: "The scenario cut the quality users experience below the bar you committed to. A hard in-house build push raises delivered quality back over the bar; retention recovers at the cost of higher fixed spend.",
        strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ innovation: 90 }),
      });
    }
  } else {
    targeted.push({
      id: "absorb", label: "Build your own compliance muscle", targetRisk: RISK_NAME.regulatory,
      rationale: "Regulation is external, but in-house capability absorbs up to 30% of the compliance overhead and recovers the innovation that regulation drags down.",
      strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ innovation: 85 }),
    });
  }

  // When the serving price is elevated (a pricing shock), always offer a pure
  // vendor hedge; raising resilience shields the serving cost at its source,
  // which is the true fix even when the dominant axis reads as cost-structure.
  const serveMul = effectiveTpf(ctx, base.vec);
  const hedge: Raw[] =
    serveMul > 1.3 && !targeted.some((c) => (c.vec.resilience ?? 0) >= 88)
      ? [
          {
            id: "hedge-vendor", label: "Shift serving off-vendor now", targetRisk: "serving-cost exposure",
            rationale: "Serving price is elevated, so raise vendor independence hard: multi-vendor and open-weight fallbacks absorb most of the spike and cut the cost at its source.",
            strat: base.strat, dm: base.dm, qstar: base.qstar, vec: V({ resilience: 92 }),
          },
        ]
      : [];

  // Always include a balanced guardrail option (same tier; levers re-centred).
  const guardrail: Raw = {
    id: "balance", label: "Re-centre all levers", targetRisk: "overall",
    rationale: "Return to a healthy middle: solid in-house build and vendor independence with moderate scaling; the robust default when no single risk dominates.",
    strat: base.strat, dm: clampDm(6), qstar: clampQ(0.5),
    vec: V({ innovation: 70, resilience: 72 }),
  };

  const raw = [...targeted, ...hedge, guardrail];

  // Score each candidate as a RESPONSE: the baseline posture runs until the
  // shock is realised (switchMonth = shockMonth, or t=0 for standing
  // scenarios), then the candidate takes over. This stops a candidate from
  // retroactively paying; or exploiting; months of posture that predate the
  // shock it responds to.
  const scored = raw.map((c) => {
    const d = deriveSwitched(data, base, { strat: c.strat, dm: c.dm, qstar: c.qstar, vec: c.vec }, ctx);
    const r = deriveRiskScores(data, c.strat, c.dm, c.qstar, ctx, c.vec);
    return {
      ...c,
      cumProfit: d.cumProfit,
      deltaVsBaseline: d.cumProfit - baseProfit,
      riskReduction: baseRisk[dominant] - r[dominant],
    };
  });

  // Credible options only: each must materially cut the dominant risk AND not
  // make profit meaningfully worse than the baseline; so we never headline a
  // money-losing "mitigation". If none qualify, fall back to the single
  // best-profit risk-reducer so there is always something honest to show.
  const floor = -Math.max(0.05, 0.02 * Math.abs(baseProfit));
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
    // comparable amount (same ~20-point band) prefer the more profitable one;
    // so the headline is both a real risk fix and the best business outcome.
    .sort((a, b) => {
      const ba = Math.round(a.riskReduction / 20);
      const bb = Math.round(b.riskReduction / 20);
      if (ba !== bb) return bb - ba;
      return b.cumProfit - a.cumProfit;
    })
    .slice(0, 4);
}
