# Model calibration & references

Every parameter and formula in `src/lib/scenario/model.ts` (`CALIB` block) with its source. Compiled 2026-07-01 by a research + **citation-audit** pass (each URL was WebFetch-re-verified that day; figures trace to the audited source). Currency EUR. Monetary **aggregates** use the reduced (÷10) scale that ships in code; **per-unit** economics (ARPU, serving cost, CAC) are unscaled and grounded at face value.

> Honesty first: some parameters are grounded in real sources; others are internal modelling assumptions. Both are marked. Do not present an assumption as a citation.

## Scale & FX conventions
- ÷10 applies to monetary **aggregates** only (`F0, F_innov, F_resil, F_reg`, and all €M revenue/cost/profit). The code already encodes the ÷10 values (e.g. `F0: 400_000`). The ×10 figures are the real-world design magnitudes.
- Per-unit economics (`arpu0, serve0, cac, dm`) are €/user/month, unscaled.
- **FX ≈ 1.08 USD/EUR** is an approximate assumption, not a live rate. Pin to an ECB daily reference rate before quoting EUR conversions.

## A. Parameters grounded in a real source

### Per-unit economics (€/active user/month)
| Symbol | Value | Source | Note |
|---|---|---|---|
| `serve0` | 2.5 (range 0.9–6.5) | Anthropic / OpenAI / Google API pricing — https://platform.claude.com/docs/en/about-claude/pricing , https://developers.openai.com/api/docs/pricing , https://ai.google.dev/gemini-api/docs/pricing | Frontier blend ~$3/$15 (Sonnet), $2.50/$15 (GPT-5.4), $1.25/$10 (Gemini Pro) × **assumed** ~0.5–1M tokens/user/mo. **Price grounded; token volume is an assumption.** |
| `arpu0` | 9 | Slack Pro — https://slack.com/pricing/pro | Per-seat €6.75–8.25 brackets €9; AI seats run higher, so €9 is conservative. |
| `dm` (0–12, default 6) | up to 12 | Microsoft 365 Copilot — https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/enterprise | Verified AI premium $30/user/mo → €12 is low-to-mid of the $5–30 uplift band. |
| `cac` | 20 (per-seat) | First Page Sage B2B CAC — https://firstpagesage.com/reports/average-customer-acquisition-cost-cac-by-industry-b2b-edition-fc/ | Benchmarks are per-**account** (FS ~€726; Insurance-SaaS ~$1,280). €20/seat implies a self-serve motion, **not** enterprise field sales (~35× higher per account). Charged on **gross adds** `p(K−N)+rN(1−N/K)` — the blended-CAC definition (total acquisition spend / all new users), consistent with the benchmark's own construction. |
| `qualityServeSlope` | 2.0 | Anthropic / OpenAI / Google API pricing (cross-tier spreads, URLs above) | Serving factor `1+2.0·(Q−0.6)`: Lean ×0.4 / Balanced ×1.0 / Premium ×1.6 (4× Lean→Premium spread). Real cross-tier spreads are 3–5× (Opus $15/$75 vs Sonnet $3/$15 = 5×; Gemini Pro→Flash 4×), so the in-model spread is **conservative**. The tier→model-mix mapping itself is an assumption. |

### Growth & diffusion (Bass coefficients, /month)
| Symbol | Value | Source | Note |
|---|---|---|---|
| `p` (innovation) | 0.008 | PyMC-Marketing Bass model — https://www.pymc-marketing.io/en/stable/notebooks/bass/bass_example.html | Canonical 0.01–0.03; 0.008 just below (weak paid acquisition into a small insurer market). |
| `r` (imitation) | 0.35 | PyMC-Marketing Bass model — (as above) | Canonical 0.3–0.5; meta-analytic mean ~0.38. **Best-grounded parameter.** |

