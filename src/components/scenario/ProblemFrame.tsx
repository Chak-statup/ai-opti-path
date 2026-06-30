// Problem-framing step. Sets up the strategic question and the core insight,
// then lays out the crucial axes that make the decision genuinely hard before
// inviting the reader into the evaluator.

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
          To convert qualitative reasoning to quantitative models we define some metrics that
          correlate with the business model. For ex: Margin per user is an estimated output of two
          inputs: margin and the number of users. Margin itself is an output of revenue and cost, and
          cost depends on the vendor&rsquo;s pricing policy. Constructing estimated causal
          dependencies for such cases is important and this is what we do.&nbsp;
        </p>
      </section>

      <section className="exp-section">
        <h2 className="exp-section-title">WHAT MAKES THIS HARD</h2>
        <p className="exp-prose">
          Considering our use case: Four decisions are to be taken at the same time and reinforce
          one another. None can be tuned in isolation, and each carries its own systemic risks.
        </p>
        <div className="exp-axis-grid">
          {AXES.map((a) => (
            <div key={a.n} className="exp-axis-card">
              <div className="exp-axis-head">
                <span className="exp-axis-num">{a.n}</span>
                <span className="exp-axis-title">{a.title}</span>
              </div>
              <p className="exp-axis-q">{a.question}</p>
              <div className="exp-axis-risks-label">Systemic risk factors</div>
              <ul className="exp-axis-risks">
                {a.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
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
