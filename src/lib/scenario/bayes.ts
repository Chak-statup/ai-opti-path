// Bayesian / structural-causal layer for the Scenario Evaluator.
// Ports bayes_demo.py: naive priors on the uncertain world flow through the
// deterministic churn/margin maps into a Monte-Carlo distribution of cumulative
// profit. One inference query: posterior over the world given that an app LOST money.

import { chi, type Params } from "./model";

export interface PriorRange {
  lo: number;
  hi: number;
}

// Naive priors on the uncertain world (from bayes_demo.py).
export const PRIORS: Record<"qstar" | "phi" | "dm", PriorRange> = {
  qstar: { lo: 0.3, hi: 0.8 }, // where the market sets the quality bar
  phi: { lo: 0.2, hi: 0.5 }, // how hard competition bites
  dm: { lo: 3, hi: 9 }, // margin slope (does quality pay?)
};

// Deterministic, seeded RNG so the exhibit is reproducible.
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

function makeNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

export interface WorldDraws {
  Pi: number[]; // cumulative profit per world, in $M
  qstar: number[];
  phi: number[];
  dm: number[];
}

// Ancestral sampling: draw M worlds from the priors, run the noisy dynamics,
// return cumulative profit (in $M) plus the latent draws.
export function ancestralSample(
  Q: number,
  M: number,
  p: Params,
  seed: number,
): WorldDraws {
  const rng = mulberry32(seed);
  const randn = makeNormal(rng);
  const dt = 0.15;
  const nstep = Math.round(p.T / dt) + 1;
  const SCALE = 1e6;

  const Pi: number[] = new Array(M);
  const qstarArr: number[] = new Array(M);
  const phiArr: number[] = new Array(M);
  const dmArr: number[] = new Array(M);

  for (let w = 0; w < M; w++) {
    const qstar = PRIORS.qstar.lo + rng() * (PRIORS.qstar.hi - PRIORS.qstar.lo);
    const phi = PRIORS.phi.lo + rng() * (PRIORS.phi.hi - PRIORS.phi.lo);
    const dm = PRIORS.dm.lo + rng() * (PRIORS.dm.hi - PRIORS.dm.lo);

    const ch = chi(Q, qstar, p);
    const m = p.m0 + dm * Q;

    let N = p.N0;
    let acc = 0;
    let prev: number | null = null;
    for (let i = 0; i < nstep; i++) {
      const ti = i * dt;
      const comp = (phi * ti) / p.T;
      const gate = ti >= p.tau ? 1 : 0;
      const shock = ti >= p.t_shock ? 1 : 0;
      const flow = gate * (m - p.dm_shock * shock) * N - p.c_ac * (ch + comp) * N - p.F;
      if (prev !== null) acc += 0.5 * (prev + flow) * dt;
      prev = flow;
      if (i < nstep - 1) {
        const adds = p.p * (p.K - N) + p.r * N * (1 - N / p.K);
        const loss = (ch + comp) * N;
        N = Math.max(0, N + (adds - loss) * dt + p.sigma * N * Math.sqrt(dt) * randn());
      }
    }
    Pi[w] = acc / SCALE;
    qstarArr[w] = qstar;
    phiArr[w] = phi;
    dmArr[w] = dm;
  }

  return { Pi, qstar: qstarArr, phi: phiArr, dm: dmArr };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function fracPositive(xs: number[]): number {
  return xs.filter((v) => v > 0).length / xs.length;
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

// Histogram with fixed range; density optional (returns counts otherwise).
export function histogram(
  xs: number[],
  lo: number,
  hi: number,
  bins: number,
  density = false,
): Bin[] {
  const width = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of xs) {
    if (v < lo || v > hi) continue;
    let idx = Math.floor((v - lo) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx] += 1;
  }
  const n = xs.length || 1;
  return counts.map((c, i) => ({
    x0: lo + i * width,
    x1: lo + (i + 1) * width,
    count: density ? c / (n * width) : c,
  }));
}
