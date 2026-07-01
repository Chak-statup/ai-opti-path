// Demo recommendation — rule-based, no AI backend. Reads the live model
// state and assembles an advisory-styled exhibit. Labeled illustrative.
import type { RiskScores, ScenarioContext, StrategyDerived } from "@/lib/scenario/model";

const RISK_LABEL: Record<string, string> = {
  cost: "cost exposure",
  lockin: "vendor lock-in",
  capability: "capability gap",
  scaling: "scaling risk",
  regulatory: "regulatory load",
};

function fmt(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}€${Math.abs(v).toFixed(0)}M`;
}

export function Recommendation({
  derived,
  riskAll,
  ctx,
  stratColors,
}: {
  derived: StrategyDerived[];
  riskAll: RiskScores[];
  ctx: ScenarioContext;
  stratColors: string[];
}) {
  let best = 0;
  derived.forEach((d, i) => {
    if (d.cumProfit > derived[best].cumProfit) best = i;
  });
  const bestRisks = riskAll[best];
  const ranked = (["cost", "lockin", "capability", "scaling", "regulatory"] as const)
    .map((k) => ({ k, v: bestRisks[k] }))
    .sort((a, b) => b.v - a.v);
  const topRisks = ranked.slice(0, 2);

  const flip =
    ctx.tokenPriceFactor >= 2.5
      ? "If serving prices return to today's level, the higher-quality strategy regains the lead — most of the gap here is the vendor's pricing, not the product."
      : ctx.regPressure >= 70
        ? "If regulatory load eases, the build-heavy strategy pays off faster — compliance is currently the binding constraint."
        : "If the vendor doubles serving prices, the ranking shifts toward the lower-exposure, more vendor-independent strategy.";

  return (
    <div className="exp-rec">
      <div className="exp-rec-tag">Illustrative, generated from the model state</div>

      <div className="exp-rec-headline">
        <span>Recommended path</span>
        <strong style={{ color: stratColors[best] }}>{derived[best].label}</strong>
        <span className="exp-rec-profit" style={{ color: stratColors[best] }}>
          {fmt(derived[best].cumProfit)} cumulative
        </span>
      </div>

      <p className="exp-rec-lead">
        Under the current scenario, {derived[best].label} delivers the strongest cumulative
        result. The decision is driven less by a single &ldquo;margin per user&rdquo; figure than by
        how cost and dependency evolve as you scale.
      </p>

      <div className="exp-rec-block">
        <div className="exp-rec-block-title">What drives this</div>
        <ul className="exp-rec-list">
          {topRisks.map((r, i) => (
            <li key={r.k}>
              <strong>{RISK_LABEL[r.k]}</strong> sits at {Math.round(r.v)}/100,{" "}
              {i === 0 ? "the dominant pressure on this path" : "the next risk to watch"}.
            </li>
          ))}
        </ul>

      </div>

      <div className="exp-rec-block">
        <div className="exp-rec-block-title">What would change the decision</div>
        <p className="exp-rec-flip">{flip}</p>
      </div>
    </div>
  );
}
