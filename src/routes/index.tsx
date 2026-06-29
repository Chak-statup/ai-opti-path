import { createFileRoute, Link } from "@tanstack/react-router";
import { StatupLogo } from "@/components/StatupLogo";

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
          <span className="lp-logo">AI Strategy Tool</span>
          <nav className="lp-nav-links">
            <Link to="/evaluator" className="lp-nav-link">
              Explorer
            </Link>
            <Link to="/simulator" className="lp-nav-link">
              Simulator
            </Link>
          </nav>
        </div>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <h1 className="lp-hero-title">
            Which AI operating model should you choose before costs, dependencies, and expectations become impossible to reverse?
          </h1>
          <p className="lp-hero-lead">
            A large corporation is deciding how aggressively to scale AI over the next 12–18 months
            through many AI-powered applications used internally, by customers, or by partners.
            One path builds quickly on frontier-model providers. Another relies on open-source or
            locally hosted models. A third is a hybrid, routing different use cases to different
            providers depending on cost, quality, data sensitivity, and strategic importance.
          </p>
          <div className="lp-cta-row">
            <Link to="/evaluator" className="lp-cta-primary">
              Open the Scenario Explorer
            </Link>
          </div>
        </section>

        <section className="lp-strategies">
          <h2 className="lp-section-title">Three operating models</h2>
          <div className="lp-cards">
            <div className="lp-card">
              <div className="lp-card-swatch" style={{ background: "var(--exp-open)" }} />
              <h3 className="lp-card-title">Open</h3>
              <p className="lp-card-q">Quality Q = 0.3</p>
              <p className="lp-card-body">
                Open-source or locally hosted models. Lowest cost, lowest baseline quality.
                Churn risk is high unless quality exceeds the threshold.
              </p>
            </div>
            <div className="lp-card">
              <div className="lp-card-swatch" style={{ background: "var(--exp-hybrid)" }} />
              <h3 className="lp-card-title">Hybrid</h3>
              <p className="lp-card-q">Quality Q = 0.6</p>
              <p className="lp-card-body">
                Route use cases to frontier or local models by sensitivity and importance.
                Balanced cost and quality with flexible vendor exposure.
              </p>
            </div>
            <div className="lp-card">
              <div className="lp-card-swatch" style={{ background: "var(--exp-frontier)" }} />
              <h3 className="lp-card-title">Frontier</h3>
              <p className="lp-card-q">Quality Q = 0.9</p>
              <p className="lp-card-body">
                Build on major AI platforms. Highest quality and lowest churn, but highest
                cost and deepest vendor dependency.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-about">
          <h2 className="lp-section-title">What the explorer shows</h2>
          <p className="lp-about-body">
            The scenario explorer is a consulting-grade analytical instrument. It reads
            precomputed user trajectories and derives money curves with pure arithmetic — no
            simulation at runtime. Two sliders control the model: margin slope (Δm) and churn
            quality threshold (Q*). Four trajectory panels show active users, operating margin,
            cost, and net profit over a generic time horizon. A fifth panel sweeps cumulative
            profit across every quality threshold. The exhibit is designed for live executive
            review: precise, restrained, and instantly responsive.
          </p>
        </section>
      </main>

      <footer className="lp-footer">
        <p>Interactive decision-intelligence demo · built for live executive review</p>
      </footer>
    </div>
  );
}
