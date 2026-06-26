// Illustrative causal-loop diagram: the reinforcing lock-in loop (R) vs the
// balancing optionality loop (B) that a hybrid strategy introduces.

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  tone: "platform" | "risk" | "cost" | "hybrid" | "quality";
}

const NODES: Node[] = [
  { id: "apps", label: "AI apps built", x: 170, y: 60, tone: "platform" },
  { id: "lockin", label: "Vendor lock-in", x: 380, y: 60, tone: "risk" },
  { id: "switch", label: "Switching cost", x: 470, y: 200, tone: "risk" },
  { id: "cost", label: "Cost exposure", x: 300, y: 280, tone: "cost" },
  { id: "gov", label: "Governance & routing", x: 90, y: 220, tone: "hybrid" },
  { id: "option", label: "Optionality", x: 80, y: 360, tone: "quality" },
];

const EDGES: { from: string; to: string; sign: "+" | "-"; loop: "R" | "B" }[] = [
  { from: "apps", to: "lockin", sign: "+", loop: "R" },
  { from: "lockin", to: "switch", sign: "+", loop: "R" },
  { from: "switch", to: "apps", sign: "+", loop: "R" },
  { from: "lockin", to: "cost", sign: "+", loop: "R" },
  { from: "gov", to: "option", sign: "+", loop: "B" },
  { from: "option", to: "lockin", sign: "-", loop: "B" },
  { from: "gov", to: "cost", sign: "-", loop: "B" },
];

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

export function CausalLoopDiagram() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
      <svg viewBox="0 0 560 420" className="h-auto w-full">
        <defs>
          <marker
            id="arrow-r"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L7,3 L0,6 Z" fill="var(--color-risk)" />
          </marker>
          <marker
            id="arrow-b"
            markerWidth="9"
            markerHeight="9"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L7,3 L0,6 Z" fill="var(--color-quality)" />
          </marker>
        </defs>

        {EDGES.map((e, i) => {
          const a = nodeById(e.from);
          const b = nodeById(e.to);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const color = e.loop === "R" ? "var(--color-risk)" : "var(--color-quality)";
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth={1.6}
                strokeOpacity={0.55}
                markerEnd={e.loop === "R" ? "url(#arrow-r)" : "url(#arrow-b)"}
              />
              <circle cx={mx} cy={my} r={9} fill="var(--color-card)" stroke={color} />
              <text
                x={mx}
                y={my + 3.5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={color}
              >
                {e.sign}
              </text>
            </g>
          );
        })}

        {NODES.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x - 62}
              y={n.y - 18}
              width={124}
              height={36}
              rx={10}
              fill={`var(--color-${n.tone}-soft)`}
              stroke={`var(--color-${n.tone})`}
              strokeWidth={1.2}
            />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="600"
              fill="var(--color-foreground)"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-risk" /> Reinforcing
          lock-in loop (R)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-quality" /> Balancing
          optionality loop (B)
        </span>
      </div>
    </div>
  );
}
