// Interactive structural causal diagram. The decision (Q), the levers and the
// fixed competition prior flow through the deterministic churn / margin maps
// into users and profit. Edge thickness, colour and node state are driven live
// by the current parameters — change a lever and the pathway changes.
import type { CausalState } from "@/lib/scenario/model";

type Shape = "rect" | "ellipse" | "diamond";
type Role = "decision" | "lever" | "prior" | "map" | "flow" | "outcome";

interface NodeDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  shape: Shape;
  role: Role;
}

const NODES: NodeDef[] = [
  { id: "Q", x: 120, y: 70, w: 150, h: 54, title: "Q", shape: "rect", role: "decision" },
  { id: "Qstar", x: 120, y: 175, w: 150, h: 50, title: "Q*", shape: "ellipse", role: "lever" },
  { id: "dm", x: 120, y: 275, w: 150, h: 50, title: "Δm", shape: "ellipse", role: "lever" },
  { id: "phi", x: 120, y: 375, w: 150, h: 50, title: "φ", shape: "ellipse", role: "prior" },
  { id: "chi", x: 415, y: 150, w: 150, h: 58, title: "χ", shape: "rect", role: "map" },
  { id: "m", x: 415, y: 320, w: 150, h: 58, title: "m", shape: "rect", role: "map" },
  { id: "N", x: 680, y: 230, w: 160, h: 64, title: "N(t)", shape: "ellipse", role: "flow" },
  { id: "Pi", x: 900, y: 230, w: 150, h: 96, title: "Π", shape: "diamond", role: "outcome" },
  { id: "shock", x: 680, y: 390, w: 150, h: 50, title: "shock", shape: "rect", role: "prior" },
];

const GOOD = "var(--exp-hybrid)";
const WARN = "var(--exp-accent-2)";
const BAD = "var(--exp-accent-3)";
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
  const rx = from.w / 2 + 6;
  const ry = from.h / 2 + 6;
  return { x: from.x + Math.cos(angle) * rx, y: from.y + Math.sin(angle) * ry };
}

function tex(text: string, color: string) {
  return [...text].map((c, i) =>
    /[\u0370-\u03FF]/.test(c) ? (
      <tspan key={i} className="exp-tex" fill={color}>
        {c}
      </tspan>
    ) : (
      <tspan key={i} fill={color}>
        {c}
      </tspan>
    ),
  );
}

export function CausalDiagram({
  cs,
  stratColor,
}: {
  cs: CausalState;
  stratColor: string;
}) {
  // Each edge: live intensity (0..1) and polarity (good = teal, bad = red).
  const edges: {
    a: string;
    b: string;
    intensity: number;
    bad: boolean;
  }[] = [
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
    shock: "price shock",
  };

  return (
    <svg viewBox="0 0 1010 460" width="100%" role="img" aria-label="Interactive causal pathway">
      <defs>
        <marker id="cd-good" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L7,3 L0,6 Z" fill={GOOD} />
        </marker>
        <marker id="cd-bad" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L7,3 L0,6 Z" fill={BAD} />
        </marker>
      </defs>

      {/* edges */}
      {edges.map((e, i) => {
        const from = byId(e.a);
        const to = byId(e.b);
        const a = anchor(from, to);
        const b = anchor(to, from);
        const col = e.bad ? BAD : GOOD;
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={col}
            strokeWidth={1 + e.intensity * 4.5}
            strokeOpacity={0.22 + e.intensity * 0.65}
            markerEnd={e.bad ? "url(#cd-bad)" : "url(#cd-good)"}
          />
        );
      })}

      {/* nodes */}
      {NODES.map((n) => {
        const left = n.x - n.w / 2;
        const top = n.y - n.h / 2;
        const col = nodeColor[n.id];
        return (
          <g key={n.id}>
            {n.shape === "rect" && (
              <rect x={left} y={top} width={n.w} height={n.h} rx={8}
                fill="var(--exp-surface)" stroke={col} strokeWidth={2.4} />
            )}
            {n.shape === "ellipse" && (
              <ellipse cx={n.x} cy={n.y} rx={n.w / 2} ry={n.h / 2}
                fill="var(--exp-surface)" stroke={col} strokeWidth={2.4} />
            )}
            {n.shape === "diamond" && (
              <polygon
                points={`${n.x},${top} ${n.x + n.w / 2},${n.y} ${n.x},${top + n.h} ${n.x - n.w / 2},${n.y}`}
                fill="var(--exp-surface)" stroke={col} strokeWidth={2.8} />
            )}
            <text x={n.x} y={n.y - 6} textAnchor="middle" dominantBaseline="central" className="cd-node-title">
              {tex(n.title, "var(--exp-ink)")}
            </text>
            <text x={n.x} y={n.y + 12} textAnchor="middle" dominantBaseline="central" className="cd-node-sub" fill="var(--exp-muted)">
              {nodeSub[n.id]}
            </text>
          </g>
        );
      })}

      {/* column captions */}
      <text x={120} y={26} textAnchor="middle" className="cd-col" fill="var(--exp-muted)">decision &amp; levers</text>
      <text x={415} y={26} textAnchor="middle" className="cd-col" fill="var(--exp-muted)">causal maps</text>
      <text x={680} y={26} textAnchor="middle" className="cd-col" fill="var(--exp-muted)">dynamics</text>
      <text x={900} y={26} textAnchor="middle" className="cd-col" fill="var(--exp-muted)">outcome</text>

      <rect x={862} y={150} width={4} height={6} fill={stratColor} opacity={0} />
    </svg>
  );
}
