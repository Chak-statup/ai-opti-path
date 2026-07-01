import { Tex } from "./Tex";

type ParamRow = { sym: string; meaning: string; value: string };

const PARAMS: ParamRow[] = [
  { sym: "N(t)", meaning: "Active users — the single simulated state", value: "—" },
  { sym: "Q", meaning: "Quality = strategy (the decision)", value: "0.3 / 0.6 / 0.9" },
  { sym: "K", meaning: "Addressable market (set by platform reach)", value: "0.2M – 1.5M" },
  { sym: "N_0", meaning: "Initial active users", value: "4,000" },
  { sym: "p", meaning: "External acquisition rate", value: "0.008 / mo" },
  { sym: "r", meaning: "Word-of-mouth growth rate", value: "0.35 / mo" },
  { sym: "\\chi_{\\min},\\,\\chi_{\\max}", meaning: "Churn floor / ceiling", value: "0.02 / 0.30 / mo" },
  { sym: "\\kappa", meaning: "Churn-cliff steepness", value: "12" },
  { sym: "Q^{\\ast}", meaning: "Churn threshold, cliff location (set by scaling)", value: "0.1 – 1.0" },
  { sym: "a_0,\\,\\Delta m", meaning: "Base ARPU, scaling premium slope", value: "€9, up to €12 /user/mo" },
  { sym: "s_0", meaning: "Serving (token) cost / user at price ×1, Balanced tier", value: "€2.5 /user/mo" },
  { sym: "1+2.0(Q-0.6)", meaning: "Tier serving factor (which models you run)", value: "×0.4 / ×1.0 / ×1.6" },
  { sym: "c_{\\mathrm{ac}}", meaning: "Blended cost per gross acquired user", value: "€20" },
  { sym: "\\varphi", meaning: "Peak competitive-loss rate", value: "0.35 / mo" },
  { sym: "\\sigma", meaning: "Demand volatility", value: "0.16" },
  { sym: "F_0", meaning: "Base fixed cost per month (+ investments)", value: "€0.4M / mo" },
  { sym: "\\tau", meaning: "Deployment to revenue lag", value: "6 mo" },
  { sym: "T", meaning: "Horizon", value: "54 mo" },
];

const FINDINGS = [
  {
    h: "Users are not monotone",
    b: "With competition, every strategy rises, peaks, then declines. There is no permanent plateau and no guaranteed-growing base.",
  },
  {
    h: "Strategies can lose money",
    b: "A low-quality strategy pays the blended acquisition cost for every user the growth engine adds while churn drains them straight back out — a paid leaky bucket that destroys value even while the user count looks alive.",
  },
  {
    h: "There is a critical threshold",
    b: "Commit to a quality bar Q* above your actual quality Q and churn accelerates past a cliff — cumulative profit turns negative.",
  },
  {
    h: "Retention beats margin",
    b: "The per-user ARPU lift from quality is the minor channel. Keeping users — low churn compounds the paying base every month — is the dominant one, which is why in-house build pays.",
  },
];

