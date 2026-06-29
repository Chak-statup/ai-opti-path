// linechart.js — hand-rolled SVG line chart, port of LineChart.tsx.
// renderInto(el, props) draws a chart into the given container element.

const SVGNS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    node.setAttribute(k, String(v));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return ticks;
}

// Wrap Greek math symbols (τ, Π, …) in KaTeX-styled tspans.
function appendTex(textNode, label) {
  for (const ch of [...label]) {
    const span = el("tspan", {}, ch);
    if (/[\u0370-\u03FF]/.test(ch)) span.setAttribute("class", "exp-tex");
    textNode.appendChild(span);
  }
}

export function renderChart(
  container,
  {
    xs,
    series,
    title,
    xLabel,
    yLabel,
    yFormat = (v) => `${v}`,
    xFormat = (v) => `${v}`,
    vGuides = [],
    zeroLine = false,
    height = 360,
    yDomain,
  },
) {
  container.innerHTML = "";

  const fig = document.createElement("figure");
  fig.className = "exp-fig";
  if (title) {
    const cap = document.createElement("figcaption");
    cap.className = "exp-fig-title";
    cap.textContent = title;
    fig.appendChild(cap);
  }

  const Mg = { l: 46, r: 12, t: title ? 22 : 10, b: 30 };
  const W = 600;
  const H = height;
  const iw = W - Mg.l - Mg.r;
  const ih = H - Mg.t - Mg.b;

  const xMin = xs[0];
  const xMax = xs[xs.length - 1];

  let yMin, yMax;
  if (yDomain) {
    [yMin, yMax] = yDomain;
  } else {
    let mn = Infinity;
    let mx = -Infinity;
    for (const s of series) for (const v of s.ys) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (!isFinite(mn)) { mn = 0; mx = 1; }
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.06;
    yMin = mn - pad;
    yMax = mx + pad;
  }

  const sx = (x) => Mg.l + ((x - xMin) / (xMax - xMin)) * iw;
  const sy = (y) => Mg.t + ih - ((y - yMin) / (yMax - yMin)) * ih;

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTicks = niceTicks(xMin, xMax, 5).filter((t) => t >= xMin && t <= xMax);

  function path(ys) {
    let d = "";
    const n = Math.min(ys.length, xs.length);
    for (let i = 0; i < n; i++) {
      d += `${i === 0 ? "M" : "L"}${sx(xs[i]).toFixed(2)},${sy(ys[i]).toFixed(2)}`;
    }
    return d;
  }

  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none",
    width: "100%",
    role: "img",
    "aria-label": title || "chart",
  });

  // gridlines + y ticks
  for (const t of yTicks) {
    svg.appendChild(el("line", {
      x1: Mg.l, x2: W - Mg.r, y1: sy(t), y2: sy(t),
      stroke: "var(--exp-grid)", "stroke-width": 1,
    }));
    svg.appendChild(el("text", {
      x: Mg.l - 6, y: sy(t), "text-anchor": "end",
      "dominant-baseline": "central", class: "exp-tick",
    }, yFormat(t)));
  }

  // zero / break-even line
  if (zeroLine && yMin < 0 && yMax > 0) {
    svg.appendChild(el("line", {
      x1: Mg.l, x2: W - Mg.r, y1: sy(0), y2: sy(0),
      stroke: "var(--exp-marker)", "stroke-width": 1,
    }));
  }

  // vertical guides
  for (const g of vGuides) {
    svg.appendChild(el("line", {
      x1: sx(g.x), x2: sx(g.x), y1: Mg.t, y2: Mg.t + ih,
      stroke: g.color ?? "var(--exp-axis)", "stroke-width": 1,
      "stroke-dasharray": g.dash === false ? undefined : "3 3",
    }));
    if (g.label) {
      const txt = el("text", {
        x: sx(g.x) + 3, y: Mg.t + 2, "dominant-baseline": "hanging",
        class: "exp-guide-label", fill: g.color ?? "var(--exp-muted)",
      });
      appendTex(txt, g.label);
      svg.appendChild(txt);
    }
  }

  // x axis
  svg.appendChild(el("line", {
    x1: Mg.l, x2: W - Mg.r, y1: Mg.t + ih, y2: Mg.t + ih,
    stroke: "var(--exp-axis)", "stroke-width": 1,
  }));
  for (const t of xTicks) {
    svg.appendChild(el("text", {
      x: sx(t), y: Mg.t + ih + 14, "text-anchor": "middle", class: "exp-tick",
    }, xFormat(t)));
  }

  // series
  for (const s of series) {
    svg.appendChild(el("path", {
      d: path(s.ys), fill: "none", stroke: s.color,
      "stroke-width": s.width, "stroke-opacity": s.opacity ?? 1,
      "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke",
    }));
  }

  if (xLabel) {
    svg.appendChild(el("text", {
      x: Mg.l + iw / 2, y: H - 2, "text-anchor": "middle", class: "exp-axis-label",
    }, xLabel));
  }
  if (yLabel) {
    svg.appendChild(el("text", {
      x: 12, y: Mg.t + ih / 2, "text-anchor": "middle",
      transform: `rotate(-90 12 ${Mg.t + ih / 2})`, class: "exp-axis-label",
    }, yLabel));
  }

  fig.appendChild(svg);
  container.appendChild(fig);
}
