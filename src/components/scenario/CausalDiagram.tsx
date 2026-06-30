// Interactive structural causal diagram. The decision (Q), the internal levers
// and the external environment flow through the deterministic churn / margin
// maps into users and profit. Edge thickness, colour and node state are driven
// live by the current parameters — change a lever and the pathway reshapes.
//
// Visual language: each of the four decisions owns a soft, colour-tinted
// "influence region" that encloses the nodes it drives, so a first-time viewer
// immediately sees what a lever affects. Nodes under pressure pick up a red
// risk halo. Labels are native SVG <text> (KaTeX_Math font) for mobile safety.
import type { CausalState } from "@/lib/scenario/model";

type Shape = "rect" | "ellipse" | "diamond";
type Role = "decision" | "lever" | "prior" | "map" | "flow" | "outcome";

interface NodeDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  glyph: string;
  italic: boolean;
  shape: Shape;
  role: Role;
}

const NODES: NodeDef[] = [
  { id: "Q", x: 160, y: 95, w: 188, h: 70, glyph: "Q", italic: true, shape: "rect", role: "decision" },
  { id: "Qstar", x: 160, y: 250, w: 188, h: 62, glyph: "Q\u2217", italic: true, shape: "ellipse", role: "lever" },
  { id: "dm", x: 160, y: 360, w: 188, h: 62, glyph: "\u0394m", italic: true, shape: "ellipse", role: "lever" },
  { id: "phi", x: 470, y: 95, w: 188, h: 64, glyph: "\u03D5", italic: true, shape: "ellipse", role: "prior" },
  { id: "chi", x: 470, y: 270, w: 188, h: 74, glyph: "\u03C7", italic: true, shape: "rect", role: "map" },
  { id: "m", x: 470, y: 440, w: 188, h: 74, glyph: "m", italic: true, shape: "rect", role: "map" },
  { id: "N", x: 790, y: 320, w: 196, h: 82, glyph: "N(t)", italic: true, shape: "ellipse", role: "flow" },
  { id: "shock", x: 790, y: 500, w: 188, h: 62, glyph: "shock", italic: false, shape: "rect", role: "prior" },
  { id: "Pi", x: 1030, y: 320, w: 168, h: 112, glyph: "\u03A0", italic: true, shape: "diamond", role: "outcome" },
];

const GOOD = "var(--exp-hybrid)";
const BAD = "var(--exp-accent-3)";
const WARN = "var(--exp-accent-2)";
const DECISION = "var(--exp-open)";

// The four decision axes and the nodes each one drives. These define the
// colour-tinted influence regions drawn behind the nodes.
const GROUPS: { id: string; label: string; members: string[]; color: string }[] = [
  { id: "04", label: "Scaling", members: ["Qstar", "dm"], color: "var(--exp-frontier)" },
  { id: "03", label: "In-house build", members: ["chi", "m"], color: "var(--exp-hybrid)" },
  { id: "01", label: "Platform reach", members: ["N"], color: "var(--exp-open)" },
  { id: "02", label: "Vendor indep.", members: ["shock"], color: "var(--exp-accent-1)" },
];

function state3(norm: number): string {
  if (norm < 0.34) return GOOD;
  if (norm < 0.67) return WARN;
  return BAD;
}

function byId(id: string) {
  return NODES.find((n) => n.id === id)!;
}

function anchor(from: NodeDef, to: NodeDef) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const rx = from.w / 2 + 8;
  const ry = from.h / 2 + 8;
  return { x: from.x + Math.cos(angle) * rx, y: from.y + Math.sin(angle) * ry };
}

function curve(ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2;
  return `M ${ax},${ay} C ${mx},${ay} ${mx},${by} ${bx},${by}`;
}

// Bounding box of a group of nodes, padded; extra top room for the region label.
function groupBox(members: string[]) {
  const pad = 26;
  const labelPad = 26;
  const ns = members.map(byId);
  const left = Math.min(...ns.map((n) => n.x - n.w / 2)) - pad;
  const right = Math.max(...ns.map((n) => n.x + n.w / 2)) + pad;
  const top = Math.min(...ns.map((n) => n.y - n.h / 2)) - pad - labelPad;
  const bottom = Math.max(...ns.map((n) => n.y + n.h / 2)) + pad;
  return { left, top, w: right - left, h: bottom - top };
}

function NodeTitle({ n }: { n: NodeDef }) {
  return (
    <text
      x={n.x}
      y={n.y - 8}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="var(--exp-ink)"
      style={{
        fontFamily: n.italic
          ? '"KaTeX_Math", "Latin Modern Math", "Cambria Math", serif'
          : "var(--exp-font)",
        fontStyle: n.italic ? "italic" : "normal",
        fontSize: "24px",
        fontWeight: 500,
      }}
    >
      {n.glyph}
    </text>
  );
}

