// Problem-framing step. Sets up the strategic question and the core insight,
// then lays out the crucial axes that make the decision genuinely hard before
// inviting the reader into the evaluator.
import { AXIS_ICONS } from "./AxisIcons";



type Axis = {
  n: string;
  title: string;
  question: string;
  lever: string;
  risks: string[];
};

const AXES: Axis[] = [
  {
    n: "01",
    title: "Platform ecosystem",
    question:
      "Ship your own apps in the GPT or Claude store to millions of users. A competitive edge, or a dependency trap?",
    lever: "Platform reach",
    risks: [
      "Token price exposure at millions of users",
      "Exit cost when switching vendor",
      "Reputation cost of a forced shutdown",
    ],
  },
  {
    n: "02",
    title: "Vendor choice",
    question:
      "A hyperscaler (OpenAI, Anthropic, Google) against open source models. Time to market against strategic control.",
    lever: "Vendor independence",
    risks: [
      "Pricing sovereignty",
      "Model quality over time",
      "Regulatory approval",
    ],
  },
  {
    n: "03",
    title: "Build versus buy",
    question:
      "In house capability and ownership against an API first stack. Sovereignty has a price.",
    lever: "In-house build",
    risks: [
      "Time to build AI expertise",
      "Ongoing development cost",
      "Competition for talent",
    ],
  },
  {
    n: "04",
    title: "Scaling strategy",
    question:
      "When does a pilot become a core system? Scaling without an exit path is structural risk.",
    lever: "Scaling aggressiveness",
    risks: [
      "Cost structure tipping point",
      "Technical debt",
      "Governance gaps",
    ],
  },
];

export function ProblemFrame({ onStart }: { onStart: () => void }) {
  return (
    <div className="exp-problem">
      <section className="exp-section">
        <h2 className="exp-section-title">THE DECISION</h2>
        <p className="exp-prose">
          Over the next 12 to 18 months you have to decide how aggressively to scale AI:
          how far to commit to a single frontier vendor, how much to build in house, and how many
          apps to put in front of millions of users. These choices are made together and are hard to
          reverse.
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">THE CORE INSIGHT</h2>
        <p className="exp-prose">
          To turn qualitative reasoning into a quantitative model we simulate the user base over time
          and net a transparent P&amp;L on top. <strong>Profit is the output.</strong> It depends on
          per-user margin (ARPU &mdash; a lever you set), the size and retention of the user base, the
          vendor&rsquo;s serving price, and fixed cost. The point is that no single number decides it:
          retention (churn) matters as much as price, and cost and dependency evolve as you scale.
          Making those causal dependencies explicit &mdash; and letting you stress them &mdash; is
          what this tool does.&nbsp;
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">WHAT MAKES THIS HARD</h2>
        <p className="exp-prose">
          Considering our use case: Four decisions are to be taken at the same time and reinforce
          one another. None can be tuned in isolation, and each carries its own systemic risks.
        </p>
        <div className="exp-axis-grid">
          {AXES.map((a) => {
            const Icon = AXIS_ICONS[a.n as keyof typeof AXIS_ICONS];
            return (
            <div key={a.n} className="exp-axis-card">
              <div className="exp-axis-head">
                <span className="exp-axis-num">{a.n}</span>
                <span className="exp-axis-icon">{Icon ? <Icon /> : null}</span>
                <span className="exp-axis-title">{a.title}</span>
              </div>
              <p className="exp-axis-q">{a.question}</p>
              <div className="exp-axis-risks-label">Systemic risk factors</div>
              <ul className="exp-axis-risks">
                {a.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="exp-axis-lever">
                Evaluator lever <span className="exp-axis-lever-name">{a.lever}</span>
              </div>
            </div>
            );
          })}
        </div>

        <div className="exp-axis-note">
          <strong>Why a model.</strong> These options form a system of systems: each one shifts the
          others, and their interaction creates tipping points that stay invisible in a standard
          business plan. The evaluator makes those couplings explicit so you can simulate each path
          and decide with the dynamics in view.
        </div>

        <button type="button" className="exp-cta" onClick={onStart}>
          Open the evaluator &rarr;
        </button>
      </section>
    </div>
  );
}
