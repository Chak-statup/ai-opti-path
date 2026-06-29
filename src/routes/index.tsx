import { createFileRoute, Link } from "@tanstack/react-router";
import { StatupLogo } from "@/components/StatupLogo";
import { HomeChart } from "@/components/scenario/HomeChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Strategy Tool — Decision Intelligence" },
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
            <p className="lp-steps">Plan, Evaluate, Decide</p>
            <h1 className="lp-hero-title">
              Scenario Evaluator
            </h1>
            <p className="lp-hero-lead">
              AI Product economics. There are many paths to scaling AI. Here you
              can simulate each one and make a better-informed decision.
            </p>
            <div className="lp-cta-row">
              <Link to="/evaluator" className="lp-cta-primary">
                To Evaluator &gt;
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-about">
          <h2 className="lp-section-title">What the evaluator shows</h2>
          <p className="lp-about-body">
            This is an illustration, not a forecast. It extends a simple
            word-of-mouth growth model to simulate the different dynamics each
            strategy can produce. Two knobs drive everything: Strategy and Margin
            per user. Adjust them to see how active users, margin, cost and
            revenue respond, and which strategy comes out ahead.
          </p>
        </section>
      </main>

      <footer className="lp-footer">
        <p>Interactive decision-intelligence demo, built for live executive review</p>
      </footer>
    </div>
  );
}
