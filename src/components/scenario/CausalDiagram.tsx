// Structural causal diagram (DAG): how decision + priors flow through the
// deterministic churn/margin maps into profit. Hand-rolled SVG, design tokens only.

type Shape = "rect" | "ellipse" | "diamond";

interface NodeDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  shape: Shape;
  color: string;
}

const C_DECISION = "var(--exp-open)"; // blue
const C_PRIOR = "var(--exp-hybrid)"; // teal
const C_DET = "var(--exp-axis)"; // gray
const C_OUT = "var(--exp-marker)"; // dark

const NODES: NodeDef[] = [
  { id: "Q", x: 130, y: 95, w: 130, h: 56, lines: ["Q", "decision"], shape: "rect", color: C_DECISION },
  { id: "Qstar", x: 130, y: 195, w: 150, h: 52, lines: ["Q* ~ U(.3, .8)"], shape: "ellipse", color: C_PRIOR },
  { id: "phi", x: 130, y: 285, w: 150, h: 52, lines: ["φ ~ U(.2, .5)"], shape: "ellipse", color: C_PRIOR },
  { id: "dm", x: 130, y: 375, w: 150, h: 52, lines: ["Δm ~ U(3, 9)"], shape: "ellipse", color: C_PRIOR },
  { id: "chi", x: 460, y: 165, w: 140, h: 58, lines: ["χ(Q, Q*)", "churn"], shape: "rect", color: C_DET },
  { id: "m", x: 460, y: 360, w: 140, h: 58, lines: ["m(Q, Δm)", "margin"], shape: "rect", color: C_DET },
  { id: "N", x: 700, y: 205, w: 150, h: 64, lines: ["N(t)", "users + noise"], shape: "ellipse", color: C_DECISION },
  { id: "Pi", x: 905, y: 250, w: 150, h: 90, lines: ["Π", "profit"], shape: "diamond", color: C_OUT },
];

const EDGES: { a: string; b: string; faint?: boolean }[] = [
  { a: "Q", b: "chi" },
  { a: "Qstar", b: "chi" },
  { a: "Q", b: "m" },
  { a: "dm", b: "m" },
  { a: "chi", b: "N" },
  { a: "phi", b: "N" },
  { a: "N", b: "Pi" },
  { a: "m", b: "Pi" },
  { a: "chi", b: "Pi", faint: true },
  { a: "phi", b: "Pi", faint: true },
];

function byId(id: string) {
  return NODES.find((n) => n.id === id)!;
}

// Compute the point on a node boundary toward a target (simple box/ellipse clip).
function anchor(from: NodeDef, to: NodeDef): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const rx = from.w / 2 + 6;
  const ry = from.h / 2 + 6;
  return { x: from.x + Math.cos(angle) * rx, y: from.y + Math.sin(angle) * ry };
}

function renderTex(text: string, color: string) {
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

export function CausalDiagram() {
  return (
    <svg viewBox="0 0 1000 470" width="100%" role="img" aria-label="Structural causal diagram">
      {/* column legend */}
      <text x={130} y={36} textAnchor="middle" className="cd-col" fill={C_DECISION}>
        decision
      </text>
      <text x={130} y={52} textAnchor="middle" className="cd-col" fill={C_PRIOR}>
        uncertain (prior)
      </text>
      <text x={460} y={44} textAnchor="middle" className="cd-col" fill={C_DET}>
        deterministic map
      </text>
      <text x={905} y={44} textAnchor="middle" className="cd-col" fill={C_OUT}>
        outcome
      </text>

      <defs>
        <marker id="cd-arrow" markerWidth="9" markerHeight="9" refX="7" refY="3"
          orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L7,3 L0,6 Z" fill="var(--exp-axis)" />
        </marker>
        <marker id="cd-arrow-faint" markerWidth="9" markerHeight="9" refX="7" refY="3"
          orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L7,3 L0,6 Z" fill="var(--exp-grid)" />
        </marker>
      </defs>

      {/* edges */}
      {EDGES.map((e, i) => {
        const from = byId(e.a);
        const to = byId(e.b);
        const a = anchor(from, to);
        const b = anchor(to, from);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={e.faint ? "var(--exp-grid)" : "var(--exp-axis)"}
            strokeWidth={e.faint ? 1 : 1.4}
            markerEnd={e.faint ? "url(#cd-arrow-faint)" : "url(#cd-arrow)"}
          />
        );
      })}

      {/* nodes */}
      {NODES.map((n) => {
        const left = n.x - n.w / 2;
        const top = n.y - n.h / 2;
        return (
          <g key={n.id}>
            {n.shape === "rect" && (
              <rect x={left} y={top} width={n.w} height={n.h} rx={8}
                fill="var(--exp-surface)" stroke={n.color} strokeWidth={2} />
            )}
            {n.shape === "ellipse" && (
              <ellipse cx={n.x} cy={n.y} rx={n.w / 2} ry={n.h / 2}
                fill="var(--exp-surface)" stroke={n.color} strokeWidth={2} />
            )}
            {n.shape === "diamond" && (
              <polygon
                points={`${n.x},${top} ${n.x + n.w / 2},${n.y} ${n.x},${top + n.h} ${n.x - n.w / 2},${n.y}`}
                fill="var(--exp-surface)"
                stroke={n.color}
                strokeWidth={2.4}
              />
            )}
            {n.lines.map((ln, li) => (
              <text
                key={li}
                x={n.x}
                y={n.y + (li - (n.lines.length - 1) / 2) * 15}
                textAnchor="middle"
                dominantBaseline="central"
                className="cd-node-label"
              >
                {renderTex(ln, "var(--exp-ink)")}
              </text>
            ))}
          </g>
        );
      })}

      <text x={905} y={310} textAnchor="middle" className="cd-note" fill="var(--exp-muted)">
        (+ price shock)
      </text>
    </svg>
  );
}
