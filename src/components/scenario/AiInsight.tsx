// AI-based insight (demo). The user's API key is used ONLY in the browser:
// it is held in local component state, sent directly to Anthropic over HTTPS,
// and never persisted (no localStorage / cookies), never logged, and never
// sent to our own servers. Closing or reloading the page discards it.
import { useState } from "react";
import type { RiskScores, ScenarioContext, StrategyDerived } from "@/lib/scenario/model";

const RISK_LABEL: Record<string, string> = {
  cost: "token cost exposure",
  lockin: "vendor lock-in",
  regulatory: "regulatory load",
};

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
    return `- ${d.label}: cumulative profit $${d.cumProfit.toFixed(0)}M; risks → cost ${Math.round(
      r.cost,
    )}/100, lock-in ${Math.round(r.lockin)}/100, regulatory ${Math.round(r.regulatory)}/100`;
  });
  return [
    "You are a sober strategy advisor briefing a corporate executive on how aggressively to scale an AI product over the next 12-18 months.",
    "The candidate strategies differ in product quality (a single quality knob). Internal levers the company controls are the strategy vector: quality, quality threshold, margin per customer, innovation orientation and resilience orientation. External factors it does not control are vendor token price and regulatory pressure. Regulatory pressure feeds through into the effective token price (compliance overhead the vendor passes on).",
    "",
    "Current scenario assumptions (external):",
    `- Token price factor (vs. today): ${ctx.tokenPriceFactor}x`,
    `- Regulatory pressure: ${ctx.regPressure}/100 (raises the effective token price)`,
    "",
    "Model output for each strategy:",
    ...lines,
    "",
    `The model currently favours "${derived[best].label}" on cumulative profit.`,
    "",
    "Write a crisp executive briefing (max ~180 words). Be direct, no marketing language, no headings.",
    "Cover: (1) which path you recommend and why, (2) the single biggest risk and what would flip the decision, (3) a concrete adjustment to the strategy vector (innovation / resilience) to mitigate the dominant external risk.",
    "Emphasise that 'margin per user' is an output of cost and user dynamics, not a real lever.",
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
          model: "claude-3-5-sonnet-latest",
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
        <span className="exp-ai-tag">Demo — uses your own key</span>
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
            {loading ? "Generating…" : "Generate insight"}
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
