// Mitigation step: when a shock hits or the goal changes, the model proposes
// several alternative strategy vectors and simulates each against the same
// environment. Every candidate is simulated as a RESPONSE: the current posture
// runs until the shock is realised (the response month), then the candidate
// takes over on the same user trajectory; so the before/after comparison
// starts at the point of realisation, not retroactively at month 0. The human
// stays in the loop: toggle candidates to overlay their profit trajectories,
// inspect the primary one on the radar, then apply it to the live evaluator.
import { useEffect, useMemo, useState } from "react";
import { LineChart, type Series } from "@/components/scenario/LineChart";
import { RadarChart, type RadarSeries } from "@/components/scenario/RadarChart";
import { Tex } from "@/components/scenario/Tex";
import {
  deriveRiskScores,
  deriveStrategy,
  deriveSwitched,
  proposeMitigations,
  RISK_AXES,
  type MitigationBaseline,
  type RunsData,
  type ScenarioContext,
} from "@/lib/scenario/model";

const RADAR_AXES = RISK_AXES.map((a) => a.label);

// Distinct trend colors for overlaying several candidates at once.
const CAND_COLORS = ["#2980B9", "#16A085", "#F39C12", "#4B2C50", "#C0392B"];

function fmt(v: number): string {
  const sign = v < 0 ? "−" : "";
  return `${sign}€${Math.abs(v).toFixed(1)}M`;
}

