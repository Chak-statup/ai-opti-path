# Project log & working memory

Persistent notes for the AI-strategy evaluator redesign. Read this at the start of a session before doing work. Append dated entries; keep it factual. Mark claims as `[fact]`, `[estimate]`, or `[assumption]` when it matters. Distinguish DECIDED from PENDING — do not record a proposal as a decision.

---

## ▶ RESUME POINT — last updated 2026-07-02 (read this first)

**Status:** Scientific rewrite + rigor audits + fixes are DONE through round 8 (causal-pathway pass: new diagram channels, ×10 flagship rescale, switched-response mitigation), verified (`tsc` 0, `npm run build` 0, 20-check numeric harness, Playwright screenshots incl. HowItWorks overlay). Rounds ≤7 are pushed (`bc60979`); **round 8 is committed/uncommitted per the 2026-07-02 session end — check `git status` / `git log origin/main..HEAD` and push when the user says so** (push syncs Lovable). App builds and runs; nothing is broken.

**Current model story table `[fact]` (dm 6, Q* 0.5, baseline vec; cumProfit €M Lean/Balanced/Premium — insurer scale, ×10 of round-6 figures):** status-quo −378 / 374 / 666 · pricing-shock −415 / **−60** / −174 (ranking flips to Balanced; flat-price flip at ×2.25) · regulatory-stress −469 / 215 / 535 · open-source −431 / −252 / **+756** (quality headroom decides). Aggression optimum 30–40, cliff from 60. Shock + hedge-as-response: −60 → **+115** (piecewise switch at m16; the old full-horizon rerun said +106 — it retroactively charged 16 pre-shock months of resilience F). Peak monthly revenue 12.2 / 59.1 / 80.1 €M `[fact]`.

**How to resume:**
- Model = single source of truth: `src/lib/scenario/model.ts` (live in-browser ODE simulation; there is no runs.json). Every parameter is sourced in `docs/references.md`.
- Run the app: `npm run dev` → http://localhost:8080/evaluator. If `node_modules` is missing, `npm install --no-package-lock` first (bun.lock exists but bun isn't installed in the sandbox — use npm; **revert any playwright added to package.json**).
- Verify logic headless: write a `.ts` scratch importing `./src/lib/scenario/model.ts`, run `node file.ts` (Node 23 native TS strip), delete after. Typecheck: `node_modules/.bin/tsc --noEmit -p tsconfig.json`. Screenshots: Playwright is in node_modules (browser download skipped) → `chromium.launch({channel:'chrome'})`. Clean up `_shots/ _shot.mjs _dev.log` and don't commit them.