### Churn, competition, volatility
| Symbol | Value | Source | Note |
|---|---|---|---|
| `chiMin` | 0.02 /mo | Optifai B2B SaaS churn (N=939) — https://optif.ai/learn/questions/b2b-saas-churn-rate-benchmark/ | Enterprise band 1–2%/mo. |
| `chiMax` | 0.30 /mo | Optifai (as above) | **Worst-case ceiling**, above the documented failure tail (>5%/mo). Empirical ceiling would be ~0.10–0.15. Present as a bound, not a median. |
| `phi` | 0.35 /mo peak (avg ≈0.175) | ChartMogul AI churn wave — https://chartmogul.com/reports/saas-retention-the-ai-churn-wave/ | AI-native gross churn ~0.07–0.11/mo central. **0.35 is an aggressive worst-case peak** at end-of-horizon. |
| `sigma` | 0.16 | frePPLe demand classification (Syntetos-Boylan-Croston) — https://frepple.com/blog/demand-classification/ | CV<0.70 = smooth/forecastable; 0.16 is conservative. |

### Vendor hedge
| Symbol | Value | Source | Note |
|---|---|---|---|
| `maxHedge` | 0.70 | RouteLLM (arXiv:2406.18665, ICLR 2025) — https://arxiv.org/abs/2406.18665 | ~70–87% of general queries route to a cheaper model at ~95% frontier quality. **Technical ceiling**; realized enterprise open-source share is only ~19% (Menlo 2024). |

### Fixed / organisational cost (€/month; ÷10 in code)
| Symbol | ÷10 (code) | ×10 (real) | Source | Note |
|---|---|---|---|---|
| `F0` | 400,000 | €4M/mo | CareerFoundry ML salary (SalaryExpert/ERI) — https://careerfoundry.com/en/blog/data-analytics/machine-learning-engineer-salary/ | ~15–25 EU FTE @ €130–160k loaded + infra ≈ €4–6M/yr. |
| `F_innov` | 500,000 | €5M/mo | (as above) | Full build ≈ 30–50 FTE. |
| `F_resil` | 150,000 | €1.5M/mo | (as above) | Portability team ≈ 8–12 FTE (~⅓ of build org). |
| `F_reg` | 300,000 | **€3M/mo = €36M/yr** | Fourthline bank compliance — https://www.fourthline.com/blog/how-much-do-banks-spend-on-compliance | Incremental full-load. Here the **×10 (€36M/yr) is what's grounded**; €300k/mo is display scale. EU AI-Act per-system ≈€29,277 + QMS €20–80k (CEPS/Renda 2021 via SQ Magazine); EU-wide €100–500M/yr (EPRS PE 694.212). |

Supporting: EU ML base salary DE €95,880 / FR €77,113 (CareerFoundry/ERI); fully-loaded 1.25–1.4× (Glencoyne) lifted by EU non-wage costs 24.7% avg / 32.2% FR (Eurostat ddn-20250328-1); enterprise genAI spend $37B 2025 (Menlo).

### Regulation drag
| Symbol | Value | Source | Note |
|---|---|---|---|
| `regInnovDrag` | 0.40 | MIT Sloan / Aghion-Bergeaud-Van Reenen — https://mitsloan.mit.edu/ideas-made-to-matter/does-regulation-hurt-innovation-study-says-yes | Economy-wide ~5%; heavy-regulation analogs 26–33% (GDPR cut EU venture deals ~26%, NBER WP30705). **0.40 is a full-load stress bound**; expected-case ~0.25–0.33. |

### Environment scenario dials (`tokenPriceFactor`)
| Setting | Value | Source | Note |
|---|---|---|---|
| Baseline | 1.0 | vendor pricing (above) | Today's price. |
| OSS-breakthrough | 0.5 | a16z LLMflation — https://a16z.com/llmflation-llm-inference-cost/ ; Epoch — https://epoch.ai/data-insights/llm-inference-price-trends | **Strongly grounded**: equiv-quality prices fall ~10×/yr (median ~50×/yr), so ≥2× drop/yr is routine. |
| Pricing-shock | 3.0 | Anthropic pricing (cross-tier spreads) | Opus 4.1→4.8 = 3×; Fable 5 = 2× Opus; Gemini Pro→Flash = 4×. **No single-vendor tripling precedent** — present 3× as a scenario magnitude, not a historical event. |

## B. Parameters that remain ASSUMPTIONS (no external citation)
State plainly as modelling choices.

