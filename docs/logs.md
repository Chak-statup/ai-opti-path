# Project log & working memory

Persistent notes for the AI-strategy evaluator redesign. Read this at the start of a session before doing work. Append dated entries; keep it factual. Mark claims as `[fact]`, `[estimate]`, or `[assumption]` when it matters. Distinguish DECIDED from PENDING — do not record a proposal as a decision.

---

## How to work with this user (feedback, 2026-07-01)
- No sycophancy. Do not validate for its own sake. Agree only when it is load-bearing, and say *why* it is correct, not just *that* it is.
- Be critical and precise. Push back directly when the user is wrong or imprecise; do not absorb an error and silently reframe.
- Separate fact from estimate from assumption. Flag recalled numbers/mechanisms as unverified rather than asserting them.
- The goal is a *scientifically accurate* app. Correctness over speed, over politeness, over agreement.

## Constraints
- Read/write only within `ai-opti-path/`. This log (`docs/logs.md`) and a root `CLAUDE.md` pointer are the authorized exceptions the user granted for persistence; nothing else outside the folder (no `~/.claude` memory store, no shell config, no global settings).

---

## The app (what it is)
- TanStack Start + React (Lovable-connected; commits sync to Lovable — keep branch working, no history rewrite per `AGENTS.md`).
- An "AI strategy evaluator": a company sets a strategy vector + external environment; the app shows a causal pathway, a risk radar, tipping points, scenarios, and mitigations for scaling an AI product.
- Live model: `src/lib/scenario/model.ts`. Main page: `src/routes/evaluator.tsx`. Data: `public/runs.json`.

## Verified technical facts (audit 2026-07-01) `[fact]`
- `public/runs.json` is a real seeded Euler integration of a logistic user-growth + churn + competition ODE (`public/generate_data.py` / `standalone/backend/generate_data.py`, byte-identical output). Numbers are computed, not hardcoded.
- BUT only `Q` (strategy) and `Q*` (qstar) drive the simulated trajectory. innovation, resilience, platform reach, token price, regulation are post-hoc arithmetic on a frozen curve — they do not re-simulate growth.
- innovation's churn reduction is applied only to the cost line (`model.ts:189`), not to the user trajectory → raising "In-house build" does not move the Users curve.
- Money labels are wrong: the `profit` series (revenue−cost) is titled "Revenue" (`evaluator.tsx:106,110`); the `margin` series (m·N, pre-cost) is titled "Operating margin". Two series, ~4 names across files.
- Landing/Problem "core insight" says margin is "an output, not a lever" — false; `m=(m0+Δm·Q)·(1+0.25·innov)` is lever-driven (`model.ts:190`).
- Radar "Regulatory" axis = raw `regPressure` passthrough (`model.ts:441`), identical across all 3 strategies, moved by no strategy lever. Mixed polarity: 3 risk axes + 2 strength axes on one blob. Two of the four Problem-page axes (Platform reach, Scaling) have no spoke.
- `proposeMitigations` omits `platformReach` from candidate vecs (`model.ts:565/575/585/595`) → before/after compared at reach 50 not the baseline reach; `applyVector` silently resets reach to 50 (`evaluator.tsx:235`). Standalone port already carries reach through.
- Two "shock" mechanisms both called price shock: hardcoded `dm_shock` margin drop at month 16 (fires in every scenario incl. OSS breakthrough) + `tokenPriceFactor` cost multiplier.
- Presets change strategy levers silently: Pricing-shock bumps reach 50→70; OSS-breakthrough changes Δm, innovation, resilience, reach.
- Parallel dead engine: `src/lib/sim/*` + `src/routes/simulator.tsx` (route registered, orphaned, own 240-run Monte-Carlo, 18-mo horizon, different strategy names). Candidate for deletion.
- Inconsistencies: `σ` documented 0.12 (HowItWorks) vs data 0.30; horizon called 54 mo (params.T) and 12–18 mo (AiInsight prompt, tipping text). Scale is toy: K=100,000, $ not €.

---

## Verified market fact (2026-07-01) `[fact]`
- Allianz Group FY2024: total business volume €179.8B, operating profit €16.0B, core net income €10.0B (allianz.com FY2024 earnings release). Earlier "~€150B" recall was low. A flagship AI line at ~€1–2B/yr revenue is ~1% of group volume — credible, material scale for the demo.

## Design direction — IMPLEMENTED 2026-07-01 (was pending; now built, typechecks, builds, numerically verified)
Causal semantics, now implemented in code:
- Each knob must have one defensible causal reason, a stated cost/tradeoff, and a clear place (dynamics vs economics).
  - In-house build (innovation): quality↑ → churn↓ (in the dynamics) + ARPU↑; costs fixed `F`.
  - Vendor independence (resilience): shields token-price spikes, lowers lock-in; costs `F`; only pays off under a shock.
  - Platform reach: scales addressable market `K` (not a linear rescale of N) → genuine scale-dependent behavior.
  - Scaling aggressiveness: couples ARPU premium (Δm) and quality bar `Q*`; more upside, more cliff/cost-tipping risk.
  - Token price factor (external): ongoing per-user serving cost (COGS). A "pricing shock" = it steps up at a date. ONE quantity, not two.
  - Regulatory pressure (external): distinct from token price — raises fixed compliance cost `F` and slows innovation throughput; partly bought down by in-house build + resilience.
