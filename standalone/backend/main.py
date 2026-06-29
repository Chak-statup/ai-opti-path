"""
Scenario Evaluator — FastAPI backend.

Serves:
  - GET /api/runs            the precomputed runs.json simulation dataset
  - GET /api/health          liveness probe
  - the static frontend (HTML + Tailwind + JS + CSS) at /

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"
RUNS_FILE = DATA_DIR / "runs.json"

app = FastAPI(title="Scenario Evaluator API", version="1.0.0")


@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.get("/api/runs")
def runs() -> FileResponse:
    """Return the precomputed simulation dataset."""
    return FileResponse(RUNS_FILE, media_type="application/json")


# Backwards-compatible alias so the frontend can fetch /runs.json directly.
@app.get("/runs.json")
def runs_json() -> FileResponse:
    return FileResponse(RUNS_FILE, media_type="application/json")


# Serve the static frontend (index.html, evaluator.html, css/, js/, assets/).
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