export function CausalDiagram({
  cs,
  stratColor,
}: {
  cs: CausalState;
  stratColor: string;
}) {
  void stratColor;

  const edges: { a: string; b: string; intensity: number; bad: boolean }[] = [
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

  const nodeColor: Record<string, string> = {
    Q: DECISION,
    Qstar: DECISION,
    dm: DECISION,
    phi: "var(--exp-axis)",
    chi: state3(cs.churnNorm),
    m: state3(1 - cs.marginNorm),
    N: state3(1 - cs.usersNorm),
    Pi: cs.profitPos ? GOOD : BAD,
    shock: cs.shockNorm > 0.5 ? BAD : "var(--exp-axis)",
  };

  // Live risk intensity per node (0 = calm .. 1 = under heavy pressure). Drives
  // the red halo behind a card so risk reads at a glance.
  const riskNorm: Record<string, number> = {
    chi: cs.churnNorm,
    m: 1 - cs.marginNorm,
    N: 1 - cs.usersNorm,
    shock: cs.shockNorm,
    Pi: cs.profitPos ? 0 : Math.max(0.6, cs.profitNorm),
  };

  const nodeSub: Record<string, string> = {
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

  return (
    <svg viewBox="0 0 1230 600" width="100%" role="img" aria-label="Interactive causal pathway" className="cd-svg">
      <defs>
        <marker id="cd-good" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L9,4 L0,8 Z" fill={GOOD} />
        </marker>
        <marker id="cd-bad" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L9,4 L0,8 Z" fill={BAD} />
        </marker>
        <filter id="cd-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="var(--exp-ink)" floodOpacity="0.12" />
        </filter>
        <filter id="cd-halo" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
      </defs>

      {/* influence regions: one per decision axis, enclosing the nodes it drives */}
      {GROUPS.map((g) => {
        const b = groupBox(g.members);
        return (
          <g key={g.id}>
            <rect
              x={b.left}
              y={b.top}
              width={b.w}
              height={b.h}
              rx={20}
              fill={g.color}
              fillOpacity={0.07}
              stroke={g.color}
              strokeOpacity={0.45}
              strokeWidth={1.4}
              strokeDasharray="2 7"
            />
            <g transform={`translate(${b.left + 16}, ${b.top + 18})`}>
              <rect x={-4} y={-13} width={26} height={18} rx={5} fill={g.color} />
              <text x={9} y={-1} textAnchor="middle" dominantBaseline="central" className="cd-region-num" fill="var(--exp-bg)">
                {g.id}
              </text>
              <text x={30} y={-1} dominantBaseline="central" className="cd-region-label" fill={g.color}>
                {g.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* edges */}
      {edges.map((e, i) => {
        const from = byId(e.a);
        const to = byId(e.b);
        const a = anchor(from, to);
        const b = anchor(to, from);
        const col = e.bad ? BAD : GOOD;
        const w = 1.5 + e.intensity * 6;
        return (
          <g key={i}>
            <path
              d={curve(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke={col}
              strokeWidth={w}
              strokeOpacity={0.18 + e.intensity * 0.6}
              strokeLinecap="round"
              markerEnd={e.bad ? "url(#cd-bad)" : "url(#cd-good)"}
            />
            <path
              d={curve(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke={col}
              strokeWidth={Math.max(1, w * 0.5)}
              strokeOpacity={0.55 + e.intensity * 0.4}
              strokeLinecap="round"
              strokeDasharray="2 14"
              className="cd-flow"
            />
          </g>
        );
      })}

      {/* nodes */}
      {NODES.map((n) => {
        const left = n.x - n.w / 2;
        const top = n.y - n.h / 2;
        const col = nodeColor[n.id];
        const risk = riskNorm[n.id] ?? 0;
        const showHalo = risk > 0.5;
        return (
          <g key={n.id}>
            {showHalo && (
              <rect
                x={left - 6}
                y={top - 6}
                width={n.w + 12}
                height={n.h + 12}
                rx={18}
                fill={BAD}
                fillOpacity={0.18 + (risk - 0.5) * 0.7}
                filter="url(#cd-halo)"
              />
            )}
            <g filter="url(#cd-shadow)">
              {n.shape === "rect" && (
                <rect x={left} y={top} width={n.w} height={n.h} rx={14}
                  fill="var(--exp-surface)" stroke={col} strokeWidth={2.6} />
              )}
              {n.shape === "ellipse" && (
                <rect x={left} y={top} width={n.w} height={n.h} rx={n.h / 2}
                  fill="var(--exp-surface)" stroke={col} strokeWidth={2.6} />
              )}
              {n.shape === "diamond" && (
                <polygon
                  points={`${n.x},${top} ${n.x + n.w / 2},${n.y} ${n.x},${top + n.h} ${n.x - n.w / 2},${n.y}`}
                  fill="var(--exp-surface)" stroke={col} strokeWidth={3} />
              )}
              <circle cx={left + 20} cy={top + 20} r={5} fill={col} />
              <NodeTitle n={n} />
              <text x={n.x} y={n.y + 20} textAnchor="middle" dominantBaseline="central" className="cd-node-sub" fill="var(--exp-muted)">
                {nodeSub[n.id]}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
