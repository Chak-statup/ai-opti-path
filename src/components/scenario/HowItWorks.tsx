import { Tex } from "./Tex";

type ParamRow = { sym: string; meaning: string; value: string };

const PARAMS: ParamRow[] = [
  { sym: "N(t)", meaning: "Active users, the single state variable", value: "—" },
  { sym: "Q", meaning: "Quality = strategy (the decision)", value: "0.3 / 0.6 / 0.9" },
  { sym: "K", meaning: "Market size", value: "100,000" },
  { sym: "p", meaning: "External acquisition rate", value: "0.01 / mo" },
  { sym: "r", meaning: "Word-of-mouth growth rate", value: "0.35 / mo" },
  { sym: "\\chi_{\\min},\\,\\chi_{\\max}", meaning: "Churn floor / ceiling", value: "0.02 / 0.35 / mo" },
  { sym: "\\kappa", meaning: "Churn-cliff steepness", value: "12" },
  { sym: "Q^{\\ast}", meaning: "Churn threshold, cliff location (swept)", value: "0.5" },
  { sym: "m_0,\\,\\Delta m", meaning: "Base margin, quality slope", value: "$8, $6 / user / mo" },
  { sym: "\\Delta m_{\\text{shock}}", meaning: "Margin lost after price shock", value: "$4 / user / mo" },
  { sym: "\\varphi", meaning: "Peak competitive-loss rate", value: "0.35 / mo" },
  { sym: "\\sigma", meaning: "Demand volatility", value: "0.12" },
  { sym: "c_{\\mathrm{ac}}", meaning: "Cost per (re)acquired user", value: "$15" },
  { sym: "F", meaning: "Fixed cost per month", value: "$30,000" },
  { sym: "\\tau", meaning: "Deployment to revenue lag", value: "6 mo" },
  { sym: "t_{\\text{shock}}", meaning: "Price-shock time", value: "16 mo" },
  { sym: "T", meaning: "Horizon", value: "54 mo" },
];

const FINDINGS = [
  {
    h: "Users are not monotone",
    b: "With competition, every strategy rises, peaks, then declines. There is no permanent plateau and no guaranteed-growing base.",
  },
  {
    h: "Apps can lose money",
    b: "A low-quality app bleeds acquisition cost refilling a high-churn bucket, so the open path is value-destroying here even while it has users.",
  },
  {
    h: "There is a critical threshold",
    b: "Past a strategy-specific Q*, cumulative profit turns negative. Quality below the market's bar is not merely less profitable, it is loss-making.",
  },
  {
    h: "Quality pays through retention",
    b: "The per-user margin lift from quality is the minor channel. Keeping users (low churn, hence low re-acquisition cost) is the dominant one.",
  },
];

