# Scenario Evaluator — standalone (FastAPI + Tailwind/JS/CSS/HTML)

A framework-free port of the Lovable app. Same model, same design, no React /
TanStack / Vite build step.

```
standalone/
├── backend/
│   ├── main.py            FastAPI app (serves the data API + the static frontend)
│   ├── generate_data.py   regenerates data/runs.json (numpy, fixed seed)
│   └── requirements.txt
├── data/
│   └── runs.json          precomputed simulation dataset (3 strategies × 46 Q* × time)
└── frontend/
    ├── index.html         landing page (animated background chart)
    ├── evaluator.html     the Scenario Evaluator
    ├── css/styles.css     design system (exhibit + landing), ported from src/styles.css
    ├── js/
    │   ├── model.js       pure model arithmetic + strategy vector, risk, tipping
    │   │                  points and mitigation engine (port of model.ts)
    │   ├── linechart.js   hand-rolled SVG line chart (port of LineChart.tsx)
    │   ├── causal.js      interactive structural causal diagram (port of CausalDiagram.tsx)
    │   ├── radar.js       hand-rolled SVG risk radar (port of RadarChart.tsx)
    │   ├── axisicons.js   custom mono-stroke decision-axis icons
    │   ├── tex.js         KaTeX render helper for LaTeX symbols
    │   ├── evaluator.js   six-stage decision journey UI (port of evaluator.tsx)
    │   └── home.js        landing background chart (port of HomeChart.tsx)
    └── assets/            STAT UP logos (light + dark)
```

## The evaluator journey

The Scenario Evaluator is a six-stage guided journey, identical to the React app:

1. **Problem** — the strategic question and the four decision axes.
2. **Causal pathway** — live structural diagram + trajectory charts; move a lever
   or pick a scenario preset and watch the pathway and risks reshape.
3. **Risk profile** — five-axis radar per strategy against the status-quo baseline.
4. **Tipping points** — each risk against its critical threshold.
5. **Mitigation** — model-proposed strategy vectors with before/after comparison
   and a mocked AI advisory.
6. **Recommendation** — plain-language read, plus an optional Anthropic-powered
   advisory. The API key is used only in the browser, sent directly to Anthropic,
   and never stored, logged, or sent to the backend.

A floating **How it works** button opens the full model documentation (equations,
parameters, and the risk-factor → variable mapping) rendered with KaTeX.

## Run

```bash
cd standalone/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000

The FastAPI server serves the frontend statically and exposes:

- `GET /runs.json` (and `GET /api/runs`) — the simulation dataset
- `GET /api/health` — liveness probe

## Regenerate the data

```bash
cd standalone/backend
python generate_data.py   # writes ../data/runs.json
```

Model parameters live at the top of `generate_data.py`. The seed (12345) is
fixed so output is reproducible.

## Notes

- Tailwind is loaded via the Play CDN for quick utility classes; all
  exhibit-specific styling is plain CSS in `css/styles.css`. For production,
  swap the CDN for a compiled Tailwind build.
- KaTeX CSS is loaded from a CDN so Greek symbols (τ) render in the math font,
  matching the original app.
- The frontend uses native ES modules — no bundler required.