export function HowItWorks() {
  return (
    <div className="exp-howto">
      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">What the model is for</h3>
        <p className="exp-prose">
          A compact dynamical model of how AI product strategy drives the user base and profit over a
          54-month horizon. It is built for strategy discussion, not engineering: there is one state
          variable, the active user count <Tex>{"N(t)"}</Tex>, <em>simulated live in the browser</em>,
          and product quality is a <em>chosen</em> input. Every other lever acts on the same simulated
          trajectory or on the euro P&amp;L netted on top of it, so moving a slider genuinely reshapes
          the curves rather than rescaling a fixed one.
        </p>
        <p className="exp-prose">
          The quality tier is reduced to a single number <Tex>{"Q\\in[0,1]"}</Tex>: Lean{" "}
          <Tex>{"\\approx 0.3"}</Tex>, Balanced <Tex>{"\\approx 0.6"}</Tex>, Premium{" "}
          <Tex>{"\\approx 0.9"}</Tex>.
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">The equations</h3>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "dN = \\Big[\\, p(K-N) + rN\\big(1-\\tfrac{N}{K}\\big) - \\chi\\,N - \\varphi\\tfrac{t}{T}\\,N \\,\\Big]dt + \\sigma N\\sqrt{dt}\\,dW"
            }
          </Tex>
          <p className="exp-howto-cap">
            User dynamics, integrated live (Euler–Maruyama): acquisition (external marketing plus
            word-of-mouth, saturating at the addressable market <Tex>{"K"}</Tex>) minus losses (churn
            plus competition), with a state-proportional demand-noise term so each run is a scenario,
            not a single prophecy. <strong>Platform reach sets <Tex>{"K"}</Tex></strong>.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\chi=\\chi_{\\min}+\\frac{\\chi_{\\max}-\\chi_{\\min}}{1+e^{\\,\\kappa(Q_{\\mathrm{eff}}-Q^{\\ast})}}\\qquad Q_{\\mathrm{eff}}=Q-\\Delta q_{\\mathrm{scen}}+0.15\\,\\iota\\qquad m=(a_0+\\Delta m\\,Q_{\\mathrm{scen}})\\big(1+0.20\\,\\iota\\big)"
            }
          </Tex>
          <p className="exp-howto-cap">
            Churn responds to <strong>one</strong> quality — the quality users actually experience{" "}
            <Tex>{"Q_{\\mathrm{eff}}"}</Tex>: the chosen tier <Tex>{"Q"}</Tex>, shifted <em>down</em> by
            scenarios that trade quality for cost (<Tex>{"\\Delta q_{\\mathrm{scen}}"}</Tex>, e.g.
            adopting open-source models) and lifted by in-house build <Tex>{"\\iota"}</Tex> (up to
            +0.15, about half a tier) — through a threshold cliff at <Tex>{"Q^{\\ast}"}</Tex>. That is
            why building in-house can genuinely climb back over the bar after a quality-losing
            scenario. ARPU <Tex>{"m"}</Tex> is priced on the scenario quality and lifted separately by
            build; it is a <strong>lever</strong>, not an output.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\Pi(t)=\\underbrace{\\Theta(t-\\tau)\\,m\\,N}_{\\text{revenue}}-\\underbrace{s\\,N}_{\\text{serving}}-\\underbrace{c_{\\mathrm{ac}}\\big[p(K-N)+rN(1-\\tfrac{N}{K})\\big]}_{\\text{acquisition}}-\\underbrace{F}_{\\text{fixed}}"
            }
          </Tex>
          <p className="exp-howto-cap">
            Profit flow, in euros: revenue (ARPU × users, earned only after the deployment lag{" "}
            <Tex>{"\\tau"}</Tex>) minus the serving cost of every active user, minus the blended
            acquisition cost <Tex>{"c_{\\mathrm{ac}}"}</Tex> of every gross user the growth equation
            actually adds — growing the base costs real money — minus fixed cost. Cumulative profit
            is the time-integral of <Tex>{"\\Pi(t)"}</Tex> over the horizon.
          </p>
        </div>

        <p className="exp-prose exp-howto-note">
          Where price acts: the per-user serving cost is{" "}
          <Tex>{"s=s_0\\,\\big(1+2.0\\,(Q-0.6)\\big)\\big(1+0.4\\,\\tfrac{\\Delta m}{12}\\big)\\,\\rho"}</Tex>{" "}
          — the token cost of goods. The tier factor prices which models you run (Lean ×0.4, Balanced
          ×1.0, Premium ×1.6 — a premium product serves on pricier frontier models), aggressive
          scaling burns more tokens per user (up to +40%), and <Tex>{"\\rho"}</Tex> is the vendor's
          price factor after your hedge. A <em>pricing shock</em> is a temporal event:{" "}
          <Tex>{"\\rho"}</Tex> stays at today's ×1 until the shock month, then steps up to the new
          level and stays there. Regulation does not touch <Tex>{"s"}</Tex>; it is a distinct
          fixed-cost load (below).
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">The strategy levers and the environment</h3>
        <p className="exp-prose">
          Beyond the quality tier, three company-level levers act on the same trajectory, each with a
          documented, comparable effect and a real trade-off. Two external variables act on the
          economics — and a scenario can additionally trade quality for cost: adopting open-source
          models halves the serving price but shifts the delivered quality{" "}
          <Tex>{"Q_{\\mathrm{eff}}"}</Tex> down, so retention pays for the cheaper serving.
        </p>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "\\iota=\\tfrac{\\text{build}}{100}\\Big(1-0.40\\,\\tfrac{\\text{reg}}{100}\\Big)\\qquad h=0.70\\,\\tfrac{\\text{resil}}{100},\\quad \\rho=(1-h)\\,\\text{tpf}+h\\;\\;(\\text{tpf}>1)"
            }
          </Tex>
          <p className="exp-howto-cap">
            <strong>In-house build</strong> <Tex>{"\\iota"}</Tex> buys product capability — it raises
            the quality users experience (up to +0.15, cutting churn through the cliff) and lifts ARPU
            (up to 20%) — but regulation drags its delivered effect down (compliance eats cycles).{" "}
            <strong>Vendor independence</strong> is the share{" "}
            <Tex>{"h"}</Tex> of serving you can run on cheaper alternatives (up to 70% at full). Your
            blended serving price <Tex>{"\\rho"}</Tex> pays that share at today&rsquo;s ×1 and the rest
            at the vendor&rsquo;s price — so a vendor tripling its price only lifts your cost to{" "}
            <Tex>{"0.3\\times3+0.7=1.6\\times"}</Tex> at full independence.
          </p>
        </div>

        <div className="exp-howto-eq">
          <Tex block>
            {
              "F = F_0 + F_{\\iota}\\tfrac{\\text{build}}{100} + F_{\\rho}\\tfrac{\\text{resil}}{100} + F_{\\text{reg}}\\tfrac{\\text{reg}}{100}\\big(1-\\text{buffer}\\big)"
            }
          </Tex>
          <p className="exp-howto-cap">
            The cost of the bets: every investment raises fixed cost — in-house build{" "}
            <Tex>{"F_{\\iota}=\\text{€0.5M/mo}"}</Tex>, vendor independence{" "}
            <Tex>{"F_{\\rho}=\\text{€0.15M/mo}"}</Tex> at full — and <strong>regulation</strong> adds a
            compliance overhead <Tex>{"F_{\\text{reg}}=\\text{€0.3M/mo}"}</Tex> that resilience and
            in-house build partly buy down. Platform reach separately sets the market{" "}
            <Tex>{"K"}</Tex>.
          </p>
        </div>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">From risk factors to model variables</h3>
        <p className="exp-prose">
          The four strategic decisions each carry specific risks, and each is translated into a model
          lever so you can stress it numerically. (Softer factors — reputation, talent, tech debt,
          governance — are named on the problem page but not quantified in this illustration.)
        </p>
        <div className="exp-howto-eq">
          <p className="exp-howto-cap">
            <strong>Platform ecosystem.</strong> Shipping at scale exposes you to serving-price spikes
            and exit costs. <strong>Platform reach</strong> sets the addressable market{" "}
            <Tex>{"K"}</Tex>: a wider reach grows the base and revenue but magnifies serving-cost
            exposure when the price rises.
          </p>
        </div>
        <div className="exp-howto-eq">
          <p className="exp-howto-cap">
            <strong>Vendor choice.</strong> Betting on one hyperscaler creates pricing-sovereignty and
            lock-in risk. <strong>Vendor independence</strong> shields the serving multiplier{" "}
            <Tex>{"\\rho"}</Tex> (up to 70% of a spike) and lowers lock-in. The token price is an
            external per-user cost; regulation is a separate load, so the two never collapse into one
            knob.
          </p>
        </div>
        <div className="exp-howto-eq">
          <p className="exp-howto-cap">
            <strong>Build versus buy.</strong> In-house capability costs talent and time, but it
            raises retention and margin. <strong>In-house build</strong> <Tex>{"\\iota"}</Tex> raises
            the delivered quality <Tex>{"Q_{\\mathrm{eff}}"}</Tex> by up to 0.15{" "}
            <em>in the simulated trajectory</em> — churn falls through the same cliff — and lifts ARPU{" "}
            <Tex>{"m"}</Tex> by up to 20%, at a higher fixed cost. It is also the honest response when
            a scenario (open-source adoption) cuts delivered quality below the committed bar.
          </p>
        </div>
        <div className="exp-howto-eq">
          <p className="exp-howto-cap">
            <strong>Scaling strategy.</strong> Aggressive scaling means higher margin per customer and
            a higher committed bar, but a steeper cliff if the market bar moves past your quality. One
            dial couples the <strong>ARPU premium</strong> <Tex>{"\\Delta m"}</Tex> and the{" "}
            <strong>quality bar</strong> <Tex>{"Q^{\\ast}"}</Tex>: turning it up raises short-run
            revenue but also burns more tokens per user (serving cost up to +40%) and raises the
            tipping-point risk.
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
          In the app, <Tex>{"Q"}</Tex> is the <strong>Strategy</strong> choice; the{" "}
          <strong>Scaling</strong> dial moves the ARPU premium <Tex>{"\\Delta m"}</Tex> and the quality
          bar <Tex>{"Q^{\\ast}"}</Tex> together. Per-user ARPU is a lever; it is <em>not</em> customer
          lifetime value (CLV would be roughly <Tex>{"m/\\chi"}</Tex>, which the model does not report).
        </p>
      </section>

      <section className="exp-howto-sec">
        <h3 className="exp-howto-h">What decides winners and losers</h3>
        <p className="exp-prose">
          The conclusions hinge on a small set of parameters. The <strong>strategy levers</strong> the
          demo varies are the quality choice <Tex>{"Q"}</Tex>, the scaling dial (<Tex>{"\\Delta m"}</Tex>{" "}
          and <Tex>{"Q^{\\ast}"}</Tex>), in-house build, vendor independence and platform reach. The{" "}
          <strong>calibration</strong> worth grounding in real data is the competition rate{" "}
          <Tex>{"\\varphi"}</Tex>, the acquisition cost <Tex>{"c_{\\mathrm{ac}}"}</Tex>, the serving
          cost <Tex>{"s_0"}</Tex>, the fixed cost, the churn-cliff shape and the ARPU slope{" "}
          <Tex>{"\\Delta m"}</Tex>. Everything else only scales magnitudes without changing the story.
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
        Every parameter is sourced in <code>docs/references.md</code> (citation-audited). Serving cost,
        ARPU, CAC, the Bass growth coefficients, the churn floor, fixed/compliance cost and the
        vendor-hedge share are grounded in real data; the quality index, the in-house-build effects,
        and the worst-case ceilings (churn 30%/mo, competition 0.35/mo, regulatory drag 40%) are
        stated assumptions or stress bounds to be fit to your data. Euro figures are illustrative
        large-enterprise scale, not a specific company.
      </p>
    </div>
  );
}
