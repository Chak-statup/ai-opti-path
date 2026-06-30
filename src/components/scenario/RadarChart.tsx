// Hand-rolled SVG radar / spider chart. Matches the consulting chart style:
// thin axes, subtle rings, muted fills. Values are 0..100 per axis.
// Axis labels wrap onto multiple lines so long labels never clip, and the
// chart reserves a generous label margin so it scales cleanly at any size.

export interface RadarSeries {
  label: string;
  color: string;
  values: number[]; // one per axis, 0..100
  dashed?: boolean;
  fill?: boolean;
}

// Break a label into <=2 short lines for tidy multi-word axis captions.
function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  if (words.length < 2) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function RadarChart({
  axes,
  series,
  size = 460,
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  // Reserve a wide margin for the wrapped axis labels around the rim.
  const radius = size / 2 - 92;
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(100, v)) / 100) * radius;
    return { x: cx + Math.cos(angle(i)) * r, y: cy + Math.sin(angle(i)) * r };
  };

  const rings = [25, 50, 75, 100];

  const polyPoints = (vals: number[]) =>
    vals.map((v, i) => { const p = point(i, v); return `${p.x},${p.y}`; }).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label="Risk radar">
      {/* rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={axes.map((_, i) => { const p = point(i, r); return `${p.x},${p.y}`; }).join(" ")}
          fill="none"
          stroke="var(--exp-grid)"
          strokeWidth={1}
        />
      ))}
      {/* spokes */}
      {axes.map((_, i) => {
        const p = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--exp-grid)" strokeWidth={1} />;
      })}
      {/* series */}
      {series.map((s) => (
        <polygon
          key={s.label}
          points={polyPoints(s.values)}
          fill={s.fill === false ? "none" : s.color}
          fillOpacity={s.fill === false ? 0 : 0.14}
          stroke={s.color}
          strokeWidth={2}
          strokeDasharray={s.dashed ? "5 4" : undefined}
        />
      ))}
      {/* axis labels */}
      {axes.map((label, i) => {
        const a = angle(i);
        // Place labels just outside the outermost ring.
        const r = radius + 22;
        const lx = cx + Math.cos(a) * r;
        const ly = cy + Math.sin(a) * r;
        const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const lines = wrapLabel(label);
        const dyStart = -((lines.length - 1) * 7);
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="central"
            className="radar-axis-label"
            fill="var(--exp-muted)"
          >
            {lines.map((ln, li) => (
              <tspan key={li} x={lx} dy={li === 0 ? dyStart : 14}>
                {ln}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