- Normalization: strategy sliders uniform 0–100 (0=min, 50=baseline, 100=max); one documented calibration block mapping each to a bounded, comparable elasticity. No hidden coefficients.
- Scale/currency: euros; insurer scale. Target `[estimate]`: K≈10–15M users, ARPU≈€12–20/mo, monthly revenue≈€80–150M, annual≈€1–2B, cumulative net profit≈€0.3–2B. NOTE: Allianz group revenue was asserted from memory (~€150B) and must be VERIFIED before it anchors calibration.
- Scenarios (two-stage): environment inputs change = the scenario; outputs (cost/margin/profit/users/radar) change automatically; decision inputs (strategy sliders) change ONLY as an explicit, labeled response (mitigation). Stage 1 shock lands (strategy untouched, see damage) → Stage 2 recommended response (mitigation moves the right sliders, see recovery).
- Radar rewrite: 5 spokes = the 4 Problem-page decision axes + 1 environment axis, all "risk, higher = worse", each owned by identifiable sliders, monotonic.
- Mitigation: diagnostic — find the dominant risk, recommend the lever(s) that reduce it with the causal reason, rank by dominant-risk reduction (profit-guarded), fix the reach bug.
- Making innovation (→churn) and reach (→K) dynamical requires live re-simulation in-browser OR a regenerated `runs.json` over an expanded grid. No visual/design change either way.

## Hard rule for implementation
- Do NOT change visual design/layout. Only logic, wiring, formulas, labels, text, and data may change.

---

## Session log
### 2026-07-01 (audit)
- Ran a 6-agent scientific-coherence audit of the codebase (workflow `ai-strategy-audit`). Findings above.
- Discussed causal semantics, normalization, euro/insurer scale, and two-stage scenarios.

### 2026-07-01 (implementation)
Implemented the full scientific rewrite. Design/layout untouched — only logic, formulas, labels, text, data.
- `src/lib/scenario/model.ts` — full rewrite. Live in-browser Euler–Maruyama simulation (σN√dt noise); innovation folds into churn (dynamical retention); platform reach sets market size K; token price = per-user serving COGS (a shock is just a high value, no hardcoded month-16 event); regulation is a DISTINCT channel (fixed compliance cost + innovation drag, not token price); one `CALIB` block with documented elasticities; euros; clean P&L (profit = revenue − serving − reacquisition − fixed); new 5-axis all-risk RiskScores {platform, lockin, capability, scaling, regulatory} + `RISK_AXES`; diagnostic `proposeMitigations` (finds dominant risk → targeted lever, ranked by risk reduction, profit-guarded, reach preserved); env-only `PRESETS`; `buildModelData()` replaces runs.json.
- Wired `evaluator.tsx` (live data build; Revenue/Profit/Margin labels fixed; €; 5 new radar axes + side text; env-only presets; corrected reading sentence; removed price-shock guide; scaling dial derived from dm AND qstar).
- Updated `Mitigation.tsx` (diagnostic tag names dominant risk; new axes; € ; reach shown; removed t_shock guide), `Recommendation.tsx`, `CausalDiagram.tsx` (€, users in M, recalibrated norms, "price" node), `AiInsight.tsx` (accurate prompt, removed false "margin not a lever" claim, model id `claude-sonnet-5`), `HomeChart.tsx` (live sim). `TippingPoints.tsx`/`ScenarioPresets.tsx` unchanged (generic).
- Rewrote copy: `HowItWorks.tsx` (new equations/params in €, √dt noise, distinct regulation, dynamical innovation, no dm_shock), `ProblemFrame.tsx` core insight, `index.tsx` about section (margin IS a lever; profit is the output).
- Deleted the parallel/dead engine: `src/lib/sim/*`, `src/routes/simulator.tsx`, `src/components/SiteHeader.tsx`, and the now-unused `public/runs.json` + `public/generate_data.py`. routeTree regenerated clean.
- Calibration `[fact]`: baseline cumProfit Lean €-406M / Balanced €315M / Premium €1106M; peak monthly revenue €13–80M; each slider moves its own radar axis; pricing-shock vs regulatory-stress now have distinct signatures.
- Verification `[fact]`: `tsc --noEmit` exit 0; `npm run build` exit 0; numeric slider-drive checks all pass (headless).
- DEFERRED / next: live visual check in a browser (dev server) to confirm rendering + design intact; consider a temporal price-step option for a literal "shock at month X" if wanted; `standalone/` port left as-is (separate, not loaded by the app) — realign or delete later.
