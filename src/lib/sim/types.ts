// Shared types for both simulation engines.
// Framework-agnostic so they can be ported 1:1 to a Python/FastAPI backend later.

export type Strategy = "platform" | "opensource" | "hybrid";

export type ShockType =
  | "priceSpike"
  | "vendorTerms"
  | "regulation"
  | "security"
  | "quality";

export interface ShockConfig {
  enabled: boolean;
  /** Month (1-indexed) the shock hits. */
  month: number;
  /** Severity 0..1. */
  magnitude: number;
}

export interface Scenario {
  /** Planning horizon, 12..18 months. */
  horizonMonths: number;
  /** Apps live at month 0. */
  startApps: number;
  /** Monthly app launch ambition multiplier, 0.5..1.5. */
  ambition: number;
  /** Monthly user growth rate, e.g. 0.18 = +18%/mo at start. */
  userGrowth: number;
  shocks: Record<ShockType, ShockConfig>;
}

export interface StrategyParams {
  launchRate: number;
  baseQuality: number;
  costPerCall: number;
  lockInRate: number;
  control: number;
  govOverhead: number;
  shockSensitivity: Record<ShockType, number>;
}

/** Monte-Carlo band: 10th / 50th / 90th percentile. */
export interface Band {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface CausalSummary {
  strategy: Strategy;
  finalCost: number;
  lockIn: number;
  reputation: number;
  resilience: number;
}

export interface CausalResult {
  strategy: Strategy;
  cost: Band[];
  lockIn: Band[];
  reputation: Band[];
  summary: CausalSummary;
}
