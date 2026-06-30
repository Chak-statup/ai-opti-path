# Connect controls to the four decision axes

## Goal
Make every lever map cleanly to one of the four decision axes a C-level exec already saw in Problem 01, so the strategy vector, spider chart, and causal pathway all speak the same language.

## The mapping (decision axis → lever → model effect)

| # | Decision axis | Slider label (new) | Model wiring (mostly existing) |
|---|---|---|---|
| 01 | Platform Ecosystem | **Platform reach** (contained pilots ↔ mass-market apps) | NEW: scales the user base N (upside + token-cost exposure both grow) |
| 02 | Vendor Choice | **Vendor independence** (single frontier vendor ↔ open / multi-vendor) | = existing Resilience: shields token-price spike, lowers lock-in |
| 03 | Build vs Buy | **In-house build** (API-first ↔ in-house) | = existing Innovation: lowers churn, lifts margin, raises fixed cost |
| 04 | Scaling Strategy | **Scaling aggressiveness** (cautious ↔ aggressive) | = existing Δm (margin push) + Q* (quality bar committed to) |

Environment stays separate and unchanged: **Token price factor** and **Regulatory pressure** (external, "you don't control").

## What changes in the model (`src/lib/scenario/model.ts`)
- Rename `innovation` → keep math, surfaced as **In-house build (Build vs Buy)**.
- Rename `resilience` → keep math, surfaced as **Vendor independence (Vendor Choice)**.
- Couple `Δm` and `Q*` under one **Scaling aggressiveness** axis (one slider drives both; existing equations untouched).
- Add a single new `platformReach` input (0–100) that multiplies the user base N (e.g. N scaled by 0.6×–1.4×). This is the only new coupling; churn/margin/cost/profit equations keep their shape. Bigger reach amplifies both revenue and shock exposure.
- The three **Strategy 1/2/3** options become **presets of the 4-axis vector** (three shapes on the spider), with their quality Q derived from the axis vector. The discrete selector stays for comparison.

## What changes in the UI
- **Control rail** (`src/routes/evaluator.tsx`): regroup the internal levers into the four numbered axes (01–04) with the new labels above, each keeping its 1–2 line definition tied to the model. Environment group unchanged.
- **Spider/Radar chart** (`RadarChart.tsx`): plot the four decision axes (one strategy = one shape), reinforcing "four choices → one strategy."
- **Causal pathway** (`CausalDiagram.tsx`): tag the lever nodes with their axis number/name (01–04) and group/color them so the exec can trace each decision axis → churn/margin/cost → users → profit. Labels stay LaTeX/SVG-native per the existing mobile-safe approach.
- **Problem frame** (`ProblemFrame.tsx`): on each of the four axis cards, add a "controlled by → <slider>" line so Problem 01 and the evaluator are explicitly linked.

## Dynamics impact summary
- Axes 02, 03, 04: pure relabel/recombination — identical math, identical trajectories.
- Axis 01 (Platform reach): one new multiplier on N — changes magnitude, not the shape of any curve. Honest and executive-intuitive (scale cuts both ways).
- Charts (Revenue/Users/Margin/Cost/Strategy) and presets continue to work; only labels and the N-scaling differ.

## Open choice
If you'd rather not touch dynamics at all, we drop Axis 01's N-scaling and show Platform Ecosystem as a framing-only axis (3 live sliders + 1 displayed). Default plan assumes the live version.
