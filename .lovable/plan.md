# AI Strategy Tool — Plan

A decision-intelligence demo that lets an executive explore how three AI operating models — **Platform/API-first**, **Open-source/local-first**, and **Hybrid** — play out over 12–18 months under togglable shock events. Two complementary simulation engines, both fully interactive, both running client-side in TypeScript now (a parallel FastAPI port comes in a later step).

## Scope of this build
- Landing page + theme system + two working simulations + scenario toggles.
- Light mode default, dark toggle. Palette-driven design tokens.
- All math in TypeScript so it runs live in the Lovable preview. FastAPI is deferred.

## Pages / Routes
```
/            Landing page (hero, the strategic question, 2 model cards)
/causal      Causal / Bayesian system-dynamics simulation
/abm         Agent-based model simulation
```
Shared header with brand, route links, and light/dark toggle. Each route gets its own SEO head() metadata.

## Theme & design system
Build a single source-of-truth token file (light + dark) from the palette:

| Role | Light | Dark |
|---|---|---|
| Primary (brand blue) | #2980B9 | #4ea1d8 |
| Success / control (teal) | #16A085 | #1ccdaa |
| Accent / open-source (green) | #9BBB59 | #bfd495 |
| Warning / cost (amber) | #F39C12 | #f7be63 |
| Danger / risk (red) | #C0392B | #dc6f64 |
| Deep / governance (plum) | #4B2C50 | #74447c |

Map each into semantic tokens in `src/styles.css` (`@theme inline` + `:root`/`.dark`), so charts and components reference tokens, never raw hex. Consistent mapping across both sims: **Platform=blue, Open-source=green, Hybrid=plum**, with amber=cost, red=risk, teal=control/quality. Clean, minimal, generous whitespace, soft cards, subtle motion.

## Scenario controls (shared)
A reusable control panel feeding both engines:
- **Operating model** selector (or "compare all three").
- **Shock toggles**: token-price spike, vendor terms change / lock-in, regulatory tightening, security/data-leak incident, quality failure. Each has a timing + magnitude.
- Time horizon slider (12–18 months), app/user growth assumptions.

## Simulation 1 — Causal / Bayesian system-dynamics (`/causal`)
A stock-and-flow + Bayesian-belief model projecting monthly outcomes per strategy.

**What it models**
- Stocks: number of AI apps, active users, monthly cost, vendor dependency index, reputational capital, switching cost (lock-in).
- Flows driven by growth, token price, model quality, governance overhead.
- A small Bayesian layer: prior probabilities of each shock; toggling a shock updates posterior expected cost/risk, with credible-interval bands shown on charts.
- Monte Carlo (N runs) to produce uncertainty bands rather than single lines.

**Outputs / visuals**
- Multi-line time-series (cost, lock-in, reputation) with shaded confidence bands.
- A small causal-loop diagram (nodes + signed arrows) highlighting reinforcing lock-in vs balancing optionality.
- Strategy comparison summary cards (expected 18-mo cost, lock-in score, resilience score).

## Simulation 2 — Agent-based model (`/abm`)
Heterogeneous agents (internal teams, customers, partners) adopting AI apps over time.

**What it models**
- Agents with attributes: price sensitivity, trust, data sensitivity, switching propensity.
- Each step: agents adopt/abandon apps based on quality, price, reputation, and peer influence (simple social-network adoption / contagion).
- Strategy determines provider routing, cost-per-call, quality, and how shocks hit the population.

**Outputs / visuals**
- Animated adoption curve + churn over time.
- Network/scatter canvas of agents colored by state (adopted / churned / at-risk).
- Aggregate KPIs: retained users, lost revenue on shock, reputation hit, recovery time.
- Play / pause / step / reset controls.

## Cross-model framing
A consistent verdict panel on both pages reinforcing the thesis: a **staged hybrid strategy preserves optionality** — fast where speed matters, controlled where scale/sensitivity/cost exposure is strategic. Same shocks can be replayed across both models to show consistent narrative from two methods.

## Technical approach (Lovable preview)
- TanStack Start + React + Tailwind v4 (existing stack) as the preview wrapper, kept thin and clean per your requested stack spirit.
- Simulation engines as pure, framework-agnostic TypeScript modules in `src/lib/sim/` (`causal.ts`, `abm.ts`, shared `types.ts`, `scenario.ts`) — easy to later mirror 1:1 in Python.
- Charts via lightweight Recharts (time series) + HTML canvas for the ABM agent/network view.
- Fonts via @fontsource (clean modern sans, e.g. Outfit/Figtree) — install with bun add, import in entry; no CDN.

## FastAPI (deferred, noted not built now)
Later step: a `backend/` FastAPI service exposing `/api/causal` and `/api/abm` running the same model math in Python (numpy), plus a plain HTML/JS/Tailwind front for fully-local deployment. The TS engines are written to make this port mechanical.

## File outline (this build)
```
src/styles.css                      theme tokens (light/dark) from palette
src/routes/index.tsx                landing + model cards
src/routes/causal.tsx               causal/Bayesian sim page
src/routes/abm.tsx                  agent-based sim page
src/components/ThemeToggle.tsx
src/components/SiteHeader.tsx
src/components/ScenarioControls.tsx  shared shock/strategy controls
src/components/VerdictPanel.tsx
src/components/CausalLoopDiagram.tsx
src/components/charts/*              time-series + KPI cards
src/components/abm/AgentCanvas.tsx
src/lib/sim/types.ts
src/lib/sim/scenario.ts
src/lib/sim/causal.ts               stocks/flows + Bayesian + Monte Carlo
src/lib/sim/abm.ts                  agent stepping + adoption/contagion
```

## Notes / disclaimers
Models are scientifically grounded but illustrative — parameters are demo defaults, clearly labeled as such, tunable via the control panel. No backend or data persistence in this step.

After approval I'll start with the theme tokens + landing page, then the causal sim, then the ABM, verifying each in the preview before moving on.