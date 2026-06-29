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
    │   ├── model.js       pure model arithmetic (port of model.ts)
    │   ├── linechart.js   hand-rolled SVG line chart (port of LineChart.tsx)
    │   ├── evaluator.js   evaluator UI logic (port of evaluator.tsx)
    │   └── home.js        landing background chart (port of HomeChart.tsx)
    └── assets/            STAT UP logos (light + dark)
```

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
