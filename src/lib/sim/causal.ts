import type {
  Band,
  CausalResult,
  Scenario,
  ShockType,
  Strategy,
} from "./types";
import {
  STRATEGY_PARAMS,
  SHOCK_TYPES,
  clamp,
  gaussian,
  rng,
} from "./scenario";

/**
 * Causal system-dynamics + Bayesian uncertainty model.
 *
 * Stocks (monthly): apps, users, monthly AI spend, vendor lock-in index,
 * reputational capital. Flows are driven by launch ambition, token price,
 * model quality and governance overhead.
 *
 * Bayesian layer: each enabled shock has an uncertain magnitude drawn from a
 * distribution centred on its configured severity. We propagate that
 * uncertainty with a Monte-Carlo ensemble and report 10/50/90 credible bands.
 */

const RUNS = 240;

interface RunSeries {
  cost: number[];
  lockIn: number[];
  reputation: number[];
}

function shockActive(
  scenario: Scenario,
  type: ShockType,
  month: number,
): boolean {
  const s = scenario.shocks[type];
  return s.enabled && month >= s.month;
}

function singleRun(
  scenario: Scenario,
  strategy: Strategy,
  u: () => number,
): RunSeries {
  const p = STRATEGY_PARAMS[strategy];
  const months = scenario.horizonMonths;

  let apps = scenario.startApps;
  let users = scenario.startApps * 1800; // rough users-per-app seed
  let lockIn = p.lockInRate * 4; // some baseline commitment
  let reputation = 1.0;
  let tokenPrice = 1.0;

  // Draw uncertain magnitudes for enabled shocks once per run (Bayesian sample).
  const drawnMag: Record<string, number> = {};
  for (const type of SHOCK_TYPES) {
    const cfg = scenario.shocks[type];
    drawnMag[type] = clamp(
      cfg.magnitude + gaussian(u) * 0.15,
      0.05,
      1.0,
    );
  }

  const cost: number[] = [];
  const lockInArr: number[] = [];
  const repArr: number[] = [];

  for (let m = 1; m <= months; m++) {
    // App + user growth (saturating), with run-level noise.
    const growthNoise = 1 + gaussian(u) * 0.05;
    apps *= 1 + p.launchRate * scenario.ambition * 0.07 * growthNoise;
    const saturation = 1 / (1 + users / 6_000_000);
    users *= 1 + scenario.userGrowth * saturation * growthNoise;

    // Token-price escalation from the price-spike shock.
    if (shockActive(scenario, "priceSpike", m)) {
      const hit =
        drawnMag.priceSpike * p.shockSensitivity.priceSpike * 0.12;
      tokenPrice += hit;
    }
    // Vendor terms change ratchets both price and lock-in.
    if (shockActive(scenario, "vendorTerms", m)) {
      tokenPrice += drawnMag.vendorTerms * p.shockSensitivity.vendorTerms * 0.05;
      lockIn += drawnMag.vendorTerms * p.shockSensitivity.vendorTerms * 0.03;
    }

    // Monthly AI spend ($M): users * usage * effective cost-per-call.
    const callsPerUser = 0.9 + apps * 0.004;
    const monthlyCost =
      (users / 1_000_000) *
      callsPerUser *
      p.costPerCall *
      tokenPrice *
      (1 + p.govOverhead * 0.12);
    cost.push(monthlyCost);

    // Lock-in accumulates with apps built on the stack; control dampens it.
    lockIn = clamp(
      lockIn + p.lockInRate * (1 + apps / 400) * (1 - p.control * 0.3),
      0,
      1,
    );
    lockInArr.push(lockIn);

    // Reputation erodes from shocks and from cost-driven product degradation.
    let repDelta = 0.004; // slow recovery / brand building
    if (shockActive(scenario, "security", m)) {
      repDelta -= drawnMag.security * p.shockSensitivity.security * 0.05;
    }
    if (shockActive(scenario, "quality", m)) {
      repDelta -= drawnMag.quality * p.shockSensitivity.quality * 0.04;
    }
    if (shockActive(scenario, "regulation", m)) {
      repDelta -= drawnMag.regulation * p.shockSensitivity.regulation * 0.02;
    }
    if (tokenPrice > 1.8) {
      repDelta -= (tokenPrice - 1.8) * 0.02; // forced degradation / price pass-through
    }
    reputation = clamp(reputation + repDelta + gaussian(u) * 0.004, 0, 1);
    repArr.push(reputation);
  }

  return { cost, lockIn: lockInArr, reputation: repArr };
}

function percentile(sorted: number[], q: number): number {
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function toBands(runs: number[][], months: number): Band[] {
  const bands: Band[] = [];
  for (let m = 0; m < months; m++) {
    const col = runs.map((r) => r[m]).sort((a, b) => a - b);
    bands.push({
      month: m + 1,
      p10: percentile(col, 0.1),
      p50: percentile(col, 0.5),
      p90: percentile(col, 0.9),
    });
  }
  return bands;
}

export function simulateCausal(
  scenario: Scenario,
  strategy: Strategy,
  seed = 12345,
): CausalResult {
  const u = rng(seed + strategy.length * 7919);
  const months = scenario.horizonMonths;

  const costRuns: number[][] = [];
  const lockRuns: number[][] = [];
  const repRuns: number[][] = [];

  for (let i = 0; i < RUNS; i++) {
    const r = singleRun(scenario, strategy, u);
    costRuns.push(r.cost);
    lockRuns.push(r.lockIn);
    repRuns.push(r.reputation);
  }

  const cost = toBands(costRuns, months);
  const lockIn = toBands(lockRuns, months);
  const reputation = toBands(repRuns, months);

  const finalCost = cost[months - 1].p50;
  const finalLock = lockIn[months - 1].p50;
  const finalRep = reputation[months - 1].p50;
  // Resilience: low lock-in + high reputation + tight cost uncertainty.
  const costSpread =
    (cost[months - 1].p90 - cost[months - 1].p10) /
    Math.max(cost[months - 1].p50, 0.001);
  const resilience = clamp(
    0.45 * (1 - finalLock) + 0.4 * finalRep + 0.15 * (1 - clamp(costSpread, 0, 1)),
    0,
    1,
  );

  return {
    strategy,
    cost,
    lockIn,
    reputation,
    summary: {
      strategy,
      finalCost,
      lockIn: finalLock,
      reputation: finalRep,
      resilience,
    },
  };
}

export function simulateAllCausal(
  scenario: Scenario,
  seed = 12345,
): CausalResult[] {
  return (["platform", "opensource", "hybrid"] as Strategy[]).map((s) =>
    simulateCausal(scenario, s, seed),
  );
}
