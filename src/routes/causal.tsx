import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ScenarioControls } from "@/components/ScenarioControls";
import { BandChart } from "@/components/charts/BandChart";
import { CausalLoopDiagram } from "@/components/CausalLoopDiagram";
import { VerdictPanel } from "@/components/VerdictPanel";
import { ModelSpec } from "@/components/ModelSpec";
import { defaultScenario, STRATEGIES, STRATEGY_META } from "@/lib/sim/scenario";
import { simulateAllCausal } from "@/lib/sim/causal";
import type { Scenario, Strategy } from "@/lib/sim/types";

export const Route = createFileRoute("/causal")({
  head: () => ({
    meta: [
      { title: "Causal & Bayesian Model — AI Strategy Tool" },
      {
        name: "description",
        content:
          "System-dynamics + Bayesian Monte-Carlo projection of cost, vendor lock-in, and reputation across AI operating models.",
      },
      { property: "og:title", content: "Causal & Bayesian Model — AI Strategy Tool" },
      {
        property: "og:description",
        content:
          "Project cost, lock-in, and reputation with credible bands across Platform, Open-source, and Hybrid strategies.",
      },
    ],
  }),
  component: CausalPage,
});

type Metric = "cost" | "lockIn" | "reputation";

const METRICS: { key: Metric; label: string; format: (v: number) => string }[] = [
  { key: "cost", label: "Monthly AI spend", format: (v) => `$${v.toFixed(1)}M` },
  { key: "lockIn", label: "Vendor lock-in", format: (v) => `${Math.round(v * 100)}` },
  { key: "reputation", label: "Reputation", format: (v) => `${Math.round(v * 100)}` },
];

function CausalPage() {
  const [scenario, setScenario] = useState<Scenario>(defaultScenario);
  const [active, setActive] = useState<Strategy[]>([...STRATEGIES]);
  const [metric, setMetric] = useState<Metric>("cost");

  const results = useMemo(() => simulateAllCausal(scenario), [scenario]);
  const shown = results.filter((r) => active.includes(r.strategy));
  const fmt = METRICS.find((m) => m.key === metric)!.format;

  const toggle = (s: Strategy) =>
    setActive((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Causal &amp; Bayesian model
          </h1>
          <p className="mt-2 text-muted-foreground">
            A stock-and-flow system-dynamics model with Bayesian uncertainty.
            Shaded bands are 10–90% Monte-Carlo credible intervals across 240
            runs; lines are the median path.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Controls */}
          <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
            <ScenarioControls scenario={scenario} onChange={setScenario} />
          </aside>

          {/* Results */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMetric(m.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        metric === m.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-opacity ${
                        active.includes(s)
                          ? "border-border"
                          : "border-transparent opacity-40"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: `var(--${STRATEGY_META[s].token})` }}
                      />
                      {STRATEGY_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                {shown.length > 0 ? (
                  <BandChart results={shown} active={active} metric={metric} format={fmt} />
                ) : (
                  <p className="py-20 text-center text-sm text-muted-foreground">
                    Select at least one strategy.
                  </p>
                )}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {results.map((r) => (
                <div key={r.strategy} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: `var(--${STRATEGY_META[r.strategy].token})` }}
                    />
                    <h3 className="text-sm font-semibold">
                      {STRATEGY_META[r.strategy].label}
                    </h3>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <Row label="18-mo spend" value={`$${r.summary.finalCost.toFixed(1)}M`} />
                    <Row label="Lock-in" value={`${Math.round(r.summary.lockIn * 100)}`} />
                    <Row label="Reputation" value={`${Math.round(r.summary.reputation * 100)}`} />
                    <Row label="Resilience" value={`${Math.round(r.summary.resilience * 100)}`} />
                  </dl>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <CausalLoopDiagram />
              <VerdictPanel results={results} />
            </div>

            <ModelSpec />
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-display font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
