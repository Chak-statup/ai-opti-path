import type {
  Scenario,
  ShockType,
  Strategy,
  StrategyParams,
} from "./types";

export const SHOCK_TYPES: ShockType[] = [
  "priceSpike",
  "vendorTerms",
  "regulation",
  "security",
  "quality",
];

export const SHOCK_META: Record<
  ShockType,
  { label: string; short: string; description: string; prior: number }
> = {
  priceSpike: {
    label: "Token price spike",
    short: "Price",
    description:
      "Frontier providers start charging closer to true token cost. API bills jump.",
    prior: 0.45,
  },
  vendorTerms: {
    label: "Vendor terms change",
    short: "Lock-in",
    description:
      "A provider changes pricing, access, or safety policy — deepening dependency.",
    prior: 0.4,
  },
  regulation: {
    label: "Regulatory tightening",
    short: "Reg.",
    description:
      "Markets diverge on AI rules; compliance and audit overhead rises.",
    prior: 0.55,
  },
  security: {
    label: "Security / data leak",
    short: "Security",
    description:
      "A data-leakage or breach incident exposes the AI surface area.",
    prior: 0.3,
  },
  quality: {
    label: "Quality failure",
    short: "Quality",
    description:
      "A visible model-quality failure damages the brand at scale.",
    prior: 0.35,
  },
};

export const STRATEGY_META: Record<
  Strategy,
  { label: string; token: string; tagline: string; description: string }
> = {
  platform: {
    label: "Platform / API-first",
    token: "platform",
    tagline: "Speed & quality, with dependency",
    description:
      "Build fast on OpenAI, Anthropic, Microsoft, Google. Market momentum now, lock-in and price exposure later.",
  },
  opensource: {
    label: "Open-source / local",
    token: "opensource",
    tagline: "Control & sovereignty, slower",
    description:
      "Self-hosted and open models. Maximum control and cost stability, but heavier engineering and quality gaps.",
  },
  hybrid: {
    label: "Hybrid strategy",
    token: "hybrid",
    tagline: "Optionality & resilience",
    description:
      "Route each workload to the right model. Preserves optionality and absorbs shocks — needs strong governance.",
  },
};

export const STRATEGY_PARAMS: Record<Strategy, StrategyParams> = {
  platform: {
    launchRate: 1.4,
    baseQuality: 0.9,
    costPerCall: 1.0,
    lockInRate: 0.085,
    control: 0.2,
    govOverhead: 0.1,
    shockSensitivity: {
      priceSpike: 1.0,
      vendorTerms: 1.0,
      regulation: 0.7,
      security: 0.6,
      quality: 0.55,
    },
  },
  opensource: {
    launchRate: 0.7,
    baseQuality: 0.66,
    costPerCall: 0.42,
    lockInRate: 0.012,
    control: 0.95,
    govOverhead: 0.5,
    shockSensitivity: {
      priceSpike: 0.15,
      vendorTerms: 0.12,
      regulation: 0.4,
      security: 0.7,
      quality: 0.8,
    },
  },
  hybrid: {
    launchRate: 1.05,
    baseQuality: 0.82,
    costPerCall: 0.68,
    lockInRate: 0.04,
    control: 0.7,
    govOverhead: 0.65,
    shockSensitivity: {
      priceSpike: 0.5,
      vendorTerms: 0.4,
      regulation: 0.5,
      security: 0.55,
      quality: 0.55,
    },
  },
};

export const STRATEGIES: Strategy[] = ["platform", "opensource", "hybrid"];

export function defaultScenario(): Scenario {
  return {
    horizonMonths: 18,
    startApps: 12,
    ambition: 1.0,
    userGrowth: 0.18,
    shocks: {
      priceSpike: { enabled: true, month: 9, magnitude: 0.7 },
      vendorTerms: { enabled: false, month: 11, magnitude: 0.6 },
      regulation: { enabled: false, month: 7, magnitude: 0.5 },
      security: { enabled: false, month: 13, magnitude: 0.6 },
      quality: { enabled: false, month: 6, magnitude: 0.5 },
    },
  };
}

/** Deterministic seeded PRNG (mulberry32) — same numbers across TS & Python ports. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform generator. */
export function gaussian(u: () => number): number {
  let x = 0;
  let y = 0;
  while (x === 0) x = u();
  while (y === 0) y = u();
  return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
