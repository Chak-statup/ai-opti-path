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
    lever: "Scaling intensity",
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
          Over the next 12 to 18 months the company must decide how aggressively to scale its AI
          product: how deeply to commit to a single frontier vendor, how much capability to build in
          house, and how widely to ship to customers. These four choices lock each other in, and
          reversing any of them later is expensive.
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">THE CORE INSIGHT</h2>
        <p className="exp-prose">
          A business case for a decision like this usually collapses into one number: margin per
          user. That number hides the decision. Profit here is not set by any single lever; it
          emerges over time from four interacting quantities: what each user pays (ARPU), how many
          users you keep (retention), what each user costs to serve (the vendor&rsquo;s token
          price), and the fixed cost of the capabilities you choose to build. A strategy that wins
          on margin can still lose on churn, and a cheap stack today can become the expensive one
          after a price move you do not control.
        </p>
        <p className="exp-prose">
          So instead of comparing static numbers, this tool <strong>simulates</strong> the user base
          month by month and nets a transparent P&amp;L on top. <strong>Profit is the output</strong>,
          not an input: move a decision and you see revenue, cost, users and risk move with it.
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">WHAT MAKES THIS HARD</h2>
        <p className="exp-prose">
          Four decisions have to be taken at the same time. Each one changes the payoff of the
          others, so none can be tuned in isolation, and each carries its own systemic risks.
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
