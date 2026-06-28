import { rng, gaussian, clamp } from "./scenario";

/**
 * Total-Cost-to-Company (TCC) simulator for AI strategy evaluation.
 *
 * One scenario, many strategies. A company runs `nApps` AI apps for `users`
 * users. Each app draws a per-user cost and a quality level from a
 * distribution. Low quality trips a churn step-function. An external token
 * price shock can drive cost up mid-horizon. Each app only starts paying back
 * after a latency `tau`. We Monte-Carlo the distributions and report the net
 * value (revenue − cost) the company accrues over the horizon.
 *
 * Pure functions + a seeded PRNG, so this ports 1:1 to a Python/FastAPI backend.
 */

export interface SimConfig {
  id: string;
  label: string;
  blurb: string;
  /** Visual token: platform | hybrid | opensource | quality | cost */
  tone: string;

  nApps: number;
  users: number;
  horizonMonths: number;

  /** Per-user, per-app monthly cost ($). Lognormal mean. */
  costMean: number;
  /** Lognormal spread of per-app cost. */
  costSigma: number;

  /** Output quality of the chosen models, mean in 0..1 (frontier high, OSS lower). */
  qualityMean: number;
  /** Spread of quality across apps. */
  qualitySpread: number;
  /** Apps below this quality trip the churn step-function. */
  qualityThreshold: number;
  /** Fraction of users lost when an app is below the quality threshold. */
  churnRate: number;

  /** Revenue per active user per app per month, once ramped ($). */
  revenuePerUser: number;
  /** Latency (months) before an app starts generating revenue. */
  tau: number;

  /** Month the token-price shock lands (0 = none). */
  shockMonth: number;
  /** Cost multiplier the shock applies (e.g. 2.2 = +120%). */
  shockMultiplier: number;
  /** 0..1 share of cost exposed to the shock (frontier high, OSS low). */
  shockExposure: number;
}

export interface MonthBand {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimSummary {
  id: string;
  label: string;
  tone: string;
  netP50: number;
  netP10: number;
  netP90: number;
  totalCost: number;
  totalRevenue: number;
  breakevenMonth: number | null;
  avgQuality: number;
  churnShare: number;
}

export interface SimResult {
  config: SimConfig;
  cumulativeNet: MonthBand[];
  summary: SimSummary;
}

/** Draw from a lognormal with the given arithmetic mean and sigma. */
function lognormal(u: () => number, mean: number, sigma: number): number {
  const mu = Math.log(Math.max(mean, 1e-6)) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * gaussian(u));
}

