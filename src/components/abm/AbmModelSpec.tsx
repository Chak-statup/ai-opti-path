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

export function AbmModelSpec() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-quality text-white">
            <FunctionSquare className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold">
              How this model is calculated
            </span>
            <span className="block text-xs text-muted-foreground">
              Agents, network, decision rules and distributions — the actual math the engine runs
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-8 border-t border-border p-5 text-sm leading-relaxed">
          <Section n="1" title="The population (360 agents)">
            <p className="text-muted-foreground">
              Agents are internal teams (30%), customers (55%), partners (15%) with revenue
              weights 1.0 / 1.6 / 2.4. Each agent <Eq tex="i" /> has attributes drawn from
              uniform distributions:
            </p>
            <Eq display tex={`\\text{priceSens}_i\\sim U(0.3,0.9),\\;\\; \\text{trust}_i\\sim U(0.3,0.9)`} />
            <Eq display tex={`\\text{dataSens}_i\\sim U(0,0.7)\\;[U(0.5,1)\\text{ for partners}],\\;\\; \\text{switch}_i\\sim U(0,1)`} />
            <p className="text-muted-foreground">
              Seed adopters at <Eq tex="t{=}0" />: <Eq tex="\lfloor 360 \cdot 0.05 \cdot \lambda \rfloor" />.
            </p>
          </Section>

          <Section n="2" title="Social network (contagion)">
            <p className="text-muted-foreground">
              Each agent links to its 5 nearest neighbours (by 2-D proximity, sampled from 14
              candidates). Peer pressure is the adopted fraction among neighbours:
            </p>
            <Eq display tex={`\\text{peer}_i = \\frac{1}{|\\mathcal{N}_i|}\\sum_{j\\in\\mathcal{N}_i}\\mathbb{1}[\\,j\\text{ adopted}\\,]`} />
          </Section>

          <Section n="3" title="Environment per month (set by strategy + shocks)">
            <Eq display tex={`P = 1 + 0.9\\,M_{ps}s_{ps}\\mathbb{1}_{ps} + 0.5\\,M_{vt}s_{vt}\\mathbb{1}_{vt}`} />
            <Eq display tex={`Q = Q_0 - 0.4\\,M_{q}s_{q}\\mathbb{1}_{q}`} />
            <Eq display tex={`\\Delta R = 0.006 - 0.04 M_q s_q\\mathbb{1}_q - 0.05 M_{se}s_{se}\\mathbb{1}_{se} - 0.02 M_{rg}s_{rg}\\mathbb{1}_{rg}`} />
            <p className="text-muted-foreground"><Eq tex="P" /> price, <Eq tex="Q" /> quality (base <Eq tex="Q_0" />), <Eq tex="R" /> brand reputation; <Eq tex="s_k" /> the per-strategy shock sensitivity.</p>
          </Section>

          <Section n="4" title="Per-agent utility & decision rules">
            <p className="text-muted-foreground">Each agent computes a perceived utility:</p>
            <Eq display tex={`u_i = 0.5\\,Q + 0.3\\,R + 0.4\\,\\text{peer}_i - 0.5\\,\\text{priceSens}_i(P-1) - 0.25\\,\\text{dataSens}_i(1-c)`} />
            <p className="text-muted-foreground">Transitions (Bernoulli draws each step):</p>
            <Eq display tex={`\\text{unaware}\\to\\text{adopt}: \\; p = \\mathrm{clip}(0.5\\,u_i\\,\\lambda\\,\\text{trust}_i,\\,0,\\,0.6)`} />
            <Eq display tex={`\\text{adopted}\\to\\text{churn}: \\; p = \\mathrm{clip}((0.35 - u_i)\\,\\text{switch}_i,\\,0,\\,0.5)`} />
            <Eq display tex={`\\text{churned}\\to\\text{return}: \\; p = \\mathrm{clip}(0.2\\,(u_i - 0.55),\\,0,\\,0.15)`} />
            <p className="text-muted-foreground">An adopted agent is flagged <span className="text-cost font-medium">at-risk</span> when <Eq tex="u_i < 0.35" />. Lost revenue sums the weights of churned agents.</p>
          </Section>

          <Section n="5" title="Strategy & shock parameters">
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
                    ["base quality Q₀", "baseQuality"],
                    ["control c", "control"],
                  ] as const).map(([label, key]) => (
                    <tr key={key} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{label}</td>
                      {STRATS.map((s) => (
                        <td key={s} className="py-1.5 pr-3 tabular-nums">{STRATEGY_PARAMS[s][key]}</td>
                      ))}
                    </tr>
                  ))}
                  {SHOCK_TYPES.map((t) => (
                    <tr key={t} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{SHOCK_META[t].short} sensitivity sₖ</td>
                      {STRATS.map((s) => (
                        <td key={s} className="py-1.5 pr-3 tabular-nums">{STRATEGY_PARAMS[s].shockSensitivity[t]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
            Demo note: this is a standard threshold/contagion agent-based model with a social
            network and shock-driven environment. Coefficients are illustrative defaults,
            editable via the controls. Deterministic seeded RNG, so a given scenario replays
            identically.
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
