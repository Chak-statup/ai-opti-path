// causal.js — interactive structural causal diagram, port of CausalDiagram.tsx.
// renderCausal(container, cs) draws the live pathway driven by causal state.
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

const NODES = [
  { id: "Q", x: 160, y: 95, w: 188, h: 70, glyph: "Q", italic: true, shape: "rect" },
  { id: "Qstar", x: 160, y: 250, w: 188, h: 62, glyph: "Q\u2217", italic: true, shape: "ellipse" },
  { id: "dm", x: 160, y: 360, w: 188, h: 62, glyph: "\u0394m", italic: true, shape: "ellipse" },
  { id: "phi", x: 470, y: 95, w: 188, h: 64, glyph: "\u03D5", italic: true, shape: "ellipse" },
  { id: "chi", x: 470, y: 270, w: 188, h: 74, glyph: "\u03C7", italic: true, shape: "rect" },
  { id: "m", x: 470, y: 440, w: 188, h: 74, glyph: "m", italic: true, shape: "rect" },
  { id: "N", x: 790, y: 320, w: 196, h: 82, glyph: "N(t)", italic: true, shape: "ellipse" },
  { id: "shock", x: 790, y: 500, w: 188, h: 62, glyph: "shock", italic: false, shape: "rect" },
  { id: "Pi", x: 1030, y: 320, w: 168, h: 112, glyph: "\u03A0", italic: true, shape: "diamond" },
];

const GOOD = "var(--exp-hybrid)";
const BAD = "var(--exp-accent-3)";
const WARN = "var(--exp-accent-2)";
const DECISION = "var(--exp-open)";

const GROUPS = [
  { id: "04", label: "Scaling", members: ["Qstar", "dm"], color: "var(--exp-frontier)" },
  { id: "03", label: "In-house build", members: ["chi", "m"], color: "var(--exp-hybrid)" },
  { id: "01", label: "Platform reach", members: ["N"], color: "var(--exp-open)" },
  { id: "02", label: "Vendor indep.", members: ["shock"], color: "var(--exp-accent-1)" },
];

function state3(norm) {
  if (norm < 0.34) return GOOD;
  if (norm < 0.67) return WARN;
  return BAD;
}
function byId(id) { return NODES.find((n) => n.id === id); }
function anchor(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const rx = from.w / 2 + 8;
  const ry = from.h / 2 + 8;
  return { x: from.x + Math.cos(angle) * rx, y: from.y + Math.sin(angle) * ry };
}
function curve(ax, ay, bx, by) {
  const mx = (ax + bx) / 2;
  return `M ${ax},${ay} C ${mx},${ay} ${mx},${by} ${bx},${by}`;
}
function groupBox(members) {
  const pad = 26, labelPad = 26;
  const ns = members.map(byId);
  const left = Math.min(...ns.map((n) => n.x - n.w / 2)) - pad;
  const right = Math.max(...ns.map((n) => n.x + n.w / 2)) + pad;
  const top = Math.min(...ns.map((n) => n.y - n.h / 2)) - pad - labelPad;
  const bottom = Math.max(...ns.map((n) => n.y + n.h / 2)) + pad;
  return { left, top, w: right - left, h: bottom - top };
}

