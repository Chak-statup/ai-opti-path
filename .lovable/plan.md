## Goal

Add one new tab to the Scenario Evaluator that clearly explains how the underlying model works — its purpose, the equations, every parameter, and the key findings — sourced directly from the uploaded model card ("A Driven Dynamical Model of AI Product Economics"). This makes the demo self-explanatory for executives.

## Where it goes

Add a new stage to the existing 5-step journey in `src/routes/evaluator.tsx`, placed first so it reads as the primer:

```text
01 How it works · 02 Problem · 03 Causal pathway · 04 Risk profile · 05 Tipping points · 06 Recommendation
```

(Renumbering the existing `step` strings 01→06.) The new stage shows a full-width explainer panel with no control rail — same layout treatment as the Problem and Recommendation stages.

## Content (from the model card)

A new component `src/components/scenario/HowItWorks.tsx` with clean, restrained sections matching the consulting aesthetic:

1. **What the model is for** — one compact paragraph: a driven dynamical model of how one strategic choice (quality Q) drives users and profit over time; one state variable N(t); quality is a chosen input, not solved for; produces legible curves, not emergent chaos. Strategy reduces to a single number Q (Strategy 1 ≈ 0.3, Strategy 2 ≈ 0.6, Strategy 3 ≈ 0.9).

2. **The equations** — three rendered LaTeX blocks with a plain-language caption under each:
   - User dynamics dN (external acquisition + word-of-mouth − churn − competition + demand noise).
   - Quality maps: churn cliff χ(Q) and linear margin m(Q).
   - Profit Π(t): gated, shock-hit margin − cost to replace lost users − fixed overhead. Note cumulative profit = time-integral (trapezoidal).
   - Short note on where the price shock acts (a token-price spike hits margin, not the CAC line).

3. **Parameters** — a clean table (Symbol · Meaning · Value) for all rows in the model card: N(t), Q, K=100,000, p=0.01/mo, r=0.35/mo, χmin/χmax=0.02/0.35, κ=12, Q*=0.5, m0/Δm=$8/$6, Δm_shock=$4, φ=0.35, σ=0.12, c_ac=$15, F=$30,000, τ=6mo, t_shock=16mo, T=54mo. App-facing labels noted where relevant (Q = "Strategy", Δm = "Margin per customer", Q* = "Quality threshold").

4. **What drives winners and losers** — short list: strategy levers (Q, Q*) vs. calibration parameters (φ, c_ac, F, churn-cliff shape, Δm); the rest is background.

5. **Key findings** — the four results: users rise/peak/decline; low-quality apps can lose money; a critical churn threshold turns profit negative; quality pays mainly through retention, not price.

6. **This is illustrative** — one-line honesty note: plausible placeholder parameters, not calibrated; meant for strategy discussion.

## LaTeX rendering

KaTeX is already installed (`katex` dependency) and its CSS is already linked in `src/routes/__root.tsx`. Add a tiny helper `src/components/scenario/Tex.tsx` that calls `katex.renderToString(...)` and injects via `dangerouslySetInnerHTML`, supporting inline and block (display) mode. Used for the equation blocks and inline symbols so all math uses real LaTeX (consistent with the existing preference).

## Styling

Add scoped styles to `src/styles.css` under the `exp-` namespace (e.g. `exp-howto`, `exp-howto-eq`, `exp-param-table`) reusing existing tokens — muted text, thin rules, high data-ink, no cards/gradients. Equation blocks centered on a faint surface; parameter table with light row separators.

## Files

- `src/routes/evaluator.tsx` — add `howto` stage to `STAGES`, render `HowItWorks` for that stage, default the journey to it, renumber steps.
- `src/components/scenario/HowItWorks.tsx` — new explainer component.
- `src/components/scenario/Tex.tsx` — new KaTeX render helper.
- `src/styles.css` — styles for the new sections.

No business-logic or model changes — this is a presentation/explainer addition only.
