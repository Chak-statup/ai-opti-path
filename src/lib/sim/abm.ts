import type { Scenario, ShockType, Strategy } from "./types";
import { STRATEGY_PARAMS, clamp, rng } from "./scenario";

/**
 * Agent-based model of AI-app adoption across a heterogeneous population of
 * internal teams, customers and partners connected in a social network.
 *
 * Each step, agents adopt or abandon AI apps based on perceived quality,
 * price, brand reputation and peer influence (network contagion). The chosen
 * strategy sets routing quality / cost / resilience; shocks perturb the whole
 * population at their configured month.
 */

export type AgentKind = "internal" | "customer" | "partner";
export type AgentState = "unaware" | "adopted" | "churned";

export interface Agent {
  id: number;
  kind: AgentKind;
  x: number;
  y: number;
  priceSensitivity: number;
  trust: number;
  dataSensitivity: number;
  switchProp: number;
  neighbors: number[];
  state: AgentState;
  /** adopted but currently below the satisfaction threshold */
  atRiskFlag: boolean;
  /** revenue value per active month */
  value: number;
}

export interface AbmMetrics {
  month: number;
  adopted: number;
  churned: number;
  atRisk: number;
  revenue: number;
  lostRevenue: number;
  reputation: number;
  price: number;
  quality: number;
}

export interface AbmState {
  agents: Agent[];
  month: number;
  reputation: number;
  price: number;
  quality: number;
  strategy: Strategy;
  scenario: Scenario;
  u: () => number;
  history: AbmMetrics[];
  peakRevenue: number;
}

const AGENT_COUNT = 360;
const KINDS: { kind: AgentKind; weight: number; value: number }[] = [
  { kind: "internal", weight: 0.3, value: 1 },
  { kind: "customer", weight: 0.55, value: 1.6 },
  { kind: "partner", weight: 0.15, value: 2.4 },
];

function pickKind(r: number): { kind: AgentKind; value: number } {
  let acc = 0;
  for (const k of KINDS) {
    acc += k.weight;
    if (r <= acc) return { kind: k.kind, value: k.value };
  }
  return { kind: "customer", value: 1.6 };
}

export function initAbm(
  scenario: Scenario,
  strategy: Strategy,
  seed = 4242,
): AbmState {
  const u = rng(seed + strategy.length * 104729);
  const p = STRATEGY_PARAMS[strategy];
  const agents: Agent[] = [];

  for (let i = 0; i < AGENT_COUNT; i++) {
    const { kind, value } = pickKind(u());
    agents.push({
      id: i,
      kind,
      x: u(),
      y: u(),
      priceSensitivity: 0.3 + u() * 0.6,
      trust: 0.3 + u() * 0.6,
      dataSensitivity: kind === "partner" ? 0.5 + u() * 0.5 : u() * 0.7,
      switchProp: u(),
      neighbors: [],
      state: "unaware",
      atRiskFlag: false,
      value,
    });
  }

  // Build a proximity-based social network (k nearest-ish via random sampling).
  for (const a of agents) {
    const cand = [];
    for (let j = 0; j < 14; j++) {
      const other = agents[Math.floor(u() * agents.length)];
      if (other.id !== a.id) {
        const d = (other.x - a.x) ** 2 + (other.y - a.y) ** 2;
        cand.push({ id: other.id, d });
      }
    }
    cand.sort((m, n) => m.d - n.d);
    a.neighbors = cand.slice(0, 5).map((c) => c.id);
  }

  // Seed initial adopters (early movers building on the chosen stack).
  const seeds = Math.round(AGENT_COUNT * 0.05 * p.launchRate);
  for (let i = 0; i < seeds; i++) {
    agents[Math.floor(u() * agents.length)].state = "adopted";
  }

  return {
    agents,
    month: 0,
    reputation: 1.0,
    price: 1.0,
    quality: p.baseQuality,
    strategy,
    scenario,
    u,
    history: [],
    peakRevenue: 1,
  };
}