function fmtDelta(v: number): string {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(1)}M`;
}

// Mocked AI briefing, composed locally from the chosen candidate's numbers.
function aiBriefing(
  c: { label: string; rationale: string; cumProfit: number; deltaVsBaseline: number; vec: { innovation: number; resilience: number } },
  baseProfit: number,
): string[] {
  return [
    `I read the live scenario and stress-tested the candidate vectors against the same environment. "${c.label}" is the strongest response: it moves the cumulative result from ${fmt(baseProfit)} to ${fmt(c.cumProfit)} (${fmtDelta(c.deltaVsBaseline)}).`,
    `The decisive move is to ${c.rationale.charAt(0).toLowerCase()}${c.rationale.slice(1)}`,
    `Watch-out: this leans on innovation ${Math.round(c.vec.innovation)} and resilience ${Math.round(c.vec.resilience)}. If the external shock deepens, raise resilience first, it is the cheapest hedge against vendor pricing pass-through.`,
  ];
}

export function Mitigation({
  data,
  ctx,
  base,
  stratColors,
  onApply,
}: {
  data: RunsData;
  ctx: ScenarioContext;
  base: MitigationBaseline;
  stratColors: string[];
  onApply: (c: MitigationBaseline) => void;
}) {
  void stratColors;
  const candidates = useMemo(() => proposeMitigations(data, base, ctx), [data, base, ctx]);
  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    candidates.forEach((c, i) => (map[c.id] = CAND_COLORS[i % CAND_COLORS.length]));
    return map;
  }, [candidates]);

  // Multi-select set for overlay comparison + a single primary for radar/apply.
  const firstId = candidates[0]?.id ?? "";
  const [selIds, setSelIds] = useState<string[]>(firstId ? [firstId] : []);
  const [primaryId, setPrimaryId] = useState(firstId);

  // Reset selection if the candidate set changes (scenario or base changed).
  useEffect(() => {
    setSelIds(firstId ? [firstId] : []);
    setPrimaryId(firstId);
  }, [firstId]);

  const primary = candidates.find((c) => c.id === primaryId) ?? candidates[0];
  const selected = candidates.filter((c) => selIds.includes(c.id));

  function toggle(id: string) {
    setPrimaryId(id);
    setSelIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id],
    );
  }

  // Mocked AI advisory state.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const runAi = () => {
    setAiLoading(true);
    setAiDone(false);
    window.setTimeout(() => {
      const best = candidates[0];
      if (best) {
        setPrimaryId(best.id);
        setSelIds((prev) => (prev.includes(best.id) ? prev : [...prev, best.id]));
      }
      setAiLoading(false);
      setAiDone(true);
    }, 900);
  };

  const t = data.t;
  // The month the risk is realised and a response becomes possible: the shock
  // month for a timed shock, otherwise t = 0 (a standing scenario is already here).
  const responseMonth = ctx.shockMonth ?? 0;
  const baseDerived = useMemo(
    () => deriveStrategy(data, base.strat, base.dm, base.qstar, ctx, base.vec),
    [data, base, ctx],
  );

  // Build overlay series: baseline first, then each selected candidate as a
  // RESPONSE; identical to the baseline up to the response month, switched after.
  const profitSeries: Series[] = useMemo(() => {
    const series: Series[] = [
      { ys: baseDerived.profit, color: "var(--exp-axis)", width: 2, opacity: 0.5 },
    ];
    selected.forEach((c) => {
      const d = deriveSwitched(data, base, { strat: c.strat, dm: c.dm, qstar: c.qstar, vec: c.vec }, ctx);
      series.push({
        ys: d.profit,
        color: colorOf[c.id],
        width: c.id === primaryId ? 2.8 : 2,
      });
    });
    return series;
  }, [baseDerived, selected, data, base, ctx, colorOf, primaryId]);

  const primaryDerived = useMemo(
    () => deriveSwitched(data, base, { strat: primary.strat, dm: primary.dm, qstar: primary.qstar, vec: primary.vec }, ctx),
    [data, base, primary, ctx],
  );

  const baseRisk = useMemo(
    () => deriveRiskScores(data, base.strat, base.dm, base.qstar, ctx, base.vec),
    [data, base, ctx],
  );
  const RISK_LABELS: Record<string, string> = {
    cost: "cost exposure",
    lockin: "vendor lock-in",
    capability: "capability gap",
    scaling: "scaling risk",
    regulatory: "regulatory load",
  };
  const dominantKey = (["cost", "lockin", "capability", "scaling", "regulatory"] as const).reduce(
    (a, b) => (baseRisk[b] > baseRisk[a] ? b : a),
    "cost" as "cost" | "lockin" | "capability" | "scaling" | "regulatory",
  );
  const primaryRisk = useMemo(
    () => deriveRiskScores(data, primary.strat, primary.dm, primary.qstar, ctx, primary.vec),
    [data, primary, ctx],
  );

  const radarSeries: RadarSeries[] = [
    {
      label: "Before",
      color: "var(--exp-axis)",
      values: [baseRisk.cost, baseRisk.lockin, baseRisk.capability, baseRisk.scaling, baseRisk.regulatory],
      dashed: true,
      fill: false,
    },
    {
      label: "After",
      color: colorOf[primary.id],
      values: [primaryRisk.cost, primaryRisk.lockin, primaryRisk.capability, primaryRisk.scaling, primaryRisk.regulatory],
      fill: true,
    },
  ];

  return (
    <div className="exp-mit">
      <div className="exp-mit-tag">
        The dominant risk in this scenario is <strong>{RISK_LABELS[dominantKey]}</strong> (
        {Math.round(baseRisk[dominantKey])}/100). Below are the strategy changes that reduce it,
        ranked by how much they cut that risk (profit-guarded). Each is simulated as a{" "}
        <strong>response</strong>
        {responseMonth > 0
          ? `: your current posture runs until the shock lands at month ${responseMonth}, then the change takes over.`
          : " to this standing scenario, applied from the start."}{" "}
        Toggle several to compare; the highlighted one drives the radar and Apply.
      </div>

      <div className="exp-mit-ai">
        <div className="exp-mit-ai-head">
          <span className="exp-mit-ai-title">AI-mitigated strategy</span>
          <span className="exp-mit-ai-tag">Demo, mocked advisory</span>
        </div>
        {!aiDone ? (
          <>
            <p className="exp-prose">
              Let the assistant read the live scenario, pick a mitigated strategy vector and add it
              to the comparison below. The human stays in the loop.
            </p>
            <button
              type="button"
              className="exp-mit-ai-btn"
              onClick={runAi}
              disabled={aiLoading || candidates.length === 0}
            >
              {aiLoading ? "Analysing scenario" : "Generate AI mitigation"}
            </button>
          </>
        ) : (
          <div className="exp-mit-ai-out">
            <div className="exp-mit-ai-pick">
              Recommended vector: <strong>{primary.label}</strong>{" "}
              <span style={{ color: primary.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)" }}>
                {fmtDelta(primary.deltaVsBaseline)}
              </span>
            </div>
            {aiBriefing(primary, baseDerived.cumProfit).map((p, i) => (
              <p key={i} className="exp-mit-ai-line">
                {p}
              </p>
            ))}
            <button type="button" className="exp-mit-ai-reset" onClick={() => setAiDone(false)}>
              Re-run advisory
            </button>
          </div>
        )}
      </div>

      <div className="exp-mit-cards">
        {candidates.map((c) => {
          const on = selIds.includes(c.id);
          const isPrimary = c.id === primaryId;
          return (
            <button
              key={c.id}
              type="button"
              className={`exp-mit-card ${on ? "active" : ""} ${isPrimary ? "primary" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              style={on ? { borderColor: colorOf[c.id] } : undefined}
            >
              <div className="exp-mit-card-head">
                <span className="exp-mit-card-label">
                  <span className="exp-swatch" style={{ background: colorOf[c.id], opacity: on ? 1 : 0.3 }} />
                  {c.label}
                </span>
                <span
                  className="exp-mit-card-delta"
                  style={{ color: c.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)" }}
                >
                  {fmtDelta(c.deltaVsBaseline)}
                </span>
              </div>
              <p className="exp-mit-card-rationale">{c.rationale}</p>
              <div className="exp-mit-card-vec">
                <span>{data.meta.strategies[c.strat].label}</span>
                <span><Tex>{"Q^{*}"}</Tex> {c.qstar.toFixed(2)}</span>
                <span><Tex>{"\\Delta m"}</Tex> {c.dm.toFixed(1)}</span>
                <span>Innov {Math.round(c.vec.innovation)}</span>
                <span>Resil {Math.round(c.vec.resilience)}</span>
                <span>Reach {Math.round(c.vec.platformReach ?? 50)}</span>
                <span>−{Math.max(0, c.riskReduction).toFixed(0)} risk pts</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="exp-mit-compare">
        <div className="exp-mit-chart">
          <div className="exp-mit-chart-head">
            <span className="exp-section-title">BEFORE VS AFTER, PROFIT</span>
            <div className="exp-mit-numbers">
              <span className="exp-mit-num">
                <span className="exp-swatch" style={{ background: "var(--exp-axis)" }} />
                Before {fmt(baseDerived.cumProfit)}
              </span>
            </div>
          </div>
          <LineChart
            xs={t}
            series={profitSeries}
            xLabel="months"
            yLabel="€M / month"
            vGuides={[
              { x: data.meta.params.tau, label: "revenue lag", color: "var(--exp-axis)" },
              ...(ctx.shockMonth !== undefined
                ? [{ x: ctx.shockMonth, label: "shock → response", color: "var(--exp-marker)" }]
                : []),
            ]}
            zeroLine
            xFormat={(v) => `${Math.round(v)}`}
            yFormat={(v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
            height={300}
          />

          <table className="exp-mit-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Cumulative</th>
                <th>vs before</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="exp-swatch" style={{ background: "var(--exp-axis)" }} /> Before
                </td>
                <td className="num">{fmt(baseDerived.cumProfit)}</td>
                <td className="num">n/a</td>
              </tr>
              {selected.map((c) => (
                <tr key={c.id} className={c.id === primaryId ? "primary" : ""}>
                  <td>
                    <span className="exp-swatch" style={{ background: colorOf[c.id] }} /> {c.label}
                  </td>
                  <td className="num">{fmt(c.cumProfit)}</td>
                  <td
                    className="num"
                    style={{ color: c.deltaVsBaseline >= 0 ? "var(--exp-hybrid)" : "var(--exp-accent-3)" }}
                  >
                    {fmtDelta(c.deltaVsBaseline)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="exp-mit-radar">
          <div className="exp-mit-radar-title">{primary.label}, risk shape</div>
          <RadarChart axes={RADAR_AXES} series={radarSeries} size={320} />
          <div className="exp-radar-legend">
            <span className="exp-radar-legend-row">
              <span className="exp-swatch dashed" /> Before
            </span>
            <span className="exp-radar-legend-row">
              <span className="exp-swatch" style={{ background: colorOf[primary.id] }} /> After
            </span>
          </div>
        </div>
      </div>

      <div className="exp-mit-apply">
        <p className="exp-prose">
          <strong>{primary.label}</strong> moves cumulative result from {fmt(baseDerived.cumProfit)}{" "}
          to <strong>{fmt(primaryDerived.cumProfit)}</strong> ({fmtDelta(primary.deltaVsBaseline)}).
          Applying it sets every lever in the evaluator so you can keep exploring from there.
        </p>
        <button
          type="button"
          className="exp-mit-apply-btn"
          onClick={() =>
            onApply({
              strat: primary.strat,
              dm: primary.dm,
              qstar: primary.qstar,
              vec: primary.vec,
            })
          }
        >
          Apply {primary.label} &rarr;
        </button>
      </div>
    </div>
  );
}
