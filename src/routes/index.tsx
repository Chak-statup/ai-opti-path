import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LineChart, ShieldCheck, Coins, GitBranch } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { PRESETS } from "@/lib/sim/strategy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Strategy Tool — What should your AI strategy be?" },
      {
        name: "description",
        content:
          "Simulate the total cost-to-company of five AI strategies over 18 months under a token-price shock, quality-driven churn, and revenue latency.",
      },
      { property: "og:title", content: "AI Strategy Tool" },
      {
        property: "og:description",
        content:
          "A decision-intelligence demo: grounded pricing, Monte-Carlo simulation, and a clear answer to how aggressively to scale AI.",
      },
    ],
  }),
  component: Index,
});

const CARDS = [
  {
    icon: Coins,
    tone: "cost",
    title: "Grounded pricing",
    desc: "Per-app cost is drawn from a distribution anchored to real ranges — frontier API, hybrid routing, and self-hosted open-source.",
  },
  {
    icon: ShieldCheck,
    tone: "risk",
    title: "External shocks",
    desc: "A token-price spike at month 9 drives cost up. How hard it hits depends on how exposed each strategy is.",
  },
  {
    icon: GitBranch,
    tone: "quality",
    title: "Quality & churn",
    desc: "Open-source trails frontier on reasoning. Low quality trips a churn step-function that bleeds active users.",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5">
        {/* Hero */}
        <section className="pt-16 pb-10 sm:pt-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-quality" />
              Decision intelligence · Scenario simulation
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              What should your <span className="text-primary">AI strategy</span> be?
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              A corporation must decide how aggressively to scale AI over the next 18
              months. This tool simulates the total cost-to-company of five strategies —
              from all-in frontier to fully sovereign open-source — under a realistic
              token-price shock, quality trade-offs, and revenue latency.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/simulator"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Run the simulation <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* What's modeled */}
        <section id="how" className="grid gap-4 py-6 md:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-5">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ background: `var(--${c.tone})` }}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </section>

        {/* Strategy index cards */}
        <section className="py-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Five strategies, one scenario
          </h2>
          <p className="mt-1 text-muted-foreground">
            Two extremes and three blends — all compared on the same shock and distributions.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((p) => (
              <Link
                key={p.id}
                to="/simulator"
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderTopColor: `var(--${p.tone})`, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: `var(--${p.tone})` }} />
                  <h3 className="font-display text-base font-semibold">{p.label}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Simulate
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
            <Link
              to="/simulator"
              className="group flex flex-col items-start justify-center rounded-2xl border border-dashed border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <LineChart className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold">Compare all five</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                See the full simulation and the verdict.
              </p>
            </Link>
          </div>
        </section>

        <footer className="border-t border-border py-8 text-sm text-muted-foreground">
          Illustrative demo · models are grounded but use demo-default parameters. Built local-first.
        </footer>
      </main>
    </div>
  );
}