| Symbol (value) | What it is | Data needed to fit it |
|---|---|---|
| `kappa` = 12 | Steepness of the logistic churn cliff around Q* | Cohort churn across a quality/satisfaction (NPS, task-success) gradient — fit the logistic slope. |
| `innovQualityLift` = 0.15 | Full in-house build raises DELIVERED quality +0.15 (~half a tier); churn responds through the same logistic cliff. (Replaced the earlier multiplicative `innovChurnCut` = 0.30 — decided 2026-07-01: one quality channel drives churn, so build genuinely mitigates a scenario quality drop.) | Before/after or A/B cohort retention mapped onto the quality index, in-house vs vendor-only. |
| `innovArpuLift` = 0.20 | In-house build lifts ARPU 20% | Monetization experiments isolating uplift from proprietary features. |
| `regComplianceBuffer` = 0.30 | Resilience+build buy down 30% of compliance | Case studies on portability + in-house compliance reducing audit/QMS cost. |
| `Q` tiers 0.3/0.6/0.9, `qstar` 0.5 | Dimensionless quality index & churn threshold | Map an observable quality metric to churn; locate the threshold empirically. |
| `tau` = 6 | Deployment→revenue lag (mo) | Enterprise-insurance sales-cycle / time-to-first-revenue. |
| `N0` = 4,000 | Initial active users | The insurer's own pilot telemetry. |
| `K_min` = 200k, `K_max` = 1.5M | Addressable market by reach | Bottom-up TAM across the target book. |
| `shockMonth` = 16; `regPressure` 30/85 | Scenario timing/intensity dials | Stress-test knobs, not empirical. |
| `T` = 54, `steps` = 361 | Horizon / integration resolution | Design/numerical choices. |
| FX ≈ 1.08 USD/EUR | Currency conversion | Live ECB daily reference rate on the pitch date. |

## C. Methodological references for the model FORMS
| Form (code) | Status | Reference |
|---|---|---|
| Logistic / Bass growth — `p(K−N) + rN(1−N/K) − χN − φ(t/T)N` (`simulate`) | Grounded | Bass, F.M. (1969) *A New Product Growth for Model Consumer Durables*, **Management Science 15(5):215–227**. Meta-analysis: Sultan, Farley & Lehmann (1990), **JMR 27(1):70–77** — https://journals.sagepub.com/doi/abs/10.1177/002224379002700107 |
| Sigmoid churn-vs-quality — `chi()` logistic cliff | Grounded (form) | Jones & Sasser (1995) *Why Satisfied Customers Defect*, **HBR Nov–Dec 1995** — https://hbr.org/1995/11/why-satisfied-customers-defect . `kappa` slope is a tuning choice (see B). |
| Blended-price hedge — `shieldedTpf = (1−h)·rawTpf + h·1` | Grounded | Portfolio weighted-average; routable fraction RouteLLM (arXiv:2406.18665); multi-model enterprise norm Menlo 2024 — https://menlovc.com/2024-the-state-of-generative-ai-in-the-enterprise/ |
| Euler–Maruyama SDE — `σN√dt·dW` multiplicative noise (`simulate`) | Form only (σ magnitude grounded via `sigma`) | Standard scheme; canonical text Kloeden & Platen, *Numerical Solution of Stochastic Differential Equations* (Springer). No URL asserted — verify before citing. |

## Honesty flags to carry into any pitch
1. **`serve0` volume, not price, is the soft spot** — API prices grounded; tokens/user assumed.
2. **`cac` is per-seat; benchmarks are per-account** (~35× higher for FS) — €20/user implies self-serve, not field sales.
3. **`chiMax`=0.30, `phi`=0.35, `regInnovDrag`=0.40 are stress ceilings, not expected values.** Expected-case: chiMax ~0.10–0.15, phi ~0.07–0.12/mo, regInnovDrag ~0.25–0.33.
4. **`maxHedge`=0.70 is a technical ceiling** (RouteLLM), above today's realized ~19% open-source deployment.
5. **The 3.0× pricing shock has no single-vendor precedent** — a cross-tier-anchored stress magnitude.
6. **F-scale is asymmetric**: F0/F_innov/F_resil grounded at their ÷10 in-code values; F_reg grounded at its ×10 real-world value (€36M/yr).
7. **Pin FX to a live ECB rate** before any EUR conversion.
