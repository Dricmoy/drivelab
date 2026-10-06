import json

from fastapi.testclient import TestClient
import pytest

from drivelab.api import create_app


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "runs.db", tmp_path / "web", engine="numpy"))


def test_api_contract_and_sqlite_restart(tmp_path):
    db = tmp_path / "runs.db"
    client = TestClient(create_app(db, engine="numpy"))
    assert client.get("/api/health").json()["dataset_count"] == 0
    summaries = client.get("/api/scenarios").json()
    assert len(summaries) >= 6
    scenario = client.get("/api/scenarios/parked-car").json()
    assert set(scenario) == {"id", "name", "description", "source", "dt", "duration", "bounds", "road_polygons", "lanes", "route", "ego", "actors", "tags"}
    response = client.post("/api/runs", json={"scenario_id": "parked-car", "planner": "lattice"})
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["config"] == {"target_speed": 8., "safety_margin": 1., "horizon": 3., "prediction": "constant_velocity", "scoring": "auto"}
    for entry in summaries:
        scene = client.get(f'/api/scenarios/{entry["id"]}').json()
        for key in ("route", "road_polygons", "bounds"):
            assert entry[key] == scene[key]
    assert set(report) == {"id", "scenario_id", "planner", "config", "source", "engine", "scoring_backend", "timing", "metrics", "frames", "failures", "created_at"}
    timing = report['timing']
    assert 0 < timing['planning_seconds'] <= timing['total_seconds']
    assert timing['decisions'] == len(report['frames']) - 1
    assert timing['mean_decision_ms'] == pytest.approx(1000 * timing['planning_seconds'] / timing['decisions'])
    assert set(report["frames"][0]) == {"time", "ego", "actors", "actor_forecasts", "candidates", "selected_candidate", "explanation", "metrics"}
    assert set(report["frames"][0]["candidates"][0]) == {"id", "points", "cost", "feasible", "collision_cost", "offroad_cost", "progress_cost", "comfort_cost", "acceleration", "offset"}
    restarted = TestClient(create_app(db, engine="numpy"))
    assert restarted.get(f'/api/runs/{report["id"]}').json() == report
    assert restarted.get("/api/runs").json()[0] == {k: v for k, v in report.items() if k != "frames"}
    json.dumps(report, allow_nan=False)


@pytest.mark.parametrize("config", [{"target_speed": -1}, {"target_speed": 100}, {"safety_margin": -1}, {"safety_margin": 4}, {"horizon": 0}, {"horizon": 6}, {"horizon": "NaN"}, {"unknown": 1}])
def test_config_range_validation(client, config):
    assert client.post("/api/runs", json={"scenario_id": "clear-road", "planner": "lattice", "config": config}).status_code == 422


def test_invalid_planner_and_unknown_ids(client):
    assert client.post("/api/runs", json={"scenario_id": "clear-road", "planner": "magic"}).status_code == 422
    assert client.post("/api/runs", json={"scenario_id": "absent", "planner": "lattice"}).status_code == 404
    assert client.get("/api/runs/absent").status_code == 404
    assert client.get("/api/scenarios/absent").status_code == 404


def test_paired_evaluation_computes_summary(client):
    response = client.post("/api/evaluations", json={"scenario_ids": ["parked-car", "clear-road"]})
    assert response.status_code == 200, response.text
    evaluation = response.json()
    assert evaluation["source"] == "synthetic"
    for pair in evaluation["results"]:
        a, b = pair["baseline"], pair["lattice"]
        assert "frames" not in a and "frames" not in b
        full_a = client.get(f'/api/runs/{a["id"]}').json()
        full_b = client.get(f'/api/runs/{b["id"]}').json()
        assert full_a["frames"][0]["ego"] == full_b["frames"][0]["ego"]
        assert full_a["frames"][0]["actors"] == full_b["frames"][0]["actors"]
        assert a["config"] == b["config"]
    assert evaluation["summary"]["baseline"]["collision_rate"] == .5
    assert evaluation["summary"]["lattice"]["collision_rate"] == 0
    for planner in ("baseline", "lattice"):
        for aggregate, metric in (("collision_rate", "collision"), ("offroad_rate", "offroad"),
                                  ("progress", "progress"), ("max_jerk", "max_jerk")):
            average = sum(pair[planner]["metrics"][metric] for pair in evaluation["results"]) / 2
            assert evaluation["summary"][planner][aggregate] == pytest.approx(average)
        assert all(pair[planner]["config"] == {"target_speed": 8., "safety_margin": 1., "horizon": 3., "prediction": "constant_velocity", "scoring": "auto"}
                   for pair in evaluation["results"])
    assert client.get(f'/api/evaluations/{evaluation["id"]}').json() == evaluation


def test_evaluate_all_accepts_28_scenes_and_enforces_100_bound(client):
    from copy import deepcopy
    scenarios = client.app.state.scenarios
    for index in range(28 - len(scenarios)):
        scenario = deepcopy(scenarios["clear-road"])
        scenario.public["id"] = f"additional-synthetic-{index}"
        scenarios[scenario.public["id"]] = scenario
    # Short deterministic fixtures test the complete paired API flow and its
    # count bound. Full-duration outcome tests are separate.
    for scenario in scenarios.values():
        scenario.public["duration"] = .2
        scenario.actor_tracks = scenario.actor_tracks[:3]
    response = client.post("/api/evaluations", json={"scenario_ids": list(scenarios)})
    assert response.status_code == 200, response.text
    assert len(response.json()["results"]) == 28
    assert response.json()["summary"]["lattice"]["scenario_count"] == 28
    assert client.post("/api/evaluations", json={"scenario_ids": ["clear-road"] * 101}).status_code == 422


@pytest.mark.parametrize("limit", [0, 21, 1.5, "2", True])
def test_import_limit_validation(client, limit):
    assert client.post("/api/datasets/import", json={"path": "/missing", "limit": limit}).status_code == 422


def test_import_missing_and_invalid_data(client, tmp_path):
    response = client.post("/api/datasets/import", json={"path": str(tmp_path / "absent.tfrecord")})
    assert response.status_code == 400
    assert "existing local" in response.json()["detail"]
    empty = tmp_path / "empty.tfrecord"
    empty.touch()
    assert "empty" in client.post("/api/datasets/import", json={"path": str(empty)}).json()["detail"]
    assert client.get("/api/health").json()["dataset_count"] == 0


def test_static_spa_fallback_and_api_404(tmp_path):
    static = tmp_path / "dist"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>DriveLab test</html>")
    (static / "assets" / "app.js").write_text("console.log('test')")
    client = TestClient(create_app(tmp_path / "db", static, engine="numpy"))
    assert "DriveLab test" in client.get("/").text
    assert "DriveLab test" in client.get("/replay/some-id").text
    assert "console.log" in client.get("/assets/app.js").text
    assert client.get("/api/nonexistent").status_code == 404
    assert client.get("/assets/missing.js").status_code == 404
