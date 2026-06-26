import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteHeader } from "@/components/SiteHeader";
import { ScenarioControls } from "@/components/ScenarioControls";
import { AgentCanvas } from "@/components/abm/AgentCanvas";
import { defaultScenario, STRATEGIES, STRATEGY_META } from "@/lib/sim/scenario";
import { initAbm, stepAbm, type AbmMetrics, type AbmState } from "@/lib/sim/abm";
import type { Scenario, Strategy } from "@/lib/sim/types";

export const Route = createFileRoute("/abm")({
  head: () => ({
    meta: [
      { title: "Agent-Based Model — AI Strategy Tool" },
      {
        name: "description",
        content:
          "Simulate AI-app adoption across a social network of teams, customers, and partners under each operating model and shock.",
      },
      { property: "og:title", content: "Agent-Based Model — AI Strategy Tool" },
      {
        property: "og:description",
        content:
          "Watch adoption spread and shocks ripple across a population of agents for Platform, Open-source, and Hybrid strategies.",
      },
    ],
  }),
  component: AbmPage,
});

function AbmPage() {
  const [scenario, setScenario] = useState<Scenario>(defaultScenario);
  const [strategy, setStrategy] = useState<Strategy>("platform");
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<AbmMetrics[]>([]);
  const stateRef = useRef<AbmState | null>(null);

  const reset = useMemo(
    () => () => {
      stateRef.current = initAbm(scenario, strategy);
      setHistory([]);
      setTick(0);
      setPlaying(false);
    },
    [scenario, strategy],
  );

  // (Re)initialize whenever scenario or strategy changes.
  useEffect(() => {
    reset();
  }, [reset]);

  const step = () => {
    const s = stateRef.current;
    if (!s || s.month >= scenario.horizonMonths) {
      setPlaying(false);
      return;
    }
    stepAbm(s);
    setHistory([...s.history]);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.month >= scenario.horizonMonths) {
        setPlaying(false);
        return;
      }
      stepAbm(s);
      setHistory([...s.history]);
      setTick((t) => t + 1);
    }, 360);
    return () => clearInterval(id);
  }, [playing, scenario.horizonMonths]);

  const latest = history[history.length - 1];
  const agents = stateRef.current?.agents ?? [];
  const done = (stateRef.current?.month ?? 0) >= scenario.horizonMonths;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Agent-based model
          </h1>
          <p className="mt-2 text-muted-foreground">
            360 agents — internal teams, customers, and partners — connected in a
            social network. Each month they adopt or abandon AI apps based on
            quality, price, reputation, and peer influence.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
            <div className="mb-5">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Operating model
              </h3>
              <div className="mt-3 grid gap-2">
                {STRATEGIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategy(s)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                      strategy === s
                        ? "border-transparent bg-secondary"
                        : "border-border hover:bg-secondary/60"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: `var(--color-${STRATEGY_META[s].token})` }}
                    />
                    {STRATEGY_META[s].label}
                  </button>
                ))}
              </div>
            </div>
            <ScenarioControls scenario={scenario} onChange={setScenario} />
          </aside>

          <div className="space-y-6">
            {/* Controls + canvas */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    disabled={done}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? "Pause" : "Play"}
                  </button>
                  <button
                    onClick={step}
                    disabled={playing || done}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    <SkipForward className="h-4 w-4" /> Step
                  </button>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset
                  </button>
                </div>
                <span className="font-display text-sm font-semibold tabular-nums text-muted-foreground">
                  Month {stateRef.current?.month ?? 0} / {scenario.horizonMonths}
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-[1fr_220px]">
                <AgentCanvas agents={agents} tick={tick} />
                <div className="space-y-3">
                  <Kpi label="Adopted" value={latest?.adopted ?? 0} token="quality" />
                  <Kpi label="At risk" value={latest?.atRisk ?? 0} token="cost" />
                  <Kpi label="Churned" value={latest?.churned ?? 0} token="risk" />
                  <Kpi
                    label="Reputation"
                    value={Math.round((latest?.reputation ?? 1) * 100)}
                    token="platform"
                  />
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Legend</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <Legend token="quality" label="Adopted" />
                      <Legend token="cost" label="Adopted · at risk" />
                      <Legend token="risk" label="Churned" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Adoption over time */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display text-base font-semibold">
                Adoption &amp; churn over time
              </h3>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "var(--color-popover-foreground)",
                      }}
                      labelFormatter={(l) => `Month ${l}`}
                    />
                    <Line dataKey="adopted" name="Adopted" stroke="var(--color-quality)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    <Line dataKey="atRisk" name="At risk" stroke="var(--color-cost)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line dataKey="churned" name="Churned" stroke="var(--color-risk)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {STRATEGY_META[strategy].label} · enable shocks in the panel and
                replay to see how this population absorbs them.
              </p>
            </div>

            <AbmModelSpec />
          </div>
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, token }: { label: string; value: number; token: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: `var(--color-${token})` }} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Legend({ token, label }: { token: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--color-${token})` }} />
      {label}
    </div>
  );
}
