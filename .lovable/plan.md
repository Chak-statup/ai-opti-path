# Evaluator → Guided Decision Journey

Fold the useful ideas from the reference console into our existing light-themed Evaluator. Same palette, English, no dark German chrome. The interactive causal pathway stays the centerpiece; everything new explains *why* the numbers move using plain-language causality tied to the live parameters.

## The journey (step nav replaces the two-tab bar)

```
01 Problem    02 Causal pathway    03 Risk profile    04 Tipping points    05 Recommendation
```

- **01 Problem** — short framing: the strategic question and the core insight from the brief — "margin per user is not real; it's an output of margin and users, and margin depends on the vendor's pricing policy." Three strategy cards (Strategy 1/2/3) with their quality level Q and one-line stance. Sets context before any chart.
- **02 Causal pathway** — the current interactive diagram, unchanged, now with a **scenario preset bar** above it (see below) and a plain-language "reading" sentence under it that updates live.
- **03 Risk profile** — the **spider/radar chart** the brief asks for: each strategy's parameters collapse into one five-axis fingerprint, drawn against a dashed Status-Quo baseline.
- **04 Tipping points** — threshold cards: each risk vs its critical line with a marker and a "what happens past here" sentence.
- **05 Recommendation** — a generated-looking advisory (demo, no AI backend) that reads the live state and writes a structured recommendation.

The two existing chart views (Trajectories, Strategy sweep) move into a secondary toggle inside step 02 so nothing is lost.

## New concepts mapped to our real model

Everything is derived from the same arithmetic already in `model.ts` (no fake numbers), plus two scenario-context knobs that ground the "what could change" question:

- **Token price factor** (1×–4×) — multiplies the cost coefficient. This is the "Anthropic doubles token prices" lever.
- **Regulatory pressure** (0–100) — adds fixed cost and dampens innovation.

These sit alongside the existing two levers (Margin per customer, Quality threshold).

### Risk radar (5 axes, 0–100, computed live)
- **Cost** — cost-to-margin ratio over the horizon (token price factor drives this).
- **Lock-in** — rises with quality level Q (frontier strategy = deepest dependency) and token exposure.
- **Regulatory** — from regulatory-pressure knob.
- **Innovation** — capacity left after churn + compliance load (higher = better).
- **Resilience** — buffer between cumulative profit and zero under the current shock.

Each strategy renders as a filled polygon; Status Quo is a dashed grey reference so executives always see "vs baseline."

### Scenario presets (one click sets the knobs)
- **Status Quo** — today's prices, moderate everything.
- **Pricing shock** — token price 3×.
- **Regulatory stress test** — regulatory pressure high.
- **Open-source breakthrough** — token price down, margin up.

Selecting a preset animates the causal pathway and radar so the change is visible.

### Tipping-point thresholds
Four cards, each: current value, critical threshold, a marker bar, and a plain-language rule:
- **Token cost risk** — "Past here, token cost exceeds product margin: scaling turns every new user into a loss."
- **Vendor lock-in** — "Past here, switching costs exceed the migration benefit; price negotiations lose their basis."
- **Regulatory load** — "Past here, compliance consumes most of the AI build capacity."
- **Innovation erosion** — "Below here, competitors build a structural lead within a year."
A small banner sums up "N of 4 thresholds crossed."

### Recommendation (demo, rule-based — no backend)
A deterministic function reads the live risk scores + tipping points and assembles a structured, advisory-styled output: the recommended strategy, the top two risks driving it, and the one change that would flip the decision. Presented as a clean exhibit (not a chat box). Labeled "Illustrative — generated from the model state," so it reads as a demo without claiming a live AI.

## Explainability approach (plain-language causality)
Every step carries a "because X → then Y" line built from live values, e.g.:
- Pathway: "Token price at 3× pushes cost above margin around step 38, so cumulative profit for Strategy 3 turns negative."
- Radar: "Strategy 1's lock-in is low because it commits to no single vendor, but its innovation lags."
- Tipping point: shows the exact parameter that moved the value across the line.

## Technical notes
- `src/lib/scenario/model.ts`: add `tokenPriceFactor` + `regPressure` to the cost/competition arithmetic; add `deriveRiskScores()` (5 axes) and `deriveTippingPoints()` returning values, thresholds, crossed-state, and explanation strings. All pure functions over the existing precomputed runs.
- New components under `src/components/scenario/`: `RadarChart.tsx` (hand-rolled SVG, matching LineChart style), `ScenarioPresets.tsx`, `TippingPoints.tsx`, `Recommendation.tsx`, `ProblemFrame.tsx`.
- `src/routes/evaluator.tsx`: replace the tab bar with the 5-step journey nav; keep shared lever rail; route each step to its panel. Reuse existing tokens/classes; add minimal CSS for radar, threshold bars, and the advisory card.
- Drop the now-unused `UncertaintyView`/old static causal pieces to avoid clutter.
- No new dependencies; no backend. Self-explanatory and English throughout.
