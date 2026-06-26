import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Network, Activity, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { STRATEGY_META, STRATEGIES } from "@/lib/sim/scenario";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Strategy Tool — Decision Intelligence for Scaling AI" },
      {
        name: "description",
        content:
          "Simulate how Platform-first, Open-source, and Hybrid AI operating models play out over 12–18 months under cost, lock-in, and regulatory shocks.",
      },
      { property: "og:title", content: "AI Strategy Tool" },
      {
        property: "og:description",
        content:
          "A decision-intelligence demo using causal system-dynamics and agent-based modeling to evaluate how to scale AI without locking in.",
      },
    ],
  }),
  component: Index,
});

const MODELS = [
  {
    to: "/causal",
    icon: Network,
    tone: "platform",
    title: "Causal & Bayesian model",
    desc: "Stock-and-flow system dynamics with Bayesian uncertainty. Projects cost, vendor lock-in, and reputation with Monte-Carlo credible bands.",
    points: ["Monte-Carlo confidence bands", "Causal-loop diagram", "Strategy comparison"],
  },
  {
    to: "/abm",
    icon: Activity,
    tone: "quality",
    title: "Agent-based model",
    desc: "A social network of internal teams, customers, and partners adopting and abandoning AI apps. Watch adoption spread and shocks ripple.",
    points: ["Live adoption simulation", "Network contagion", "Churn & lost revenue"],
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5">
        {/* Hero */}
        <section className="pt-16 pb-12 sm:pt-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-quality" />
              Decision intelligence · Scenario evaluation
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              How aggressively should we{" "}
              <span className="text-primary">scale AI</span> — before it becomes
              irreversible?
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Over the next 12–18 months a corporation must choose an AI operating
              model: build fast on frontier platforms, stay sovereign with
              open-source, or run a hybrid. This tool simulates each path under
              cost, lock-in, regulatory, and reputational shocks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/causal"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Explore the simulations <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#strategies"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                The three options
              </a>
            </div>
          </div>
        </section>

        {/* Strategy summary */}
        <section id="strategies" className="grid gap-4 py-6 md:grid-cols-3">
          {STRATEGIES.map((s) => {
            const m = STRATEGY_META[s];
            return (
              <div
                key={s}
                className="rounded-2xl border border-border bg-card p-5"
                style={{ borderTopColor: `var(--color-${m.token})`, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: `var(--color-${m.token})` }}
                  />
                  <h3 className="font-display text-base font-semibold">{m.label}</h3>
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {m.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {m.description}
                </p>
              </div>
            );
          })}
        </section>

        {/* Model picker cards */}
        <section className="py-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Choose a model to explore
          </h2>
          <p className="mt-1 text-muted-foreground">
            Two scientific lenses on the same strategic question — replay the same
            shocks across both.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {MODELS.map((model) => (
              <Link
                key={model.to}
                to={model.to}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ background: `var(--color-${model.tone})` }}
                >
                  <model.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">
                  {model.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {model.desc}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {model.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: `var(--color-${model.tone})` }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Open model
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-8 text-sm text-muted-foreground">
          Illustrative demo · models are scientifically grounded but use
          demo-default parameters. Built local-first.
        </footer>
      </main>
    </div>
  );
}
