"""Exercise genuine training and prediction selection across the API boundary."""
import pytest
from fastapi.testclient import TestClient

from drivelab.api import create_app


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(db_path=tmp_path / "runs.sqlite3", engine="numpy",
                                 forecast_path=tmp_path / "model.pt"))


def test_learned_run_requires_a_checkpoint_and_unknown_modes_are_rejected(client):
    status = client.get("/api/model").json()
    assert not status["trained"]
    response = client.post("/api/runs", json={"scenario_id": "parked-car", "config": {"prediction": "learned"}})
    assert response.status_code == 503
    assert "Train" in response.json()["detail"]
    assert client.post("/api/runs", json={"scenario_id": "parked-car", "config": {"prediction": "oracle"}}).status_code == 422


def test_train_and_run_and_reload_checkpoint_via_api(client, tmp_path):
    pytest.importorskip("torch")
    response = client.post("/api/model/train", json={"seed": 42, "epochs": 80})
    assert response.status_code == 200, response.text
    trained = response.json()
    assert trained["source"] == "synthetic-motion"
    assert trained["train_trajectories"] == 512
    assert trained["validation_trajectories"] == 256
    assert set(trained["train_seeds"]).isdisjoint(trained["validation_seeds"])
    assert trained["metrics"]["learned_ade"] < trained["metrics"]["baseline_ade"]
    assert trained["metrics"]["learned_fde"] < trained["metrics"]["baseline_fde"]
    ready = client.get("/api/model").json()
    assert ready["trained"] and ready["metrics"] == trained["metrics"]
    run = client.post("/api/runs", json={"scenario_id": "turning-traffic", "config": {"prediction": "learned"}})
    assert run.status_code == 200, run.text
    report = run.json()
    assert report["config"]["prediction"] == "learned"
    assert len(report["frames"]) > 50
    assert "learned" in report["frames"][0]["explanation"].lower()
    assert client.get(f'/api/runs/{report["id"]}').json() == report
    cv = client.post("/api/runs", json={"scenario_id": "turning-traffic"}).json()
    # First observation has no history, so forecasting safely starts as CV.
    assert cv["frames"][0]["candidates"] == report["frames"][0]["candidates"]
    # Once turning is observed, learned positions change real candidate costs.
    assert cv["frames"][1]["ego"] == report["frames"][1]["ego"]
    assert cv["frames"][1]["actors"] == report["frames"][1]["actors"]
    assert cv["frames"][1]["candidates"] != report["frames"][1]["candidates"]
    restarted = TestClient(create_app(db_path=tmp_path / "runs.sqlite3", engine="numpy",
                                      forecast_path=tmp_path / "model.pt"))
    assert restarted.get("/api/model").json()["metrics"] == ready["metrics"]


@pytest.mark.parametrize("payload", [{"epochs": 0}, {"epochs": True}, {"seed": -1}, {"seed": "42"}, {"epochs": 1000}])
def test_training_inputs_are_bounded_and_strict(client, payload):
    assert client.post("/api/model/train", json=payload).status_code == 422


def test_missing_torch_is_actionable(client, monkeypatch):
    from drivelab import forecast

    def missing(*args, **kwargs):
        raise RuntimeError("Optional PyTorch dependency is not installed")

    monkeypatch.setattr(forecast, "train_model", missing)
    response = client.post("/api/model/train", json={})
    assert response.status_code == 503
    assert "make ml" in response.json()["detail"]
