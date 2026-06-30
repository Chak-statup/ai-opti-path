// radar.js — hand-rolled SVG radar / spider chart, port of RadarChart.tsx.
// renderRadar(container, axes, series, size). Values 0..100 per axis.
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

function wrapLabel(label) {
  const words = label.split(" ");
  if (words.length < 2) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function renderRadar(container, axes, series, size = 460) {
  container.innerHTML = "";
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 92;
  const n = axes.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i, v) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
    return { x: cx + Math.cos(angle(i)) * r, y: cy + Math.sin(angle(i)) * r };
  };
  const polyPoints = (vals) =>
    vals.map((v, i) => { const p = point(i, v); return `${p.x},${p.y}`; }).join(" ");

  const svg = el("svg", {
    viewBox: `0 0 ${size} ${size}`, width: "100%", role: "img", "aria-label": "Risk radar",
  });

  for (const r of [25, 50, 75, 100]) {
    svg.appendChild(el("polygon", {
      points: axes.map((_, i) => { const p = point(i, r); return `${p.x},${p.y}`; }).join(" "),
      fill: "none", stroke: "var(--exp-grid)", "stroke-width": 1,
    }));
  }
  axes.forEach((_, i) => {
    const p = point(i, 100);
    svg.appendChild(el("line", { x1: cx, y1: cy, x2: p.x, y2: p.y, stroke: "var(--exp-grid)", "stroke-width": 1 }));
  });
  for (const s of series) {
    svg.appendChild(el("polygon", {
      points: polyPoints(s.values),
      fill: s.fill === false ? "none" : s.color,
      "fill-opacity": s.fill === false ? 0 : 0.14,
      stroke: s.color, "stroke-width": 2,
      "stroke-dasharray": s.dashed ? "5 4" : undefined,
    }));
  }
  axes.forEach((label, i) => {
    const a = angle(i);
    const r = radius + 22;
    const lx = cx + Math.cos(a) * r;
    const ly = cy + Math.sin(a) * r;
    const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    const lines = wrapLabel(label);
    const dyStart = -((lines.length - 1) * 7);
    const txt = el("text", {
      x: lx, y: ly, "text-anchor": anchor, "dominant-baseline": "central",
      class: "radar-axis-label", fill: "var(--exp-muted)",
    });
    lines.forEach((ln, li) => {
      txt.appendChild(el("tspan", { x: lx, dy: li === 0 ? dyStart : 14 }, ln));
    });
    svg.appendChild(txt);
  });

  container.appendChild(svg);
}