function shockActive(
  scenario: Scenario,
  type: ShockType,
  month: number,
): boolean {
  const s = scenario.shocks[type];
  return s.enabled && month >= s.month;
}

export function stepAbm(state: AbmState): AbmMetrics {
  const { agents, scenario, u } = state;
  const p = STRATEGY_PARAMS[state.strategy];
  state.month += 1;
  const m = state.month;

  // Environment update from strategy + shocks.
  let price = 1.0;
  let quality = p.baseQuality;
  let repPressure = 0.006;

  if (shockActive(scenario, "priceSpike", m)) {
    price += scenario.shocks.priceSpike.magnitude * p.shockSensitivity.priceSpike * 0.9;
  }
  if (shockActive(scenario, "vendorTerms", m)) {
    price += scenario.shocks.vendorTerms.magnitude * p.shockSensitivity.vendorTerms * 0.5;
  }
  if (shockActive(scenario, "quality", m)) {
    quality -= scenario.shocks.quality.magnitude * p.shockSensitivity.quality * 0.4;
    repPressure -= scenario.shocks.quality.magnitude * p.shockSensitivity.quality * 0.04;
  }
  if (shockActive(scenario, "security", m)) {
    repPressure -= scenario.shocks.security.magnitude * p.shockSensitivity.security * 0.05;
  }
  if (shockActive(scenario, "regulation", m)) {
    repPressure -= scenario.shocks.regulation.magnitude * p.shockSensitivity.regulation * 0.02;
  }

  state.price = price;
  state.quality = clamp(quality, 0, 1);
  state.reputation = clamp(state.reputation + repPressure, 0, 1);

  const idToAgent = new Map(agents.map((a) => [a.id, a] as const));
  let atRisk = 0;

  for (const a of agents) {
    const peerAdopt =
      a.neighbors.reduce(
        (acc, id) => acc + (idToAgent.get(id)?.state === "adopted" ? 1 : 0),
        0,
      ) / Math.max(a.neighbors.length, 1);

    // Perceived utility of staying / adopting.
    const utility =
      0.5 * state.quality +
      0.3 * state.reputation +
      0.4 * peerAdopt -
      0.5 * a.priceSensitivity * (state.price - 1) -
      0.25 * a.dataSensitivity * (1 - p.control);

    a.atRiskFlag = false;
    if (a.state === "unaware") {
      const adoptP = clamp(utility * 0.5 * p.launchRate * a.trust, 0, 0.6);
      if (u() < adoptP) a.state = "adopted";
    } else if (a.state === "adopted") {
      if (utility < 0.35) {
        atRisk++;
        a.atRiskFlag = true;
      }
      const churnP = clamp((0.35 - utility) * a.switchProp, 0, 0.5);
      if (u() < churnP) a.state = "churned";
    } else {
      // churned agents may return when conditions improve
      const returnP = clamp((utility - 0.55) * 0.2, 0, 0.15);
      if (u() < returnP) a.state = "adopted";
    }
  }

  let adopted = 0;
  let churned = 0;
  let revenue = 0;
  let lostRevenue = 0;
  for (const a of agents) {
    if (a.state === "adopted") {
      adopted++;
      revenue += a.value;
    } else if (a.state === "churned") {
      churned++;
      lostRevenue += a.value;
    }
  }
  state.peakRevenue = Math.max(state.peakRevenue, revenue);

  const metrics: AbmMetrics = {
    month: m,
    adopted,
    churned,
    atRisk,
    revenue,
    lostRevenue,
    reputation: state.reputation,
    price: state.price,
    quality: state.quality,
  };
  state.history.push(metrics);
  return metrics;
}

export function runAbm(
  scenario: Scenario,
  strategy: Strategy,
  seed = 4242,
): AbmMetrics[] {
  const state = initAbm(scenario, strategy, seed);
  for (let i = 0; i < scenario.horizonMonths; i++) stepAbm(state);
  return state.history;
}