export function renderCausal(container, cs) {
  container.innerHTML = "";

  const edges = [
    { a: "Q", b: "chi", intensity: cs.churnNorm, bad: cs.churnNorm > 0.5 },
    { a: "Qstar", b: "chi", intensity: cs.churnNorm, bad: cs.churnNorm > 0.5 },
    { a: "Q", b: "m", intensity: cs.marginNorm, bad: false },
    { a: "dm", b: "m", intensity: cs.marginNorm, bad: false },
    { a: "chi", b: "N", intensity: cs.churnNorm, bad: true },
    { a: "phi", b: "N", intensity: cs.comp, bad: true },
    { a: "m", b: "Pi", intensity: cs.marginNorm, bad: false },
    { a: "N", b: "Pi", intensity: cs.usersNorm, bad: false },
    { a: "shock", b: "Pi", intensity: cs.shockNorm, bad: true },
  ];

  const nodeColor = {
    Q: DECISION, Qstar: DECISION, dm: DECISION,
    phi: "var(--exp-axis)",
    chi: state3(cs.churnNorm),
    m: state3(1 - cs.marginNorm),
    N: state3(1 - cs.usersNorm),
    Pi: cs.profitPos ? GOOD : BAD,
    shock: cs.shockNorm > 0.5 ? BAD : "var(--exp-axis)",
  };
  const riskNorm = {
    chi: cs.churnNorm, m: 1 - cs.marginNorm, N: 1 - cs.usersNorm,
    shock: cs.shockNorm, Pi: cs.profitPos ? 0 : Math.max(0.6, cs.profitNorm),
  };
  const nodeSub = {
    Q: `quality ${cs.Q.toFixed(2)}`,
    Qstar: "market bar",
    dm: "margin lever",
    phi: "competition",
    chi: `churn ${cs.churn.toFixed(2)}`,
    m: `$${cs.margin.toFixed(1)}/user`,
    N: `${Math.round(cs.usersEnd)}k users`,
    Pi: `${cs.cumProfit < 0 ? "\u2212" : ""}$${Math.abs(cs.cumProfit).toFixed(0)}M`,
    shock: `token \u00d7${cs.tpfEff.toFixed(1)}`,
  };

  const svg = el("svg", {
    viewBox: "0 0 1230 600", width: "100%", role: "img",
    "aria-label": "Interactive causal pathway", class: "cd-svg",
  });

  const defs = el("defs");
  defs.innerHTML = `
    <marker id="cd-good" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 Z" fill="${GOOD}" /></marker>
    <marker id="cd-bad" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4 L0,8 Z" fill="${BAD}" /></marker>
    <filter id="cd-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="var(--exp-ink)" flood-opacity="0.12" /></filter>
    <filter id="cd-halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="11" /></filter>`;
  svg.appendChild(defs);

  // influence regions
  for (const g of GROUPS) {
    const b = groupBox(g.members);
    const grp = el("g");
    grp.appendChild(el("rect", {
      x: b.left, y: b.top, width: b.w, height: b.h, rx: 20,
      fill: g.color, "fill-opacity": 0.07, stroke: g.color,
      "stroke-opacity": 0.45, "stroke-width": 1.4, "stroke-dasharray": "2 7",
    }));
    const lab = el("g", { transform: `translate(${b.left + 16}, ${b.top + 18})` });
    lab.appendChild(el("rect", { x: -4, y: -13, width: 26, height: 18, rx: 5, fill: g.color }));
    lab.appendChild(el("text", { x: 9, y: -1, "text-anchor": "middle", "dominant-baseline": "central", class: "cd-region-num", fill: "var(--exp-bg)" }, g.id));
    lab.appendChild(el("text", { x: 30, y: -1, "dominant-baseline": "central", class: "cd-region-label", fill: g.color }, g.label));
    grp.appendChild(lab);
    svg.appendChild(grp);
  }

  // edges
  edges.forEach((e) => {
    const from = byId(e.a), to = byId(e.b);
    const a = anchor(from, to), b = anchor(to, from);
    const col = e.bad ? BAD : GOOD;
    const w = 1.5 + e.intensity * 6;
    const g = el("g");
    g.appendChild(el("path", {
      d: curve(a.x, a.y, b.x, b.y), fill: "none", stroke: col, "stroke-width": w,
      "stroke-opacity": 0.18 + e.intensity * 0.6, "stroke-linecap": "round",
      "marker-end": e.bad ? "url(#cd-bad)" : "url(#cd-good)",
    }));
    g.appendChild(el("path", {
      d: curve(a.x, a.y, b.x, b.y), fill: "none", stroke: col,
      "stroke-width": Math.max(1, w * 0.5), "stroke-opacity": 0.55 + e.intensity * 0.4,
      "stroke-linecap": "round", "stroke-dasharray": "2 14", class: "cd-flow",
    }));
    svg.appendChild(g);
  });

  // nodes
  for (const n of NODES) {
    const left = n.x - n.w / 2, top = n.y - n.h / 2;
    const col = nodeColor[n.id];
    const risk = riskNorm[n.id] ?? 0;
    const g = el("g");
    if (risk > 0.5) {
      g.appendChild(el("rect", {
        x: left - 6, y: top - 6, width: n.w + 12, height: n.h + 12, rx: 18,
        fill: BAD, "fill-opacity": 0.18 + (risk - 0.5) * 0.7, filter: "url(#cd-halo)",
      }));
    }
    const card = el("g", { filter: "url(#cd-shadow)" });
    if (n.shape === "rect") {
      card.appendChild(el("rect", { x: left, y: top, width: n.w, height: n.h, rx: 14, fill: "var(--exp-surface)", stroke: col, "stroke-width": 2.6 }));
    } else if (n.shape === "ellipse") {
      card.appendChild(el("rect", { x: left, y: top, width: n.w, height: n.h, rx: n.h / 2, fill: "var(--exp-surface)", stroke: col, "stroke-width": 2.6 }));
    } else {
      card.appendChild(el("polygon", { points: `${n.x},${top} ${n.x + n.w / 2},${n.y} ${n.x},${top + n.h} ${n.x - n.w / 2},${n.y}`, fill: "var(--exp-surface)", stroke: col, "stroke-width": 3 }));
    }
    card.appendChild(el("circle", { cx: left + 20, cy: top + 20, r: 5, fill: col }));
    const title = el("text", {
      x: n.x, y: n.y - 8, "text-anchor": "middle", "dominant-baseline": "middle",
      fill: "var(--exp-ink)",
    }, n.glyph);
    title.style.fontFamily = n.italic
      ? '"KaTeX_Math", "Latin Modern Math", "Cambria Math", serif'
      : "var(--exp-font)";
    title.style.fontStyle = n.italic ? "italic" : "normal";
    title.style.fontSize = "24px";
    title.style.fontWeight = "500";
    card.appendChild(title);
    card.appendChild(el("text", { x: n.x, y: n.y + 20, "text-anchor": "middle", "dominant-baseline": "central", class: "cd-node-sub", fill: "var(--exp-muted)" }, nodeSub[n.id]));
    g.appendChild(card);
    svg.appendChild(g);
  }

  container.appendChild(svg);
}
