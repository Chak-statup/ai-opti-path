import { createFileRoute, Link } from "@tanstack/react-router";
import { StatupLogo } from "@/components/StatupLogo";
import { HomeChart } from "@/components/scenario/HomeChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Strategy Tool, Decision Intelligence" },
      {
        name: "description",
        content:
          "An interactive scenario explorer for the economics of AI product strategy.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo exp-logo-link" aria-label="STAT UP home">
            <StatupLogo />
          </Link>
          <nav className="lp-nav-links">
            <Link to="/" className="lp-nav-link">
              Home
            </Link>
            <Link to="/evaluator" className="lp-nav-link">
              Evaluator
            </Link>
          </nav>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true">
            <HomeChart />
          </div>
          <div className="lp-hero-content">
            <p className="lp-steps">Frame, Simulate, Decide</p>
            <h1 className="lp-hero-title">
              Scenario Evaluator
            </h1>
            <p className="lp-hero-lead">
              AI Product economics. Scaling AI is a system of coupled decisions, not a single
              yes or no. Set your strategy, stress it against the things you cannot control, and
              see which path survives.
            </p>
            <div className="lp-cta-row">
              <Link to="/evaluator" className="lp-cta-primary">
                To the Evaluator &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-about">
          <h2 className="lp-section-title">What the evaluator shows</h2>
          <p className="lp-about-body">
            This is an illustration, not a forecast. It runs a live simulation of user growth
            (logistic growth with churn and competition) and nets a transparent euro P&amp;L on top.
            You set a strategy vector you control &mdash; quality, scaling aggressiveness, in-house
            build, vendor independence and platform reach &mdash; and an environment you do not
            (the vendor&rsquo;s serving price and regulatory pressure). The evaluator then traces the
            causal pathway, profiles each strategy&rsquo;s risks, flags the tipping points, and when
            a shock hits it proposes mitigations you can compare side by side.
          </p>
          <p className="lp-about-body">
            Each decision axis is wired to a model variable. Platform reach scales the addressable
            market and the user base; in-house build lowers churn in the trajectory and lifts ARPU;
            vendor independence shields serving-price spikes and lock-in; scaling aggressiveness
            couples the per-user ARPU premium with the quality bar. Token price is the per-user
            serving cost; regulation is a distinct load that raises fixed compliance cost and slows
            innovation. Per-user margin (ARPU) is a genuine lever &mdash; the <em>output</em> is
            profit, and it turns on retention as much as on price, so the real question is which
            strategy holds up as the world changes.
          </p>
        </section>
      </main>

      <footer className="lp-footer">
        <p>© STAT-UP · for demo purpose only</p>
      </footer>
    </div>
  );
}
