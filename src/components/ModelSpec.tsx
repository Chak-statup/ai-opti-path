import { useState } from "react";
import { ChevronDown, FunctionSquare } from "lucide-react";
import { Eq } from "@/components/math/Eq";
import {
  STRATEGY_PARAMS,
  STRATEGY_META,
  SHOCK_META,
  SHOCK_TYPES,
} from "@/lib/sim/scenario";
import type { Strategy } from "@/lib/sim/types";

const STRATS: Strategy[] = ["platform", "opensource", "hybrid"];

const DRIVERS: { target: string; drivers: { label: string; sign: "+" | "−" }[] }[] = [
  {
    target: "Monthly AI spend  (C)",
    drivers: [
      { label: "active users (U)", sign: "+" },
      { label: "calls / user (rises with apps)", sign: "+" },
      { label: "token price (P)", sign: "+" },
      { label: "cost-per-call κ", sign: "+" },
      { label: "governance overhead γ", sign: "+" },
    ],
  },
  {
    target: "Vendor lock-in  (L)",
    drivers: [
      { label: "apps built on the stack", sign: "+" },
      { label: "lock-in rate ℓ", sign: "+" },
      { label: "vendor-terms shock", sign: "+" },
      { label: "control / portability", sign: "−" },
    ],
  },
  {
    target: "Reputation  (R)",
    drivers: [
      { label: "brand building (baseline)", sign: "+" },
      { label: "security shock", sign: "−" },
      { label: "quality shock", sign: "−" },
      { label: "regulation shock", sign: "−" },
      { label: "forced price pass-through (P>1.8)", sign: "−" },
    ],
  },
];

