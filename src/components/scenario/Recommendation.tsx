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
      ? "A sustained price at this level punishes the premium tier hardest — it serves users on the priciest frontier models. If prices return toward today's ×1, the premium tier regains the lead; raising vendor independence recovers part of it either way."
      : ctx.regPressure >= 70
        ? "Heavy regulation compresses every tier without reordering them. What it does change is the in-house-build lever: compliance eats up to 40% of delivered innovation at full load, so build pays back faster once the load eases."
        : "The lead rests on today's serving prices: if the vendor's price roughly doubles and persists, the premium tier's frontier serving cost erodes its lead, and past ~×2.5 the ranking flips to the leaner tier.";

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