interface AppDraw {
  cost: number;
  quality: number;
  churn: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.floor((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

const MONTE_CARLO = 240;

export function simulate(config: SimConfig, seed = 20240601): SimResult {
  const u = rng(seed + config.label.length * 7919);
  const H = config.horizonMonths;

  // cumulative net for each run, indexed [run][month]
  const runs: number[][] = [];
  let qualitySum = 0;
  let churnAppShare = 0;
  let costSum = 0;
  let revSum = 0;

  for (let r = 0; r < MONTE_CARLO; r++) {
    // Draw an app portfolio for this run.
    const apps: AppDraw[] = [];
    for (let i = 0; i < config.nApps; i++) {
      const cost = lognormal(u, config.costMean, config.costSigma);
      const quality = clamp(config.qualityMean + gaussian(u) * config.qualitySpread, 0.05, 0.99);
      const belowBar = quality < config.qualityThreshold;
      // churn is itself uncertain: ~churnRate, jittered
      const churn = belowBar
        ? clamp(config.churnRate * (0.6 + u() * 0.9), 0, 0.6)
        : 0;
      apps.push({ cost, quality, churn });
      qualitySum += quality;
      churnAppShare += belowBar ? 1 : 0;
    }

    const cum: number[] = [];
    let running = 0;
    for (let t = 1; t <= H; t++) {
      const priceFactor =
        config.shockMonth > 0 && t >= config.shockMonth
          ? 1 + (config.shockMultiplier - 1) * config.shockExposure
          : 1;

      let monthCost = 0;
      let monthRev = 0;
      for (const a of apps) {
        const activeUsers = config.users * (1 - a.churn);
        monthCost += config.users * a.cost * priceFactor;
        if (t > config.tau) {
          const ramp = Math.min(1, (t - config.tau) / 3);
          // Revenue scales with quality — poor output is worth less.
          monthRev += activeUsers * config.revenuePerUser * a.quality * ramp;
        }
      }
      running += monthRev - monthCost;
      cum.push(running);
      costSum += monthCost;
      revSum += monthRev;
    }
    runs.push(cum);
  }

  // Aggregate bands per month.
  const cumulativeNet: MonthBand[] = [];
  for (let t = 0; t < H; t++) {
    const col = runs.map((run) => run[t]).sort((a, b) => a - b);
    cumulativeNet.push({
      month: t + 1,
      p10: percentile(col, 10),
      p50: percentile(col, 50),
      p90: percentile(col, 90),
    });
  }

  const finalCol = runs.map((run) => run[H - 1]).sort((a, b) => a - b);
  const netP50 = percentile(finalCol, 50);

  // Breakeven: first month where median cumulative net >= 0.
  let breakevenMonth: number | null = null;
  for (const b of cumulativeNet) {
    if (b.p50 >= 0) {
      breakevenMonth = b.month;
      break;
    }
  }

  const summary: SimSummary = {
    id: config.id,
    label: config.label,
    tone: config.tone,
    netP50,
    netP10: percentile(finalCol, 10),
    netP90: percentile(finalCol, 90),
    totalCost: costSum / MONTE_CARLO,
    totalRevenue: revSum / MONTE_CARLO,
    breakevenMonth,
    avgQuality: qualitySum / (MONTE_CARLO * config.nApps),
    churnShare: churnAppShare / (MONTE_CARLO * config.nApps),
  };

  return { config, cumulativeNet, summary };
}

/**
 * Five strategy presets: 2 extremes + 3 middle-ground blends.
 * All share the same scenario (token-price shock at month 9) so they're
 * directly comparable. Pricing is anchored to real-world ranges:
 *   - Frontier API calls ≈ $0.70–0.90 / user / app / month
 *   - Open-source / self-hosted ≈ $0.15–0.25 (GPU amortised, no per-token markup)
 *   - Hybrid routes the mix ≈ $0.40–0.55
 */
export const PRESETS: SimConfig[] = [
  {
    id: "frontier",
    label: "All-in Frontier",
    blurb:
      "Maximum apps on top API models. Best quality and fastest payback — but fully exposed to a token-price shock.",
    tone: "platform",
    nApps: 14,
    users: 5000,
    horizonMonths: 18,
    costMean: 0.82,
    costSigma: 0.35,
    qualityMean: 0.9,
    qualitySpread: 0.05,
    qualityThreshold: 0.7,
    churnRate: 0.1,
    revenuePerUser: 1.35,
    tau: 2,
    shockMonth: 9,
    shockMultiplier: 2.2,
    shockExposure: 0.95,
  },
  {
    id: "lean-frontier",
    label: "Lean Frontier",
    blurb:
      "Frontier quality but fewer, higher-value apps and a partial price hedge to soften the shock.",
    tone: "platform",
    nApps: 9,
    users: 5000,
    horizonMonths: 18,
    costMean: 0.78,
    costSigma: 0.3,
    qualityMean: 0.88,
    qualitySpread: 0.06,
    qualityThreshold: 0.7,
    churnRate: 0.1,
    revenuePerUser: 1.45,
    tau: 2,
    shockMonth: 9,
    shockMultiplier: 2.2,
    shockExposure: 0.65,
  },
  {
    id: "hybrid",
    label: "Balanced Hybrid",
    blurb:
      "Route each workload to the right model. Moderate cost, good quality, and meaningful shock insulation.",
    tone: "hybrid",
    nApps: 11,
    users: 5000,
    horizonMonths: 18,
    costMean: 0.46,
    costSigma: 0.4,
    qualityMean: 0.8,
    qualitySpread: 0.09,
    qualityThreshold: 0.7,
    churnRate: 0.1,
    revenuePerUser: 1.3,
    tau: 3,
    shockMonth: 9,
    shockMultiplier: 2.2,
    shockExposure: 0.4,
  },
  {
    id: "oss-lean",
    label: "Hybrid-Lean OSS",
    blurb:
      "Mostly open-source with a few frontier calls for hard reasoning. Cheap and resilient, but quality dips raise churn.",
    tone: "opensource",
    nApps: 10,
    users: 5000,
    horizonMonths: 18,
    costMean: 0.3,
    costSigma: 0.45,
    qualityMean: 0.72,
    qualitySpread: 0.12,
    qualityThreshold: 0.7,
    churnRate: 0.12,
    revenuePerUser: 1.25,
    tau: 4,
    shockMonth: 9,
    shockMultiplier: 2.2,
    shockExposure: 0.2,
  },
  {
    id: "sovereign",
    label: "Open-source Sovereign",
    blurb:
      "Fully self-hosted, maximum cost stability and control. Slowest payback and the biggest quality / churn drag.",
    tone: "opensource",
    nApps: 8,
    users: 5000,
    horizonMonths: 18,
    costMean: 0.19,
    costSigma: 0.5,
    qualityMean: 0.63,
    qualitySpread: 0.13,
    qualityThreshold: 0.7,
    churnRate: 0.14,
    revenuePerUser: 1.2,
    tau: 5,
    shockMonth: 9,
    shockMultiplier: 2.2,
    shockExposure: 0.08,
  },
];

/** Plain-language documentation of every model variable, for the UI. */
export interface VariableDoc {
  symbol: string;
  name: string;
  effect: string;
  distribution: string;
}

export const VARIABLE_DOCS: VariableDoc[] = [
  {
    symbol: "c_i",
    name: "Per-user app cost",
    effect:
      "Monthly inference cost of app i per user. Frontier APIs cost more; self-hosted is cheaper. Total cost scales with users × apps.",
    distribution: "Lognormal(mean = costMean, σ = costSigma) — skewed: most apps cheap, a few expensive.",
  },
  {
    symbol: "P(t)",
    name: "Token-price shock",
    effect:
      "An external shock at month 9 multiplies cost. How much you feel it depends on shockExposure — frontier ≈ fully exposed, OSS barely.",
    distribution: "Step function: cost ×(1 + (shockMultiplier − 1) × shockExposure) for t ≥ shockMonth.",
  },
  {
    symbol: "q_i",
    name: "Output quality",
    effect:
      "Quality of app i's model output. Drives revenue (poor output is worth less). Open-source trails frontier on structured / reasoning tasks.",
    distribution: "Normal(mean = qualityMean, σ = qualitySpread), clamped to (0.05, 0.99).",
  },
  {
    symbol: "χ_i",
    name: "Churn step-function",
    effect:
      "If q_i falls below the quality threshold, a churn factor activates and a share of users leave that app — cutting active users and revenue.",
    distribution: "If q_i < qualityThreshold: churnRate × Uniform(0.6, 1.5); else 0.",
  },
  {
    symbol: "τ",
    name: "Revenue latency",
    effect:
      "Months an app takes to start paying back (build + adoption). After τ, revenue ramps in over ~3 months. Longer τ delays breakeven.",
    distribution: "Fixed per strategy (frontier fast, OSS slow); ramp = min(1, (t − τ)/3).",
  },
  {
    symbol: "r",
    name: "Revenue per user",
    effect:
      "Value an active user generates per app per month once ramped. Effective revenue = active users × r × quality.",
    distribution: "Fixed per strategy; modulated by q_i each month.",
  },
];

export function fmtMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
