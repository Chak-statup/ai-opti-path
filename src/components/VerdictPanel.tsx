import type { CausalResult } from "@/lib/sim/types";
import { STRATEGY_META } from "@/lib/sim/scenario";
import { Compass } from "lucide-react";

export function VerdictPanel({ results }: { results: CausalResult[] }) {
  const ranked = [...results].sort(
    (a, b) => b.summary.resilience - a.summary.resilience,
  );
  const best = ranked[0];

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-hybrid-soft/60 to-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hybrid text-white">
          <Compass className="h-4 w-4" />
        </span>
        <h3 className="font-display text-lg font-semibold">Strategic read</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Under the current scenario, the{" "}
        <span className="font-semibold text-foreground">
          {STRATEGY_META[best.summary.strategy].label}
        </span>{" "}
        path scores highest on resilience (
        {Math.round(best.summary.resilience * 100)}). The recommendation is rarely
        “choose one forever” — it is a{" "}
        <span className="font-semibold text-foreground">
          staged hybrid strategy that preserves optionality
        </span>
        : move fast where speed matters, and retain control where scale,
        sensitivity, or cost exposure becomes strategic.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {ranked.map((r) => (
          <div
            key={r.strategy}
            className="rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: `var(--color-${STRATEGY_META[r.strategy].token})`,
                }}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {STRATEGY_META[r.strategy].label}
              </span>
            </div>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">
              {Math.round(r.summary.resilience * 100)}
            </p>
            <p className="text-xs text-muted-foreground">resilience</p>
          </div>
        ))}
      </div>
    </div>
  );
}