export function ModelSpec() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FunctionSquare className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold">
              How this model is calculated
            </span>
            <span className="block text-xs text-muted-foreground">
              Equations, drivers, distributions and parameters — the actual math the engine runs
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-8 border-t border-border p-5 text-sm leading-relaxed">
          {/* 1. State */}
          <Section n="1" title="State variables (stocks) & initial values">
            <p className="text-muted-foreground">
              The model steps monthly for the chosen horizon{" "}
              <Eq tex="H \in [12,18]" />. Each strategy runs over the same
              stocks, initialised as:
            </p>
            <Eq
              display
              tex={`\\text{apps}_0 = A_0,\\quad U_0 = 1800\\,A_0,\\quad L_0 = 4\\ell,\\quad R_0 = 1,\\quad P_0 = 1`}
            />
            <p className="text-muted-foreground">
              where <Eq tex="A_0" /> is “apps live at start”, <Eq tex="U" /> users,{" "}
              <Eq tex="L" /> the lock-in index <Eq tex="\in[0,1]" />, <Eq tex="R" />{" "}
              reputational capital <Eq tex="\in[0,1]" />, and <Eq tex="P" /> the
              token-price multiplier.
            </p>
          </Section>

          {/* 2. Equations */}
          <Section n="2" title="Governing equations (per month m)">
            <p className="text-muted-foreground">Growth, with multiplicative noise <Eq tex="\varepsilon = 1 + 0.05\,Z" />, <Eq tex="Z\sim\mathcal{N}(0,1)" />:</p>
            <Eq display tex={`\\text{apps}_m = \\text{apps}_{m-1}\\,(1 + 0.07\\,\\lambda\\,a\\,\\varepsilon)`} />
            <Eq display tex={`U_m = U_{m-1}\\big(1 + g\\,\\sigma\\,\\varepsilon\\big),\\qquad \\sigma = \\frac{1}{1 + U_{m-1}/6{\\times}10^{6}}`} />
            <p className="text-muted-foreground"><Eq tex="\lambda" /> = launch rate, <Eq tex="a" /> = ambition, <Eq tex="g" /> = user growth, <Eq tex="\sigma" /> = market saturation.</p>

            <p className="mt-3 text-muted-foreground">Token price reacts to shocks (see §4):</p>
            <Eq display tex={`P_m = P_{m-1} + 0.12\\,M_{ps}s_{ps}\\,\\mathbb{1}_{ps} + 0.05\\,M_{vt}s_{vt}\\,\\mathbb{1}_{vt}`} />

            <p className="mt-3 text-muted-foreground">Monthly AI spend ($M), with <Eq tex="\kappa" /> cost-per-call and <Eq tex="\gamma" /> governance overhead:</p>
            <Eq display tex={`C_m = \\frac{U_m}{10^{6}}\\,\\underbrace{(0.9 + 0.004\\,\\text{apps}_m)}_{\\text{calls/user}}\\,\\kappa\\,P_m\\,(1 + 0.12\\,\\gamma)`} />

            <p className="mt-3 text-muted-foreground">Lock-in accumulates with apps, damped by control <Eq tex="c" />:</p>
            <Eq display tex={`L_m = \\mathrm{clip}\\Big(L_{m-1} + \\ell\\,(1 + \\tfrac{\\text{apps}_m}{400})(1 - 0.3c),\\,0,\\,1\\Big)`} />

            <p className="mt-3 text-muted-foreground">Reputation drifts up slowly, eroded by shocks and forced price pass-through:</p>
            <Eq display tex={`\\Delta R = 0.004 - 0.05 M_{se}s_{se}\\mathbb{1}_{se} - 0.04 M_{q}s_{q}\\mathbb{1}_{q} - 0.02 M_{rg}s_{rg}\\mathbb{1}_{rg} - 0.02\\,(P_m-1.8)^{+}`} />
            <Eq display tex={`R_m = \\mathrm{clip}\\big(R_{m-1} + \\Delta R + 0.004\\,Z,\\,0,\\,1\\big)`} />
          </Section>

          {/* 3. Driver graph */}
          <Section n="3" title="What drives what (signed influences)">
            <p className="text-muted-foreground">
              Every term above maps to a signed causal link. <span className="text-quality">+</span> amplifies, <span className="text-risk">−</span> dampens.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {DRIVERS.map((d) => (
                <div key={d.target} className="rounded-xl border border-border p-3">
                  <p className="font-semibold">{d.target}</p>
                  <ul className="mt-2 space-y-1">
                    {d.drivers.map((x) => (
                      <li key={x.label} className="flex items-start gap-1.5 text-muted-foreground">
                        <span className={x.sign === "+" ? "font-bold text-quality" : "font-bold text-risk"}>{x.sign}</span>
                        <span>{x.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* 4. Shocks & distributions */}
          <Section n="4" title="Shocks & distributions (the Bayesian layer)">
            <p className="text-muted-foreground">
              Each enabled shock <Eq tex="k" /> fires at its month and its severity is
              <em> uncertain</em>. Once per Monte-Carlo run we draw a magnitude from a
              truncated normal centred on the slider value:
            </p>
            <Eq display tex={`M_k \\sim \\mathrm{clip}\\big(\\,\\mathcal{N}(\\mu_k,\\,0.15^2),\\;0.05,\\;1\\big)`} />
            <p className="text-muted-foreground">
              <Eq tex="\mu_k" /> is the configured severity; <Eq tex="s_k" /> below is how
              hard each strategy is hit (shock sensitivity). The “prior” is the assumed
              likelihood the shock occurs at all.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Shock</th>
                    <th className="py-2 pr-3 font-medium">Prior P(occurs)</th>
                    <th className="py-2 pr-3 font-medium">Platform sₖ</th>
                    <th className="py-2 pr-3 font-medium">Open-source sₖ</th>
                    <th className="py-2 font-medium">Hybrid sₖ</th>
                  </tr>
                </thead>
                <tbody>
                  {SHOCK_TYPES.map((t) => (
                    <tr key={t} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{SHOCK_META[t].label}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{Math.round(SHOCK_META[t].prior * 100)}%</td>
                      <td className="py-1.5 pr-3 tabular-nums">{STRATEGY_PARAMS.platform.shockSensitivity[t]}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{STRATEGY_PARAMS.opensource.shockSensitivity[t]}</td>
                      <td className="py-1.5 tabular-nums">{STRATEGY_PARAMS.hybrid.shockSensitivity[t]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 5. Strategy parameters */}
          <Section n="5" title="Strategy parameters (the actual numbers)">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Parameter</th>
                    {STRATS.map((s) => (
                      <th key={s} className="py-2 pr-3 font-medium">{STRATEGY_META[s].label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["launch rate λ", "launchRate"],
                    ["base quality", "baseQuality"],
                    ["cost-per-call κ", "costPerCall"],
                    ["lock-in rate ℓ", "lockInRate"],
                    ["control c", "control"],
                    ["governance γ", "govOverhead"],
                  ] as const).map(([label, key]) => (
                    <tr key={key} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{label}</td>
                      {STRATS.map((s) => (
                        <td key={s} className="py-1.5 pr-3 tabular-nums">
                          {STRATEGY_PARAMS[s][key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 6. Monte Carlo + resilience */}
          <Section n="6" title="Monte-Carlo ensemble & scoring">
            <p className="text-muted-foreground">
              Each strategy is simulated <strong>N = 240</strong> times with fresh noise and
              shock draws. For every month we report the 10th / 50th / 90th percentiles —
              the median line and the shaded credible band you see in the chart.
            </p>
            <p className="mt-2 text-muted-foreground">Resilience at the horizon combines low lock-in, high reputation, and tight cost uncertainty:</p>
            <Eq display tex={`\\text{spread} = \\frac{C^{p90}_H - C^{p10}_H}{\\max(C^{p50}_H,\\,10^{-3})}`} />
            <Eq display tex={`\\text{Resilience} = 0.45\\,(1-L_H) + 0.40\\,R_H + 0.15\\,\\big(1-\\mathrm{clip}(\\text{spread},0,1)\\big)`} />
          </Section>

          <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
            Demo note: structure (stocks, flows, signed feedback, Bayesian shock sampling,
            Monte-Carlo propagation) is methodologically standard; the numeric coefficients
            are illustrative defaults, all editable via the controls. Same engine runs in TS
            today and ports 1:1 to the planned Python/FastAPI backend.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-bold text-muted-foreground">
          {n}
        </span>
        {title}
      </h3>
      <div className="space-y-2 pl-8">{children}</div>
    </section>
  );
}