export function HowItWorks() {
  return (
    <div className="exp-howto">
      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">What the model is for</h3>
        <p className="exp-prose">
          A compact dynamical model of how a single strategic choice, product{" "}
          <strong>quality</strong>, drives the user base and profit of an AI product over time. It
          is built for strategy discussion, not engineering: there is one state variable, the active
          user count <Tex>{"N(t)"}</Tex>, and quality is a <em>chosen</em> input, not something the
          system solves for. It is deliberately a <em>driven</em> system, so it produces legible,
          explainable curves rather than emergent oscillations.
        </p>
        <p className="exp-prose">
          Strategy is reduced to a single number, the quality level <Tex>{"Q\\in[0,1]"}</Tex>:
          Strategy&nbsp;1 <Tex>{"\\approx 0.3"}</Tex>, Strategy&nbsp;2 <Tex>{"\\approx 0.6"}</Tex>,
          Strategy&nbsp;3 <Tex>{"\\approx 0.9"}</Tex>.
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">The equations</h3>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "dN = \\Big[\\, p(K-N) + rN\\big(1-\\tfrac{N}{K}\\big) - \\chi(Q)\\,N - \\varphi\\tfrac{t}{T}\\,N \\,\\Big]dt + \\sigma N\\,dW"
            }
          </Tex>
          <p className="exp-howto-cap">
            User dynamics: acquisition (external marketing plus word-of-mouth) minus losses (churn
            plus competition), with a demand-noise term so each run is a scenario, not a single
            prophecy.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\chi(Q)=\\chi_{\\min}+\\frac{\\chi_{\\max}-\\chi_{\\min}}{1+e^{\\,\\kappa(Q-Q^{\\ast})}}\\qquad m(Q)=m_0+\\Delta m\\,Q"
            }
          </Tex>
          <p className="exp-howto-cap">
            Quality maps: it lowers churn through a threshold cliff and raises per-user margin
            linearly. These are the only two places quality enters.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\Pi(t)=\\Theta(t-\\tau)\\big[m(Q)-\\Delta m_{\\text{shock}}\\,\\Theta(t-t_{\\text{shock}})\\big]N - c_{\\mathrm{ac}}\\,\\rho\\big[\\chi(Q)+\\varphi\\tfrac{t}{T}\\big]N - F"
            }
          </Tex>
          <p className="exp-howto-cap">
            Profit flow: per-user margin is earned only after the deployment lag <Tex>{"\\tau"}</Tex>{" "}
            and is knocked down by a one-off price shock; against it we net the cost of replacing lost
            users at the effective token multiplier <Tex>{"\\rho"}</Tex> and a fixed overhead.
            Cumulative profit is the time-integral of <Tex>{"\\Pi(t)"}</Tex> over the horizon.
          </p>
        </div>

        <p className="exp-prose exp-howto-note">
          Where the shock acts: the price shock is a token-price (serving-cost) spike. Because serving
          cost is folded into the margin <Tex>{"m(Q)"}</Tex>, it shows up as a drop in operating
          margin and net profit, while the separate cost line (CAC plus fixed) stays smooth through
          the shock.
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">Innovation and resilience</h3>
        <p className="exp-prose">
          The strategy vector adds two company-level investments on top of quality. They are not
          outcomes you read off, they are levers, each on a 0 to 100 scale with a real trade-off:
          both raise fixed cost.
        </p>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\iota=\\frac{\\text{innovation}-50}{50}\\quad\\Rightarrow\\quad \\chi\\to\\chi\\,(1-0.15\\,\\iota),\\qquad m\\to m\\,(1+0.25\\,\\iota)"
            }
          </Tex>
          <p className="exp-howto-cap">
            <strong>Innovation</strong> buys product capability. It lowers churn <Tex>{"\\chi"}</Tex>{" "}
            (better retention) and lifts per-user margin <Tex>{"m"}</Tex>. At the midpoint{" "}
            <Tex>{"\\iota=0"}</Tex> it is neutral; at full investment it cuts churn by about 15% and
            raises margin by about 25%.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\rho = 1 + (\\rho_{\\text{raw}}-1)\\big(1-0.6\\,\\tfrac{\\text{resilience}}{100}\\big),\\qquad \\rho_{\\text{raw}} = \\text{tpf}\\,(1+0.6\\,\\tfrac{\\text{reg}}{100})"
            }
          </Tex>
          <p className="exp-howto-cap">
            <strong>Resilience</strong> buys vendor independence (multi-vendor serving, open-weight
            fallbacks). It hedges the effective token multiplier <Tex>{"\\rho"}</Tex>: up to 60% of
            any price spike above today&rsquo;s level is absorbed, and it lowers lock-in risk
            directly. Note that regulatory pressure feeds into the raw multiplier{" "}
            <Tex>{"\\rho_{\\text{raw}}"}</Tex> as a compliance cost the vendor passes on.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "F \\to F\\,\\big(1 + 0.4\\,\\tfrac{\\text{innovation}}{100} + 0.2\\,\\tfrac{\\text{resilience}}{100}\\big)"
            }
          </Tex>
          <p className="exp-howto-cap">
            The cost of both bets: investing in innovation and resilience raises the fixed monthly
            cost <Tex>{"F"}</Tex>. Innovation is the more expensive of the two, so neither is free
            and over-investing can erase the margin it earns.
          </p>
        </div>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">Parameters</h3>
        <table className="exp-param-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Meaning</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {PARAMS.map((p) => (
              <tr key={p.sym}>
                <td className="exp-param-sym">
                  <Tex>{p.sym}</Tex>
                </td>
                <td>{p.meaning}</td>
                <td className="exp-param-val">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="exp-prose exp-howto-note">
          In the app, <Tex>{"Q"}</Tex> is the <strong>Strategy</strong> choice,{" "}
          <Tex>{"\\Delta m"}</Tex> is the <strong>Margin per customer</strong> lever, and{" "}
          <Tex>{"Q^{\\ast}"}</Tex> is the <strong>Quality threshold</strong>.
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">What decides winners and losers</h3>
        <p className="exp-prose">
          The conclusions hinge on a small set of parameters. The <strong>strategy levers</strong> are
          the ones the demo varies: <Tex>{"Q"}</Tex> (the quality choice) and <Tex>{"Q^{\\ast}"}</Tex>{" "}
          (where the market sets the bar), plus innovation and resilience. The{" "}
          <strong>calibration</strong> worth grounding in real data is the competition rate{" "}
          <Tex>{"\\varphi"}</Tex>, the acquisition cost <Tex>{"c_{\\mathrm{ac}}"}</Tex>, the fixed
          cost <Tex>{"F"}</Tex>, the churn-cliff shape and the margin slope <Tex>{"\\Delta m"}</Tex>.
          Everything else only scales magnitudes without changing the story.
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">Key findings</h3>
        <div className="exp-howto-findings">
          {FINDINGS.map((f, i) => (
            <div className="exp-howto-finding" key={f.h}>
              <span className="exp-howto-finding-num">{i + 1}</span>
              <div>
                <h4>{f.h}</h4>
                <p>{f.b}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="exp-howto-illus">
        Illustrative, not calibrated. Parameter values are plausible placeholders for strategy
        discussion. The cliff location, CAC, competition rate and fixed cost should be fit to real
        data before any number is taken literally.
      </p>
    </div>
  );
}
