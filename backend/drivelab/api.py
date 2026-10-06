import os
from pathlib import Path
import uuid

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np

from . import __version__
from .models import RunRequest, EvaluationRequest, ImportRequest, TrainingRequest
from .scenarios import synthetic_scenarios
from .simulation import simulate
from .store import Store
from .waymax_adapter import available, import_dataset, DatasetError
from .native_scoring import available as native_available

ROOT = Path(__file__).resolve().parents[2]


def create_app(db_path=None, static_dir=None, engine="auto", forecast_path=None):
    app = FastAPI(title="DriveLab", version=__version__)
    store = Store(db_path or os.environ.get("DRIVELAB_DB", str(ROOT / "data" / "drivelab.sqlite3")))
    scenarios = synthetic_scenarios()
    scenarios.update({s.public["id"]: s for s in store.load_scenarios()})
    app.state.store, app.state.scenarios = store, scenarios
    checkpoint = Path(forecast_path or os.environ.get("DRIVELAB_FORECAST_PATH", str(ROOT / "data" / "models" / "forecast.pt")))

    @app.get("/api/model")
    def model_status():
        try:
            from .forecast import status
            return status(checkpoint)
        except ImportError:
            return dict(available=False, trained=False, source="synthetic-motion")

    @app.post("/api/model/train")
    def train_motion(request: TrainingRequest):
        try:
            from .forecast import train_model
            return train_model(checkpoint, seed=request.seed, epochs=request.epochs)
        except (ImportError, RuntimeError) as exc:
            raise HTTPException(503, "PyTorch is missing. Run make ml in the project directory.") from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    def summary(scenario):
        return {k: scenario.public[k] for k in ("id", "name", "description", "source", "duration", "tags", "route", "road_polygons", "bounds")}

    def scenario_by_id(id):
        if id not in scenarios:
            raise HTTPException(404, "Scenario not found")
        return scenarios[id]

    @app.get("/api/health")
    def health():
        return dict(status="ok", waymax_available=available(), native_available=native_available(), dataset_count=sum(s.public["source"] == "waymo-open-motion" for s in scenarios.values()), version=__version__)

    @app.get("/api/scenarios")
    def list_scenarios():
        return [summary(s) for s in scenarios.values()]

    @app.get("/api/scenarios/{id}")
    def get_scenario(id: str):
        return scenario_by_id(id).public

    @app.post("/api/runs")
    def run(request: RunRequest):
        scenario = scenario_by_id(request.scenario_id)
        try:
            report = simulate(scenario, request.planner, request.config, engine=engine, forecast_checkpoint=checkpoint)
        except (ValueError, ImportError) as exc:
            raise HTTPException(503, str(exc)) from exc
        store.save_run(report)
        return report

    @app.get("/api/runs")
    def runs(limit: int = Query(default=50, ge=1, le=100)):
        return store.list_runs(limit)

    @app.get("/api/runs/{id}")
    def get_run(id: str):
        report = store.get_run(id)
        if report is None:
            raise HTTPException(404, "Run not found")
        return report

    @app.post("/api/evaluations")
    def evaluate(request: EvaluationRequest):
        ids = list(dict.fromkeys(request.scenario_ids))
        selected = [scenario_by_id(id) for id in ids]
        results = []
        for scenario in selected:
            pair = dict(scenario_id=scenario.public["id"])
            for planner in ("baseline", "lattice"):
                try:
                    report = simulate(scenario, planner, request.config, engine=engine, forecast_checkpoint=checkpoint)
                except (ValueError, ImportError) as exc:
                    raise HTTPException(503, str(exc)) from exc
                store.save_run(report)
                pair[planner] = store.summarize_run(report)
            results.append(pair)
        summary_metrics = {}
        for planner in ("baseline", "lattice"):
            metrics = [pair[planner]["metrics"] for pair in results]
            summary_metrics[planner] = {key: float(np.mean([m[key] for m in metrics])) for key in metrics[0]}
            summary_metrics[planner].update(collision_rate=summary_metrics[planner]["collision"],
                                            offroad_rate=summary_metrics[planner]["offroad"],
                                            success_rate=float(np.mean([not m["collision"] and not m["offroad"] for m in metrics])),
                                            scenario_count=len(metrics))
        sources = sorted({s.public["source"] for s in selected})
        evaluation = dict(id=uuid.uuid4().hex, source=", ".join(sources), results=results, summary=summary_metrics)
        store.save_evaluation(evaluation)
        return evaluation

    @app.get("/api/evaluations/{id}")
    def get_evaluation(id: str):
        result = store.get_evaluation(id)
        if result is None:
            raise HTTPException(404, "Evaluation not found")
        return result

    @app.post("/api/datasets/import")
    def import_local(request: ImportRequest):
        try:
            imported = import_dataset(request.path, request.limit)
        except DatasetError as exc:
            raise HTTPException(400, str(exc)) from exc
        store.save_scenarios(imported)
        scenarios.update({s.public["id"]: s for s in imported})
        return dict(imported=len(imported), scenarios=[summary(s) for s in imported],
                    source=", ".join(sorted({s.public["source"] for s in imported})))

    static_path = Path(static_dir) if static_dir else ROOT / "web" / "dist"
    if (static_path / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "API endpoint not found")
        target = (static_path / path).resolve()
        if not target.is_relative_to(static_path.resolve()):
            raise HTTPException(404, "Not found")
        if target.is_file():
            return FileResponse(target)
        index = static_path / "index.html"
        if not index.is_file():
            raise HTTPException(503, "Frontend is not built. Run npm run build in web/.")
        return FileResponse(index)

    return app


app = create_app()


def main():
    import uvicorn
    uvicorn.run("drivelab.api:app", host="127.0.0.1", port=8765)
