import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CausalResult, Strategy } from "@/lib/sim/types";
import { STRATEGY_META } from "@/lib/sim/scenario";

type Metric = "cost" | "lockIn" | "reputation";

interface Props {
  results: CausalResult[];
  active: Strategy[];
  metric: Metric;
  format: (v: number) => string;
}

export function BandChart({ results, active, metric, format }: Props) {
  const months = results[0]?.[metric].length ?? 0;
  const data = Array.from({ length: months }, (_, i) => {
    const row: Record<string, number | number[]> = { month: i + 1 };
    for (const r of results) {
      const b = r[metric][i];
      row[`${r.strategy}_p50`] = b.p50;
      row[`${r.strategy}_band`] = [b.p10, b.p90];
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          label={{
            value: "month",
            position: "insideBottomRight",
            offset: -2,
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => format(v as number)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value, name) => {
            if (typeof name === "string" && name.endsWith("_band")) return [];
            const strat = String(name).replace("_p50", "") as Strategy;
            return [format(value as number), STRATEGY_META[strat]?.label ?? name];
          }}
          labelFormatter={(l) => `Month ${l}`}
        />
        {active.map((s) => (
          <Area
            key={`${s}_band`}
            dataKey={`${s}_band`}
            stroke="none"
            fill={`var(--${STRATEGY_META[s].token})`}
            fillOpacity={0.12}
            isAnimationActive={false}
            legendType="none"
            activeDot={false}
          />
        ))}
        {active.map((s) => (
          <Line
            key={`${s}_p50`}
            dataKey={`${s}_p50`}
            stroke={`var(--${STRATEGY_META[s].token})`}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
