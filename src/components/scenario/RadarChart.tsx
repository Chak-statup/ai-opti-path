// Hand-rolled SVG radar / spider chart. Matches the consulting chart style:
// thin axes, subtle rings, muted fills. Values are 0..100 per axis.

export interface RadarSeries {
  label: string;
  color: string;
  values: number[]; // one per axis, 0..100
  dashed?: boolean;
  fill?: boolean;
}

export function RadarChart({
  axes,
  series,
  size = 380,
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 56;
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
        const p = point(i, 118);
        const a = angle(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return (
          <text key={label} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="central" className="radar-axis-label" fill="var(--exp-muted)">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
