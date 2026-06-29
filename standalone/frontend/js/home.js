// home.js — animated background chart for the landing page, port of HomeChart.tsx.
import { sweepCumProfit } from "./model.js";

const STRAT_COLORS = ["#2980B9", "#16A085", "#4B2C50"];
const SVGNS = "http://www.w3.org/2000/svg";

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPath(ys, xs, sx, sy) {
  let d = "";
  for (let i = 0; i < ys.length; i++) {
    d += `${i === 0 ? "M" : "L"}${sx(xs[i]).toFixed(2)},${sy(ys[i]).toFixed(2)}`;
  }
  return d;
}

export async function renderHomeChart(container) {
  let data;
  try {
    const res = await fetch("/runs.json");
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }

  const xs = data.qstar_grid;
  const sweep = sweepCumProfit(data, data.meta.controls.dm.default);

  const W = 1000;
  const H = 520;
  const xMin = xs[0];
  const xMax = xs[xs.length - 1];
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const row of sweep) for (const v of row) {
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  }
  const pad = (yMax - yMin) * 0.1;
  yMin -= pad;
  yMax += pad;
  const sx = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  const span = yMax - yMin;

  const rnd = mulberry32(20260629);
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "lp-bg-chart");
  svg.setAttribute("viewBox", "0 0 1000 520");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");

  sweep.forEach((ys, s) => {
    const g = document.createElementNS(SVGNS, "g");
    for (let i = 0; i < 4; i++) {
      const jit = ys.map((v) => v + (rnd() - 0.5) * span * 0.07);
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", buildPath(jit, xs, sx, sy));
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", STRAT_COLORS[s]);
      p.setAttribute("stroke-width", "1");
      p.setAttribute("stroke-opacity", "0.18");
      p.setAttribute("class", "lp-bg-noisy");
      p.style.animationDelay = `${(s * 4 + i) * 0.4}s`;
      g.appendChild(p);
    }
    const main = document.createElementNS(SVGNS, "path");
    main.setAttribute("d", buildPath(ys, xs, sx, sy));
    main.setAttribute("fill", "none");
    main.setAttribute("stroke", STRAT_COLORS[s]);
    main.setAttribute("stroke-width", "2.5");
    main.setAttribute("stroke-opacity", "0.55");
    main.setAttribute("class", "lp-bg-main");
    main.style.animationDelay = `${s * 0.5}s`;
    g.appendChild(main);
    svg.appendChild(g);
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

const bg = document.getElementById("hero-bg");
if (bg) renderHomeChart(bg);
