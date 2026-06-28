import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteHeader } from "@/components/SiteHeader";
import {
  PRESETS,
  VARIABLE_DOCS,
  fmtMoney,
  simulate,
  type SimResult,
} from "@/lib/sim/strategy";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Strategy Simulator — AI Strategy Tool" },
      {
        name: "description",
        content:
          "Simulate total cost-to-company across five AI strategies under a token-price shock, quality-driven churn, and revenue latency.",
      },
      { property: "og:title", content: "Strategy Simulator — AI Strategy Tool" },
      {
        property: "og:description",
        content:
          "What should your AI strategy be? Compare five strategies on net value over 18 months with grounded pricing.",
      },
    ],
  }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const results = useMemo<SimResult[]>(
    () => PRESETS.map((p) => simulate(p)),
    [],
  );

  // Merge median cumulative-net curves into one chart dataset.
  const chartData = useMemo(() => {
    const horizon = results[0]?.config.horizonMonths ?? 18;
    const rows: Record<string, number>[] = [];
    for (let t = 0; t < horizon; t++) {
      const row: Record<string, number> = { month: t + 1 };
      for (const res of results) row[res.config.id] = Math.round(res.cumulativeNet[t].p50);
      rows.push(row);
    }
    return rows;
  }, [results]);

  const ranked = useMemo(
    () => [...results].sort((a, b) => b.summary.netP50 - a.summary.netP50),
    [results],
  );
  const winner = ranked[0];
  const shockMonth = results[0]?.config.shockMonth ?? 9;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-5 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            What should your AI strategy be?
          </h1>
          <p className="mt-3 text-muted-foreground">
            One scenario, five strategies. Each runs {results[0]?.config.nApps ?? "n"}-ish
            apps for {results[0]?.config.users.toLocaleString()} users over 18 months.
            A token-price shock lands at month {shockMonth}. We Monte-Carlo the cost,
            quality, and churn distributions and chart the cumulative net value to the company.
          </p>
        </div>

        {/* Verdict */}
        {winner && (
          <div
            className="mt-6 rounded-2xl border border-border bg-card p-5"
            style={{ borderLeftColor: `var(--${winner.summary.tone})`, borderLeftWidth: 4 }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Strongest expected outcome
            </p>
            <p className="mt-1 font-display text-xl font-semibold">
              {winner.summary.label} ·{" "}
              <span style={{ color: `var(--${winner.summary.tone})` }}>
                {fmtMoney(winner.summary.netP50)}
              </span>{" "}
              median net value
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Range {fmtMoney(winner.summary.netP10)} to {fmtMoney(winner.summary.netP90)} across
              uncertainty. Resilience to the price shock and quality-driven churn is what
              separates the strategies — not headline cost.
            </p>
          </div>
        )}

        {/* Chart */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold">
            Cumulative net value (median)
          </h2>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  label={{ value: "Month", position: "insideBottom", offset: -2, fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => fmtMoney(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(value: number, name: string) => [
                    fmtMoney(value),
                    PRESETS.find((p) => p.id === name)?.label ?? name,
                  ]}
                  labelFormatter={(l) => `Month ${l}`}
                />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <ReferenceLine
                  x={shockMonth}
                  stroke="var(--risk)"
                  strokeDasharray="4 4"
                  label={{ value: "price shock", fontSize: 11, fill: "var(--risk)", position: "top" }}
                />
                {PRESETS.map((p) => (
                  <Line
                    key={p.id}
                    dataKey={p.id}
                    stroke={`var(--${p.tone})`}
                    strokeWidth={p.id === winner?.summary.id ? 3 : 1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {PRESETS.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--${p.tone})` }} />
                {p.label}
              </span>
            ))}
          </div>
        </section>

        {/* Strategy cards */}
        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ranked.map((res, i) => (
            <div
              key={res.config.id}
              className="rounded-2xl border border-border bg-card p-5"
              style={{ borderTopColor: `var(--${res.summary.tone})`, borderTopWidth: 3 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">{res.summary.label}</h3>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  #{i + 1}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{res.config.blurb}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Median net" value={fmtMoney(res.summary.netP50)} accent={res.summary.tone} />
                <Stat
                  label="Breakeven"
                  value={res.summary.breakevenMonth ? `Mo ${res.summary.breakevenMonth}` : "—"}
                />
                <Stat label="Total cost" value={fmtMoney(res.summary.totalCost)} />
                <Stat label="Total revenue" value={fmtMoney(res.summary.totalRevenue)} />
                <Stat label="Avg quality" value={`${Math.round(res.summary.avgQuality * 100)}%`} />
                <Stat label="Apps at churn risk" value={`${Math.round(res.summary.churnShare * 100)}%`} />
              </dl>
            </div>
          ))}
        </section>

        {/* Variable documentation */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            The model, variable by variable
          </h2>
          <p className="mt-1 text-muted-foreground">
            Every input, its postulated effect, and the distribution it's drawn from.
            The simulation is pure math over these — directly portable to a FastAPI backend.
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Variable</th>
                  <th className="px-4 py-3 font-semibold">Effect</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {VARIABLE_DOCS.map((v) => (
                  <tr key={v.symbol} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <span className="font-display font-semibold">{v.symbol}</span>
                      <span className="block text-xs text-muted-foreground">{v.name}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{v.effect}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {v.distribution}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Net value each month = Σ apps [ active users × revenue × quality × ramp ] − Σ apps [ users
            × cost × price-shock ]. Active users = users × (1 − churn). Pricing anchored to real
            ranges: frontier API ≈ $0.70–0.90, hybrid ≈ $0.40–0.55, self-hosted ≈ $0.15–0.25 per user
            per app per month.
          </p>
        </section>

        <footer className="mt-10 border-t border-border py-8 text-sm text-muted-foreground">
          Illustrative demo · seeded Monte-Carlo (240 runs) · built local-first for a FastAPI port.
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className="font-display text-lg font-semibold tabular-nums"
        style={accent ? { color: `var(--${accent})` } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
