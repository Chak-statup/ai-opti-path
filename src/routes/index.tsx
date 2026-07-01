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
              Scaling AI is a system of coupled decisions, not a single yes or no. Set your
              strategy, stress it against what you cannot control, and see which path survives.
            </p>
            <div className="lp-cta-row">
              <Link to="/evaluator" className="lp-cta-primary">
                To the Evaluator &rarr;
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-about">
          <details className="lp-about-details">
            <summary className="lp-section-title lp-about-summary">What the evaluator shows</summary>
            <p className="lp-about-body">
              An illustration, not a forecast: a live simulation of user growth (logistic growth
              with churn and competition) with a transparent euro P&amp;L on top. You set the
              strategy you control &mdash; quality tier, scaling, in-house build, vendor
              independence, platform reach &mdash; and the environment you don&rsquo;t (serving
              price, regulation). The evaluator traces the causal pathway, profiles the risks,
              flags tipping points, and proposes mitigations when a shock hits.
            </p>
            <p className="lp-about-body">
              Every axis is wired to a model variable: reach scales the market; in-house build
              raises delivered quality and ARPU; independence shields price spikes; scaling couples
              the ARPU premium with the quality bar &mdash; and burns more tokens; a premium tier
              serves on pricier frontier models. Margin is a lever; profit is the output, and it
              turns on retention as much as on price.
            </p>
          </details>
        </section>
      </main>

      <footer className="lp-footer">
        <p>© STAT-UP · for demo purposes only</p>
      </footer>
    </div>
  );
}
