// Problem-framing step. Sets up the strategic question and the core insight
// before any chart, then introduces the three strategies.
import type { StrategySpec } from "@/lib/scenario/model";

export function ProblemFrame({
  strategies,
  colors,
  onStart,
}: {
  strategies: StrategySpec[];
  colors: string[];
  onStart: () => void;
}) {
  const stances = [
    "Open, vendor-neutral. Lowest dependency, but quality and innovation lag.",
    "Hybrid. Balances cost exposure against capability and control.",
    "Frontier-first. Highest capability, but deepest cost and lock-in exposure.",
  ];

  return (
    <div className="exp-problem">
      <section className="exp-section">
        <h2 className="exp-section-title">THE DECISION</h2>
        <p className="exp-prose">
          Over the next 12&ndash;18 months a large company has to decide how aggressively to scale
          AI: how far to commit to a single frontier vendor, how much to build in-house, and how many
          apps to put in front of millions of users. These choices are made together and are hard to
          reverse.
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">THE CORE INSIGHT</h2>
        <p className="exp-prose">
          &ldquo;Margin per user&rdquo; is not a real thing you can manage. It is an output of two
          inputs: margin and the number of users. Margin itself is an output of revenue and cost &mdash;
          and cost depends on the vendor&rsquo;s pricing policy. So the real question is not &ldquo;what
          is our margin per user&rdquo; but &ldquo;what happens to cost, users and dependency as the
          world changes &mdash; and which strategy survives it.&rdquo;
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">THREE STRATEGIES</h2>
        <div className="exp-problem-cards">
          {strategies.map((s, i) => (
            <div key={s.label} className="exp-problem-card">
              <span className="exp-problem-bar" style={{ background: colors[i] }} />
              <div className="exp-problem-card-head">
                <span className="exp-problem-name">{s.label}</span>
                <span className="exp-problem-q">Q = {s.Q}</span>
              </div>
              <p className="exp-problem-stance">{stances[i] ?? ""}</p>
            </div>
          ))}
        </div>
        <button type="button" className="exp-cta" onClick={onStart}>
          Explore the causal pathway →
        </button>
      </section>
    </div>
  );
}
