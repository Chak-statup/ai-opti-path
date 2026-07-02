// Interactive structural causal diagram. The decision (Q), the internal levers
// and the external environment flow through the deterministic churn / margin
// maps into users and profit. Edge thickness, colour and node state are driven
// live by the current parameters; change a lever and the pathway reshapes.
//
// Every euro channel is a node: the market K (platform reach), the per-user
// serving cost s (token price through the vendor hedge), the fixed cost F
// (base + build + independence + compliance) and the regulatory load; so no
// lever changes profit "invisibly". Mutable nodes carry a live Δ-vs-baseline
// line (baseline = this strategy under today's status quo, default posture).
//
// Visual language: each of the four decisions owns a soft, colour-tinted
// "influence region" that encloses the nodes it drives, so a first-time viewer
// immediately sees what a lever affects. Nodes under pressure pick up a red
// risk halo. Labels are native SVG <text> (KaTeX_Math font) for mobile safety.
import { CALIB, type CausalState } from "@/lib/scenario/model";

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
  { id: "Q", x: 160, y: 95, w: 188, h: 74, glyph: "Q", italic: true, shape: "rect", role: "decision" },
  { id: "Qstar", x: 160, y: 250, w: 188, h: 62, glyph: "Q∗", italic: true, shape: "ellipse", role: "lever" },
  { id: "dm", x: 160, y: 360, w: 188, h: 62, glyph: "Δm", italic: true, shape: "ellipse", role: "lever" },
  { id: "phi", x: 470, y: 95, w: 168, h: 62, glyph: "ϕ", italic: true, shape: "ellipse", role: "prior" },
  { id: "chi", x: 470, y: 270, w: 188, h: 80, glyph: "χ", italic: true, shape: "rect", role: "map" },
  { id: "m", x: 470, y: 440, w: 188, h: 80, glyph: "m", italic: true, shape: "rect", role: "map" },
  { id: "K", x: 790, y: 80, w: 180, h: 60, glyph: "K", italic: true, shape: "ellipse", role: "flow" },
  { id: "N", x: 790, y: 255, w: 196, h: 84, glyph: "N(t)", italic: true, shape: "ellipse", role: "flow" },
  { id: "s", x: 790, y: 425, w: 190, h: 78, glyph: "s", italic: true, shape: "rect", role: "prior" },
  { id: "reg", x: 470, y: 562, w: 188, h: 60, glyph: "reg", italic: false, shape: "ellipse", role: "prior" },
  { id: "F", x: 1010, y: 558, w: 200, h: 74, glyph: "F", italic: true, shape: "rect", role: "map" },
  { id: "Pi", x: 1040, y: 300, w: 168, h: 112, glyph: "Π", italic: true, shape: "diamond", role: "outcome" },
];

const GOOD = "var(--exp-hybrid)";
const BAD = "var(--exp-accent-3)";
const WARN = "var(--exp-accent-2)";
const DECISION = "var(--exp-open)";

