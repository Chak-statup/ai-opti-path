// Interactive structural causal diagram. The decision (Q), the internal levers
// and the external environment flow through the deterministic churn / margin
// maps into users and profit. Edge thickness, colour and node state are driven
// live by the current parameters — change a lever and the pathway reshapes.
//
// Visual language: rounded "cards" with a soft shadow, curved (bezier) edges
// with an animated flow, larger legible labels, and column header pills. Colours
// come entirely from the existing design tokens.
import type { CausalState } from "@/lib/scenario/model";

type Shape = "rect" | "ellipse" | "diamond";
type Role = "decision" | "lever" | "prior" | "map" | "flow" | "outcome";

interface NodeDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // Native SVG glyph (renders identically across browsers, unlike KaTeX in
  // foreignObject which fails to scale on mobile Safari/Firefox).
  glyph: string;
  italic: boolean; // math symbols are italic to match LaTeX styling
  shape: Shape;
  role: Role;
}

const NODES: NodeDef[] = [
  { id: "Q", x: 150, y: 95, w: 188, h: 70, glyph: "Q", italic: true, shape: "rect", role: "decision" },
  { id: "Qstar", x: 150, y: 210, w: 188, h: 64, glyph: "Q\u2217", italic: true, shape: "ellipse", role: "lever" },
  { id: "dm", x: 150, y: 320, w: 188, h: 64, glyph: "\u0394m", italic: true, shape: "ellipse", role: "lever" },
  { id: "phi", x: 150, y: 430, w: 188, h: 64, glyph: "\u03D5", italic: true, shape: "ellipse", role: "prior" },
  { id: "chi", x: 490, y: 185, w: 188, h: 74, glyph: "\u03C7", italic: true, shape: "rect", role: "map" },
  { id: "m", x: 490, y: 380, w: 188, h: 74, glyph: "m", italic: true, shape: "rect", role: "map" },
  { id: "N", x: 790, y: 280, w: 196, h: 82, glyph: "N(t)", italic: true, shape: "ellipse", role: "flow" },
  { id: "Pi", x: 1010, y: 280, w: 168, h: 116, glyph: "\u03A0", italic: true, shape: "diamond", role: "outcome" },
  { id: "shock", x: 790, y: 460, w: 188, h: 64, glyph: "shock", italic: false, shape: "rect", role: "prior" },
];

const GOOD = "var(--exp-hybrid)";
const BAD = "var(--exp-accent-3)";
const WARN = "var(--exp-accent-2)";
const DECISION = "var(--exp-open)";

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

// Smooth horizontal-biased cubic bezier between two points.
function curve(ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2;
  return `M ${ax},${ay} C ${mx},${ay} ${mx},${by} ${bx},${by}`;
}

// Render the node title as native SVG text. Using <text> (instead of KaTeX in
// a foreignObject) guarantees the label stays centered and scales with the
// viewBox on every browser, including mobile Safari/Firefox. The KaTeX math
// font keeps the LaTeX look for Greek and italic math symbols.
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

  const nodeSub: Record<string, string> = {
    Q: `quality ${cs.Q.toFixed(2)}`,
    Qstar: "market bar",
    dm: "margin lever",
    phi: "competition",
    chi: `churn ${cs.churn.toFixed(2)}`,
    m: `$${cs.margin.toFixed(1)}/user`,
    N: `${Math.round(cs.usersEnd)}k users`,
    Pi: `${cs.cumProfit < 0 ? "−" : ""}$${Math.abs(cs.cumProfit).toFixed(0)}M`,
    shock: `token ×${cs.tpfEff.toFixed(1)}`,
  };

  return (
    <svg viewBox="0 0 1180 540" width="100%" role="img" aria-label="Interactive causal pathway" className="cd-svg">
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
      </defs>

      {/* column bands */}
      {[
        { x: 60, w: 180, label: "decision & levers" },
        { x: 396, w: 188, label: "causal maps" },
        { x: 692, w: 196, label: "dynamics" },
        { x: 926, w: 168, label: "outcome" },
      ].map((c) => (
        <g key={c.label}>
          <rect
            x={c.x}
            y={48}
            width={c.w}
            height={460}
            rx={16}
            fill="var(--exp-grid)"
            fillOpacity={0.25}
          />
        </g>
      ))}

      {/* column captions as pills */}
      {[
        { x: 150, label: "decision & levers" },
        { x: 490, label: "causal maps" },
        { x: 790, label: "dynamics" },
        { x: 1010, label: "outcome" },
      ].map((c) => (
        <text key={c.label} x={c.x} y={34} textAnchor="middle" className="cd-col" fill="var(--exp-muted)">
          {c.label}
        </text>
      ))}

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
        return (
          <g key={n.id} filter="url(#cd-shadow)">
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
        );
      })}
    </svg>
  );
}
