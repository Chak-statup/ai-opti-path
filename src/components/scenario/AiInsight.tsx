// AI-based insight (demo). The user's API key is used ONLY in the browser:
// it is held in local component state, sent directly to Anthropic over HTTPS,
// and never persisted (no localStorage / cookies), never logged, and never
// sent to our own servers. Closing or reloading the page discards it.
import { useState } from "react";
import type { RiskScores, ScenarioContext, StrategyDerived } from "@/lib/scenario/model";

function buildPrompt(
  derived: StrategyDerived[],
  riskAll: RiskScores[],
  ctx: ScenarioContext,
): string {
  let best = 0;
  derived.forEach((d, i) => {
    if (d.cumProfit > derived[best].cumProfit) best = i;
  });
  const lines = derived.map((d, i) => {
    const r = riskAll[i];
    return `- ${d.label}: cumulative profit €${d.cumProfit.toFixed(0)}M over the horizon; risk axes (0-100, higher = worse) → cost exposure ${Math.round(
      r.cost,
    )}, vendor lock-in ${Math.round(r.lockin)}, capability gap ${Math.round(
      r.capability,
    )}, scaling risk ${Math.round(r.scaling)}, regulatory load ${Math.round(r.regulatory)}`;
  });
  return [
    "You are a sober strategy advisor briefing a large European insurer's executive on how aggressively to scale an AI product over a ~54-month (roughly 4.5-year) horizon. All figures are in euros.",
    "The user base is simulated (logistic growth with churn and competition). The company's decisions (the strategy vector): the product quality tier Q; a higher tier runs pricier frontier models, so it costs MORE per user to serve (Lean ×0.4, Balanced ×1.0, Premium ×1.6 of the base serving cost); scaling intensity, a single dial that couples the per-user ARPU premium (Δm) with the quality bar Q* it commits to; pushing it also raises tokens burned per user (up to +40%); in-house build, which raises the quality users actually experience (churn falls through a quality cliff at Q*) and lifts ARPU, at higher fixed cost; vendor independence, which shields serving-cost spikes and lowers lock-in; and platform reach, which sets the addressable market size.",
    "External factors it does NOT control: the vendor's token/serving price factor (the per-active-user cost of goods), and regulatory pressure; a DISTINCT force that raises fixed compliance cost and slows in-house innovation (it does not change the token price). Acquisition is paid on every gross user added (blended CAC), so growth costs real money.",
    "Note: per-user ARPU (margin) is a genuine lever set by the scaling and in-house-build decisions. The OUTPUT is profit, which depends on that ARPU, the simulated user base, serving/acquisition cost and fixed cost; and retention (churn) is the dominant channel.",
    "",
    "Current scenario assumptions (external):",
    `- Token / serving price factor (vs. today): ${ctx.tokenPriceFactor}x${
      ctx.shockMonth !== undefined
        ? `; NOT flat: price is ×1 (today's) until month ${ctx.shockMonth}, then STEPS UP to ${ctx.tokenPriceFactor}x and stays there (a mid-horizon pricing shock)`
        : ""
    }`,
    `- Regulatory pressure: ${ctx.regPressure}/100 (raises fixed compliance cost and slows innovation)`,
    ...(ctx.qualityShift
      ? [
          `- Scenario quality trade: the product runs on cheaper models, so the quality users experience is SHIFTED DOWN by ${ctx.qualityShift.toFixed(1)}; retention and ARPU take a real hit that the cheap serving must outweigh. Tiers with quality headroom absorb it; tiers near the bar Q* fall off the churn cliff.`,
        ]
      : []),
    "",
    "Model output for each strategy:",
    ...lines,
    "",
    `The model currently favours "${derived[best].label}" on cumulative profit.`,
    "",
    "Write a crisp executive briefing (max ~180 words). Be direct, no marketing language, no headings.",
    "Cover: (1) which path you recommend and why, (2) the single biggest risk (name the dominant risk axis) and what would flip the decision, (3) a concrete adjustment to the strategy vector (in-house build / vendor independence / platform reach / scaling) that reduces that dominant risk, with the mechanism.",
  ].join("\n");
}

export function AiInsight({
  derived,
  riskAll,
  ctx,
}: {
  derived: StrategyDerived[];
  riskAll: RiskScores[];
  ctx: ScenarioContext;
}) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setInsight(null);
    if (!apiKey.trim().startsWith("sk-ant-")) {
      setError("Enter a valid Anthropic API key (starts with sk-ant-).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          // Allows the key to be used directly from the browser, so it never
          // touches our backend.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 600,
          messages: [{ role: "user", content: buildPrompt(derived, riskAll, ctx) }],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${txt.slice(0, 200)}`);
      }
      const json = await res.json();
      const text = json?.content?.[0]?.text ?? "No response returned.";
      setInsight(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="exp-ai">
      <div className="exp-ai-head">
        <span className="exp-ai-title">AI-augmented advisory</span>
        <span className="exp-ai-tag">Demo, uses your own key</span>
      </div>
      <p className="exp-ai-lead">
        Generate a written advisory from the live model state using Anthropic Claude. Your key is
        used only in this browser, sent directly to Anthropic, and never stored, logged, or sent to
        our servers. It is discarded when you reload the page.
      </p>

      {!insight && (
        <div className="exp-ai-form">
          <input
            type="password"
            className="exp-ai-key"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="exp-ai-btn" onClick={generate} disabled={loading}>
            {loading ? "Generating" : "Generate insight"}
          </button>
        </div>
      )}

      {error && <div className="exp-ai-error">{error}</div>}

      {insight && (
        <div className="exp-ai-out">
          {insight.split(/\n+/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <button
            className="exp-ai-btn exp-ai-btn-ghost"
            onClick={() => {
              setInsight(null);
              setApiKey("");
            }}
          >
            Clear &amp; reset key
          </button>
        </div>
      )}
    </div>
  );
}