// The four decision axes and the nodes each one drives. These define the
// colour-tinted influence regions drawn behind the nodes. F is deliberately in
// no region; three levers raise it, so its sub-label decomposes the spend.
const GROUPS: { id: string; label: string; members: string[]; color: string }[] = [
  { id: "04", label: "Scaling", members: ["Qstar", "dm"], color: "var(--exp-frontier)" },
  { id: "03", label: "In-house build", members: ["chi", "m"], color: "var(--exp-hybrid)" },
  { id: "01", label: "Platform reach", members: ["K"], color: "var(--exp-open)" },
  { id: "02", label: "Vendor indep.", members: ["s"], color: "var(--exp-accent-1)" },
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
      y={n.y - 10}
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

// Signed Δ-vs-baseline line. goodWhenDown flips the colour semantics (churn
// falling is good; profit falling is bad). Returns null when the change is
// too small to be meaningful; the node then shows its value only.
function deltaLine(
  cur: number,
  base: number,
  eps: number,
  fmt: (d: number) => string,
  goodWhenDown = false,
): { text: string; color: string } | null {
  const d = cur - base;
  if (Math.abs(d) < eps) return null;
  const up = d > 0;
  const good = goodWhenDown ? !up : up;
  return {
    text: `${up ? "▲" : "▼"} ${fmt(Math.abs(d))} vs base`,
    color: good ? GOOD : BAD,
  };
}

export function CausalDiagram({
  cs,
  base,
  stratColor,
}: {
  cs: CausalState;
  base: CausalState;
  stratColor: string;
}) {
  void stratColor;

  // How loaded the fixed-cost line is with optional spend (investments +
  // compliance) relative to everything it could carry.
  const fixedNorm = Math.max(
    0,
    Math.min(1, (cs.fixed.total - cs.fixed.base) / (CALIB.F_innov + CALIB.F_resil + CALIB.F_reg)),
  );
  const regDrag = Math.max(0, Math.min(1, CALIB.regInnovDrag * cs.regN));

  const edges: { a: string; b: string; intensity: number; bad: boolean }[] = [
    { a: "Q", b: "chi", intensity: cs.churnNorm, bad: cs.churnNorm > 0.5 },
    { a: "Qstar", b: "chi", intensity: cs.churnNorm, bad: cs.churnNorm > 0.5 },
    { a: "Q", b: "m", intensity: cs.marginNorm, bad: false },
    { a: "dm", b: "m", intensity: cs.marginNorm, bad: false },
    { a: "chi", b: "N", intensity: cs.churnNorm, bad: true },
    { a: "phi", b: "N", intensity: cs.comp, bad: true },
    { a: "K", b: "N", intensity: cs.reachN, bad: false },
    { a: "m", b: "Pi", intensity: cs.marginNorm, bad: false },
    { a: "N", b: "Pi", intensity: cs.usersNorm, bad: false },
    { a: "s", b: "Pi", intensity: cs.shockNorm, bad: true },
    { a: "F", b: "Pi", intensity: fixedNorm, bad: true },
    { a: "reg", b: "F", intensity: cs.regN, bad: true },
    { a: "reg", b: "Q", intensity: regDrag, bad: true },
  ];

  const nodeColor: Record<string, string> = {
    Q: DECISION,
    Qstar: DECISION,
    dm: DECISION,
    phi: "var(--exp-axis)",
    chi: state3(cs.churnNorm),
    m: state3(1 - cs.marginNorm),
    K: DECISION,
    N: state3(1 - cs.usersNorm),
    Pi: cs.profitPos ? GOOD : BAD,
    s: cs.shockNorm > 0.5 ? BAD : "var(--exp-axis)",
    reg: cs.regN > 0.6 ? BAD : "var(--exp-axis)",
    F: state3(fixedNorm),
  };

  // Live risk intensity per node (0 = calm .. 1 = under heavy pressure). Drives
  // the red halo behind a card so risk reads at a glance.
  const riskNorm: Record<string, number> = {
    chi: cs.churnNorm,
    m: 1 - cs.marginNorm,
    N: 1 - cs.usersNorm,
    s: cs.shockNorm,
    reg: cs.regN,
    F: fixedNorm,
    Pi: cs.profitPos ? 0 : Math.max(0.6, cs.profitNorm),
  };

  const fixedK = (v: number) => (v / 1e3).toFixed(0);
  const nodeSub: Record<string, string> = {
    Q: `delivered quality ${cs.Q.toFixed(2)}`,
    Qstar: `users' bar ${cs.bar.toFixed(2)}`,
    dm: "ARPU premium",
    phi: "competition",
    chi: `churn ${cs.churn.toFixed(2)}/mo`,
    m: `€${cs.margin.toFixed(1)}/user`,
    K: `market ${(cs.KM * 1000).toFixed(0)}k people`,
    N: `${(cs.usersEnd * 1000).toFixed(1)}k users`,
    Pi: `${cs.cumProfit < 0 ? "−" : ""}€${Math.abs(cs.cumProfit).toFixed(1)}M`,
    s: `serving €${cs.serve.toFixed(1)}/user`,
    reg: `compliance load ${Math.round(cs.regN * 100)}`,
    F: `fixed €${fixedK(cs.fixed.total)}k/mo`,
  };

  // Second sub-line: the mechanism (s, F) or the change against the status-quo
  // baseline posture (everything the levers move).
  const deltas: Record<string, { text: string; color: string } | null> = {
    Q: deltaLine(cs.Q, base.Q, 0.005, (d) => d.toFixed(2)),
    chi: deltaLine(cs.churn, base.churn, 0.002, (d) => `${d.toFixed(2)}/mo`, true),
    m: deltaLine(cs.margin, base.margin, 0.05, (d) => `€${d.toFixed(1)}`),
    N: deltaLine(cs.usersEnd, base.usersEnd, 0.0005, (d) => `${(d * 1000).toFixed(1)}k`),
    Pi: deltaLine(cs.cumProfit, base.cumProfit, 0.05, (d) => `€${d.toFixed(1)}M`),
  };
  const detail: Record<string, string | undefined> = {
    s: cs.tpfRaw > 1 ? `vendor ×${cs.tpfRaw.toFixed(1)}, you pay ×${cs.tpfEff.toFixed(1)}` : undefined,
    F: `bld ${fixedK(cs.fixed.build)}k · ind ${fixedK(cs.fixed.indep)}k · reg ${fixedK(cs.fixed.compliance)}k`,
  };

  return (
    <svg viewBox="0 0 1230 640" width="100%" role="img" aria-label="Interactive causal pathway" className="cd-svg">
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
        const det = detail[n.id];
        const second = deltas[n.id] ?? (det ? { text: det, color: "var(--exp-muted)" } : null);
        const secondOutside = n.shape === "diamond"; // a diamond has no room for two lines
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
              <text x={n.x} y={n.y + (second && !secondOutside ? 12 : 18)} textAnchor="middle" dominantBaseline="central" className="cd-node-sub" fill="var(--exp-muted)">
                {nodeSub[n.id]}
              </text>
              {second && (
                <text
                  x={n.x}
                  y={secondOutside ? top + n.h + 16 : n.y + 28}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="cd-node-sub"
                  fill={second.color}
                >
                  {second.text}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
