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
            This is an illustration, not a forecast. It extends a simple word-of-mouth growth
            model into a guided decision journey. You set a strategy vector you have some control
            over for example: quality, margin per customer, in-house build and vendor
            independence, and an environment you do not (token price and regulatory pressure).
            The evaluator then traces the causal pathway, profiles each strategy&rsquo;s risks,
            flags the tipping points, and when a shock hits it proposes mitigations you can
            compare side by side.
          </p>
          <p className="lp-about-body">
            Every risk factor in the four decision axes is wired to a model variable. Platform
            reach scales the user base; vendor independence hedges token price spikes and
            lock-in; in-house build lifts margin and retention; scaling aggressiveness couples
            quality and margin slope. Regulatory pressure and token price factor are external
            shocks. The point: margin per user is an output of cost and user dynamics, not a lever,
            so the real question is which strategy holds up as the world changes.
          </p>
        </section>
      </main>

      <footer className="lp-footer">
        <p>© STAT-UP · for demo purpose only</p>
      </footer>
    </div>
  );
}