**DONE (in unpushed commits):** live ODE sim; innovation→delivered quality Q_eff→churn (pure-logistic cliff); CAC charged on gross adds; serving cost tier-priced (Lean ×0.4 / Balanced ×1.0 / Premium ×1.6); reach→market K; token price = serving COGS; regulation = distinct fixed-cost+innovation channel; clean P&L; euro scale ÷10 (baseline cumProfit after round 6's model changes: Lean −€37.8M / Balanced €37.4M / Premium €66.6M; peak monthly rev €1.2–8.0M — see round 6 for the story table per preset). Radar = 5 all-risk axes each reaching ~100 at its extreme, with a live per-axis "How each axis moves" panel. Diagnostic, credible (non-loss) mitigation; reach bug fixed. Real temporal price shock at month 16 that persists through slider changes. Vendor independence = blended price `(1−h)·tpf+h`, h=0.7·resil/100 (explainable "×3→×1.6"). Parameters grounded + citation-audited (`docs/references.md`; CALIB tagged `[src]/[assume]/[bound]`). Three scenario stories drive users+profit (pricing shock→hedge; aggressive scaling→churn cliff+serving cost; open-source adoption→quality drop→fewer users, quality-dependent). Deleted the parallel `/simulator` engine + `runs.json`.

**PENDING / OPEN — pick up here:**
1. **Push round 8** when the user says so (Lovable sync).
2. **`standalone/` realignment — user said "forget about standalone/ for now" (2026-07-02)**; only pick up if asked.
3. Cosmetic residual: the Π diamond's Δ-vs-base line can overflow the diamond outline at large deltas (readable, tolerated); N-node color band (0.15·K_max saturation) is a display choice `[assume]` — revisit if the user wants a different "healthy" anchor.
(Resolved: causal-diagram node additions (round 8 — reg/F/K/s nodes live); push blocker; HowItWorks couplings; churn-form A/B → Q_eff; CAC on gross adds; tier-priced serving; cosmetic round 7.)
Known-not-bugs: STAT-UP header logo is a Lovable-proxied asset → broken in local dev, fine on Lovable `[fact]`; slider midpoint tick uses native datalist → rendering is browser-dependent.

**Commits (13 unpushed, newest first):** a2ae015 (cosmetic polish) · ce4946d (copy↔model alignment) · dca5461 (**model: Q_eff + CAC-on-adds + tier-priced serving**) · 0cec065 (hygiene) · 1135171 (profitNorm + stale 10× figures) · 86bc1dd … aaf0fb2 (earlier rewrite rounds + docs commits).

**Workflow outputs (may not persist across sessions; distilled into repo docs):** subsystem audit → `docs/logs.md` "2026-07-01 (audit)"; reference research → `docs/references.md`.

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
- Live model: `src/lib/scenario/model.ts`. Main page: `src/routes/evaluator.tsx`. ~~Data: `public/runs.json`~~ (SUPERSEDED — no runs.json since the rewrite; the model simulates live in the browser).

## Verified technical facts (audit 2026-07-01) `[fact]` — ⚠ SUPERSEDED by the rewrite
> These findings describe the PRE-REWRITE app and were all FIXED in the 2026-07-01 implementation rounds below. Kept for historical context only; the RESUME POINT above is current.
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

### 2026-07-01 (round 2 — user feedback: radar legibility, price shock, credible mitigation)
User tested hands-on and flagged real gaps; fixed from first principles (design untouched):
- Radar axes were weighted blends so no single slider could reach the rim. Redesigned so each axis reaches ~100 at its realistic worst case and one slider swings it: RiskScores renamed to {cost, lockin, capability, scaling, regulatory}. Cost exposure = (shielded) token price × reach → ~0 at today's price, 100 at reach 100 under a shock (the "cost high → full" behaviour). Cost is now SEPARATE from scaling (cause vs effect), so a pricing shock no longer masquerades as scaling risk.
- Added a live per-axis explanation panel on the Risk stage (each axis: drivers, current value, "rises when…") via a new `rises` field on RISK_AXES — the mechanism is now visible. `[fact]`
- Restored the price shock as a REAL temporal event: ScenarioContext.shockMonth; serving cost is ×1 (today) before shockMonth then steps to tokenPriceFactor. Pricing-shock preset = tpf 3 at month 16. Guide line + visible profit drop at month 16 on trajectory and mitigation charts. `[fact]`
- Mitigation credibility: only surface options that materially cut the dominant risk AND don't lose money vs baseline (never headline a money-loser); rank by risk reduction, breaking comparable ties by profit. Under pricing shock the dominant is cost exposure → "Hedge the vendor" (+€114M) headlines; the old −€139M dud is filtered out. `[fact]`
- Field rename platform→cost propagated to evaluator, Mitigation, Recommendation, AiInsight. Removed the now-unused `totals()` helper.
- Verified: tsc exit 0; numeric checks (all axes reach ~100 at extremes; single sliders swing own axis; temporal shock dips profit at month 16 and is less severe than flat ×3; mitigations credible per scenario); live browser screenshots confirm rendering + design intact.
- Note on this round's process: the prior mitigation-ranking tweak was a reactive patch; this round replaced it with a principled redesign (cause/effect separation + credibility filter + search-style credibility). Keep that standard — reason from the model, don't patch to placate.
- Still not pushed (github unreachable from the agent sandbox); user runs `git push origin main`. Commits: aaf0fb2 (rewrite) + this round.

### 2026-07-01 (round 3 — shock persistence, references, 10x scale, vendor reform)
- Fixed shock-vanishes-on-slider-drag bug (onKnob/setScaling cleared shockMonth). Commit bce98b9.
- 10x monetary rescale (K/N0/F ÷10): cumProfit Lean −€41M / Balanced €31M / Premium €111M; peak monthly rev €1.3–8M. Per-unit economics unchanged.
- Reformed vendor independence to a BLENDED price: shieldedTpf = (1−h)·tpf + h, h = maxHedge·resil/100. Same numbers as the old linear shield for a spike but explainable ("at 70% independence only 30% of traffic feels a hike; ×3→×1.6"). Deleted dead `resilLockCut`. Verified 3.0/2.3/1.6 at resil 0/50/100; price drops pass through.
- Grounded every parameter: ran a 13-agent research + citation-audit workflow (`ground-model-params`); wrote `docs/references.md` with per-parameter sources (Anthropic/OpenAI/Google pricing, Slack/Copilot ARPU, First Page Sage CAC, PyMC Bass p/r, Optifai churn, RouteLLM maxHedge, ML-salary/Fourthline fixed+compliance, MIT Sloan reg drag, a16z LLMflation OSS) + methodological refs (Bass 1969, sigmoid churn Jones&Sasser 1995, blended hedge, Euler–Maruyama). CALIB tagged inline [src]/[assume]/[bound]. Commit 079b11e.
- KEY honesty flags (carry into pitch, from references.md): serve0 volume is an assumption (price grounded); cac is per-seat vs per-account benchmarks (~35× higher); chiMax 0.30 / phi 0.35 / regInnovDrag 0.40 are worst-case bounds (expected ~0.10–0.15 / 0.07–0.12 / 0.25–0.33); maxHedge 0.70 is a technical ceiling (realized ~19%); 3× shock has no single-vendor precedent; pin FX to live ECB rate.
- OPEN: churn form A/B (route innovation through Q_eff vs keep multiplicative) — user hasn't decided. Causal diagram redesign — proposed making the 4 sliders explicit driver-nodes; awaiting user confirm.
- Commits now: aaf0fb2, 3eafc05, bce98b9, 079b11e (all unpushed).

### 2026-07-01 (round 4 — scenario stories affect users + profit)
- Made 3 scenario stories drive users AND profit (commit 40a6cbf):
  1. Price hike → loss → Hedge the vendor (already worked).
  2. Aggressive scaling: added `scalingServeBump` (serving cost per user rises with dm) on top of the churn cliff. dm6/Q*0.5 → dm11/Q*0.9 on Balanced: users 0.38→0.10M, profit €25→−€28M. Per-user cost up; total cost down as the business shrinks.
  3. Open-source adoption: `ScenarioContext.qualityShift` (OSS = 0.2) lowers effective quality via `scenarioQuality(Q,ctx)`, threaded through simulate/deriveRawExact/computeCausalState/sweep/riskScores(cliff). OSS preset relabeled "Open-source adoption", tpf 0.5 + qualityShift 0.2. Quality-dependent: Balanced €25M→−€28M (falls below bar, users 0.38→0.15M); Premium €102M→€86M (keeps headroom). Evaluator threads qualityShift like shockMonth (set by preset, not cleared by sliders).
- Verified: tsc 0; numeric stories confirmed.
- STILL PENDING (deferred at ~80% token checkpoint): HowItWorks copy for the two new couplings (OSS quality trade, scaling serving cost); the causal-diagram redesign (4 sliders as explicit driver-nodes — proposed, awaiting user confirm); churn-form A/B question (still open).
- Commits: aaf0fb2, 3eafc05, bce98b9, 079b11e, 40a6cbf (all unpushed; github unreachable from sandbox → user runs `git push origin main`).

### 2026-07-01 (round 5 — scientific-rigor audit + first fixes)
Ran a 3-agent rigor audit (copy-vs-model, numeric harness, repo hygiene) toward a manager-facing pitch. Numeric harness: tsc 0; all 5 radar axes monotone, own-slider ownership clean, each reaches ~100 at its extreme (lockin caps at 96, cosmetic); scenario stories reproduce exactly; conservation checks at float precision; no NaN under combined stress; cumProfit vs aggression has a real interior optimum (argmax a=30, cliff at 50–80). `[fact]`
- FIXED this round (user-directed scope): `profitNorm` /1500 → /150 in `model.ts` (dead pre-÷10 normalizer; now 0.17–0.68 across baselines — note CausalDiagram floors loss intensity at 0.6, so only the norm's meaning changed, mild-loss display unchanged); HowItWorks stale 10× figures (K 2M–15M→0.2M–1.5M, N₀ 40k→4k, F₀ €4M→€0.4M, F_ι €5M→€0.5M, F_ρ €1.5M→€0.15M, F_reg €3M→€0.3M); RESUME-POINT baseline figures were round-3 stale (−41/31/111 → verified round-4 actuals −42.4/25.2/102.1, peak rev 1.34–8.07). Deleted stray `_dev.log`.
- AUDIT FINDINGS still OPEN (blockers for the pitch, NOT yet fixed — user paused broader fixes):
  1. HowItWorks "no separate one-off event" note contradicts the real `shockMonth` step (also `s = s0·ρ` omits `scalingServeBump`); the two new couplings (OSS `qualityShift`, scaling→serving bump) still undocumented there.
  2. `evaluator.tsx:606` yLabel "$M over horizon" — last surviving `$`.
  3. `Recommendation.tsx` flip-texts make claims the model refutes: Premium leads in EVERY preset at default vector (shock: −53/−13/+49; ×2 flat: −50/+1/+69 — ranking never shifts), and "more vendor-independent strategy" is a category error (independence is a shared slider, not a strategy property).
  4. `AiInsight.tsx` prompt omits `qualityShift` + `shockMonth` (+reach, scalingServeBump) → the LLM briefing can praise the OSS scenario the chart shows destroying Balanced.
  5. Mitigation: the only money-losing headline is "Buy vendor independence" on Premium (Δ −€3.03M, exactly on the credibility floor via fallback) — an honest insurance trade but at odds with "never headline a money-loser" phrasing.
  6. `evaluator.tsx:407` "×3→×1.6" holds only at slider 100 (at 70: ×2.02) — ambiguous next to a 0–100 slider.
  7. Hygiene: `standalone/backend/__pycache__/*.pyc` is COMMITTED (add to .gitignore + git rm --cached); logs.md mid-file "The app" + "Verified technical facts" sections describe the pre-rewrite app with no superseded marker.
- MODEL-LEVEL judgment calls surfaced (need user decision, not unilateral fixes):
  (a) Acquisition is free during growth — CAC charged on replacement (χ+φ)N only, Bass gross adds cost €0; defensible near steady state, a hole under "what did 400k users cost to acquire?"
  (b) `qualityShift` is unmitigable by any lever → OSS story's only honest response is retreating the bar; routing innovation through Q_eff (the open churn-form A/B) would make "build in-house" the natural OSS mitigation.
  (c) Causal-state `comp` node is a hardcoded constant 0.7 (`clamp01(phi/0.5)`).
- Correction: earlier suspicion that `usersNorm` pins at 1.0 was WRONG — it uses end-of-horizon users (0.48/0.76 at Balanced/Premium baseline), discriminates properly.
- Note: logs' "users 0.38→0.10M" phrasing = trajectory PEAK, not end-of-horizon (end 0.102→0.028) — keep the distinction in the pitch.

### 2026-07-01 (round 6 — all audit issues fixed; three model changes)
User directed: fix everything from the round-5 audit. Hygiene done (untracked `.pyc`, .gitignore, superseded markers). Copy blockers done (Recommendation flip-texts rewritten to model-verified claims; AiInsight prompt now carries `shockMonth`/`qualityShift`/reach/serve couplings; HowItWorks shock note + both new couplings + $M→€M + hedge precision "at full independence… at 70 it's ×2.0").
**Model changes (commit "Q_eff churn routing, CAC on gross adds, quality-priced serving"):**
1. **Churn A/B DECIDED → Q_eff.** χ is a pure logistic in `Q_eff = clamp01(Q − Δq_scen + 0.15·ι)` (`innovQualityLift 0.15 [assume]` replaces `innovChurnCut 0.30`). One quality channel drives churn → in-house build genuinely mitigates the OSS quality drop (Balanced OSS: −25.2 → −15.9 at innovation 90; Q_eff 0.466→0.519 crosses back over the 0.5 bar). New "Rebuild quality in-house" mitigation when a scenario cuts quality and scaling dominates.
2. **CAC on gross adds.** Acquisition = `cac·[p(K−N)+rN(1−N/K)]` (blended-CAC definition, consistent with First Page Sage's construction) — replaces the replacement charge `cac·(χ+φ)N` on churn the ODE never refilled. Growth is no longer free in the P&L; churn's cost now flows through the lost paying base (the honest channel).
3. **NEW loophole found & fixed: the tier was a dominated decision** (Q was free — Premium won every preset). Serving is now tier-priced: `qualityServeFactor = 1+2.0·(Q−0.6)` → Lean ×0.4 / Balanced ×1.0 / Premium ×1.6 `[src-anchored]` (conservative vs the real 3–5× cross-tier API spreads already in references.md).
Also: causal-state `comp` node = documented `φ/2 / chiMax` = 0.583 (was arbitrary `φ/0.5`); cliff risk uses Q_eff (build reduces scaling risk — causally real cross-effect, ownership still clean).
**New calibration `[fact]` (dm6, q0.5, baseline vec; cumProfit €M Lean/Balanced/Premium):** status-quo −37.8/37.4/**66.6**; pricing-shock −41.5/**−6.0**/−17.4 (ranking FLIPS to Balanced — frontier serving is Premium's exposed flank; flat-price flip threshold between ×2 and ×2.5); regulatory-stress −46.9/21.5/**53.5**; OSS −25.2 vs **+75.6** (quality headroom decides; OSS is net-GOOD for Premium). Aggression interior optimum ≈40, cliff 50–70. Shock+hedge: −6.0→+10.6. Innovation end-to-end on Balanced: 16.8→55.0 (+38.2, retention channel dominant — "retention beats margin" finding survives).
**Verified `[fact]`:** tsc 0; `npm run build` 0; radar ownership + extremes ≈100; slider directions; month-16 step (2.00→0.44 €M/mo); 12 mitigation cells credible (two Δ≈−3 insurance-premium headlines sit ON the credibility floor by design: Premium/lockin −3.0, shock/Lean hedge −1.3 — honest trades, shown with their cost); edge stress finite; every copy-quoted number (tier factors 0.4/1.0/1.6, +0.15 lift, ×2.5 flip, ×2.0 at slider 70) recomputed against the model.
**Pitch-relevant new stories:** (a) tier choice is now scenario-dependent — Premium at today's prices, Balanced under a sustained ×3; (b) OSS splits the portfolio by quality headroom; (c) build-in-house is the honest OSS mitigation. Carry the references.md honesty flags; tier→model-mix mapping is an assumption (slope 2.0 conservative).
STILL PENDING: push (user); causal-diagram driver-node redesign (awaiting confirm); standalone/ realignment.

### 2026-07-02 (round 7 — cosmetic polish, user-authorized)
User authorized light cosmetic changes ("without restructuring") + landing-page cleanup. Done, verified via tsc/build + Playwright screenshots (light theme, landing closed/open, evaluator causal stage):
- Landing: hero lead tightened; the "What the evaluator shows" section collapsed into a native `<details>` (closed by default; new `.lp-about-summary`/`.lp-about-details` CSS, matches lp-section-title styling); footer typo "purpose"→"purposes" (both pages).
- Evaluator: live environment chip in the chart tabs row (`.exp-scenario-chip`, dashed pill: "serving ×3.0 @ m16 · reg 30 · quality −0.2") so charts always declare their scenario; shock guide label now carries the magnitude ("price ×3.0"); axis-map item 03 says "In-house build → delivered quality Q_eff & ARPU m"; native `datalist` midpoint tick (50 = today) on the 4 strategy sliders (tick rendering is browser-dependent — harmless where unsupported).
- Consistency: all €M readouts now 1-decimal with true minus (Recommendation/Mitigation fmt aligned to evaluator's fmtMoney); CausalDiagram Q node reads "delivered quality X.XX" (it shows Q_eff).
- HowItWorks: χ equation split into two Tex blocks (χ; then Q_eff + m) and the serving decomposition shortened to s=s0·f(Q)·(1+0.4Δm/12)·ρ with f(Q) inline — prevents overflow on narrow screens.
- KNOWN (pre-existing, not fixed): the STAT-UP header logo is a Lovable-proxied asset (`/__l5e/assets-v1/...`) → broken image in local dev, fine on Lovable. `[fact]`
- Radar spoke values: already present in the "How each axis moves" panel — no change needed.

### 2026-07-02 (round 8 — causal-pathway scientific pass; plan approved by user)
User's audit: vendor independence "changes profit but nothing else"; reach barely moves users; build/regulation proportions invisible; shock in no formula; opaque `buffer`; h/ρ/tpf unjustified; strategies vs scenarios undifferentiated; mitigation before/after should start at the point of realisation; confirm revenue realism. All verified with a numeric harness before fixing (plan `lovely-yawning-kay.md`). Key evidence: usersNorm was **constant 0.57 across the whole reach sweep** (divided by reach-dependent K); resil 0→100 at ×1 changed *only* cumProfit (downward — uncharted F_resil); churn/margin norms lived in one color bucket (normalized on worst-case bounds).
**Implemented (design language unchanged; diagram content extended):**
- **×10 insurer-flagship rescale** (K 2–15M, N0 40k, F ×10) — restores the recorded design target (€13–80M/mo peak revenue ≈ €1B/yr at peak ≈ 1% Allianz volume); the round-3 ÷10 contradicted it. All stories survive ×10 exactly (table above). references.md scale section rewritten; F-row grounding notes flipped (F_reg now grounded AT the in-code value; F0/F_innov/F_resil headcounts are the ×10 extrapolation `[assume]`).
- **CausalDiagram 9→12 nodes**: added `K` (market, reach region), `reg` (external), `F` (fixed cost, decomposed sub-line "bld · ind · reg" — makes independence's insurance premium and compliance cost visible); renamed `shock`→`s` (serving €/user with live "×3.0 → ×2.3 · hedge 35%" mechanism line). New edges K→N, reg→F, reg→Q (drag), F→Π, Δm→s. Dropped planned Q→s edge (any col1-top→col3-mid curve crosses χ; tier factor carried in s's value + HowItWorks instead). Regions: 01→[K], 02→[s], 03/04 unchanged.
- **Δ-vs-baseline sub-lines** on Q, χ, m, N, Π (baseline = traced strategy, default posture, status-quo env — same reference as the radar's dashed outline), colored by good/bad direction. Display norms recalibrated (display only, dynamics untouched): churnNorm over realistic band χ∈[0.02, **0.12**] (`chiDisplay [src]`); usersNorm over fixed 0.15·K_max (reach now swings it 0.13→0.95; 0.25 first tried but made the healthy default read red); profitNorm |cum|/1000 (`profitDisplay`).
- **Switched-response mitigation** (`deriveSwitched`): piecewise sim — baseline posture to switchMonth (= shockMonth ?? 0), candidate continues from N(switchMonth); segment-aware P&L; price step independent of the switch. `proposeMitigations` scores on switched cumProfit. Invariants `[fact]`: cand≡base reproduces deriveStrategy to 0.0 diff; pre-switch trajectories identical to 1e-12. Mitigation chart curves now coincide until the "shock → response" guide then diverge; money-losing "contain the footprint" dropped out under honest scoring.
- **Formulas legible** (HowItWorks): F written out in full with the buffer explicit `1−0.30(0.6v+0.4b)` + `[assume]` caption (kept per D2 — it is the only lever channel against regulation); ι and h/ρ split into separate blocks; `tpf` defined; **piecewise ρ(t) shock formula added** (two Tex lines — one-line version clipped in the panel); param table extended (ι, h, ρ, tpf, F_ι, F_ρ, F_reg, buffer). CALIB gains regBufferResilW/InnovW, chiDisplay, profitDisplay; fixedCostParts() exported.
- **Strategy vs scenario**: presets got a kicker line ("Environment scenarios — the world changes; your strategy stays put") + `.exp-presets-title` CSS; rail legend "Your product tier — the strategy (Q)"; causal blurb states the decision/future distinction.
- **Slider notes**: rewritten to what-it-is / what-it-moves-quantified / trade-off with LIVE computed numbers (KM, hedge %, F line items, +Δquality, drag %, Δm/Q*, +serve %); vendor note is two-branch (insurance at ×≤1, "blends ×3.0→×2.3" under a shock).
**Verified `[fact]`:** tsc 0 · build 0 · 20/20 harness checks (norm ownership incl. reach-invariance regression, switched invariants, story table, 12 mitigation cells credible, flip ×2.25, tier factors, hedge numbers, peak-revenue band) · Playwright: 4 presets + 3 slider extremes + mitigation divergence + HowItWorks overlay, all in the existing design language.
**Judgment calls:** Π delta text overflows the diamond at big deltas (tolerated); N-band 0.15·K_max `[assume]`; Q→s edge dropped (geometry); responseMonth=0 for standing scenarios (regulatory/OSS) — equals old behavior there by construction.
