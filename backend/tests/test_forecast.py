from copy import deepcopy
import inspect
import math

import numpy as np
import pytest

from drivelab import forecast
from drivelab.planner import predict_actors


def actor(x=0., y=0., speed=10., yaw=0., id="a", **extra):
    return dict(id=id, x=x, y=y, speed=speed, yaw=yaw, valid=True, length=4.6, width=1.85, **extra)


def history(speed=10., acceleration=1., yaw_rate=.2, yaw=0., x=0., y=0.):
    return [[actor(x=x + speed * t, y=y, speed=speed + acceleration * t, yaw=yaw + yaw_rate * t)]
            for t in np.arange(-4, 1) * .1]


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    pytest.importorskip("torch")
    path = tmp_path_factory.mktemp("forecast") / "forecast.pt"
    return path, forecast.train_model(path)


def test_real_training_and_disjoint_trajectory_holdout(trained):
    path, metrics = trained
    assert path.is_file()
    assert metrics["source"] == "synthetic-motion"
    assert "no real dataset" in metrics["training_description"]
    assert set(metrics["train_seeds"]).isdisjoint(metrics["validation_seeds"])
    assert metrics["train_trajectories"] == len(metrics["train_seeds"]) == 512
    assert metrics["validation_trajectories"] == len(metrics["validation_seeds"]) == 256
    assert metrics["train_samples"] == 512 * 50
    assert metrics["validation_samples"] == 256 * 50
    assert 0 < metrics["training_seconds"] < 30
    assert metrics["learned"]["ade"] < metrics["baseline"]["ade"] * .5
    assert metrics["learned"]["fde"] < metrics["baseline"]["fde"] * .5
    for group in ("accelerating", "turning", "accelerating_and_turning"):
        results = metrics["groups"][group]
        assert results["learned"]["ade"] < results["baseline"]["ade"]
    for group in ("stationary", "constant_velocity"):
        assert metrics["groups"][group]["learned"] == metrics["groups"][group]["baseline"]
    ready = forecast.status(path)
    assert ready["available"] and ready["trained"] and ready["metrics"] == metrics["metrics"]
    assert ready["seed"] == metrics["seed"] and ready["epochs"] == metrics["epochs"]


def test_metrics_recomputed_from_checkpoint_without_hardcoded_scores(trained):
    torch = pytest.importorskip("torch")
    path, metrics = trained
    data = forecast._synthetic_trajectories(metrics["validation_seeds"])
    model, _ = forecast._load_model(path)
    with torch.inference_mode():
        residual = forecast._residual_prediction(model, torch.from_numpy(data["features"].reshape(-1, 4)),
                                               torch.from_numpy(data["scale"].reshape(-1, 2))).numpy().reshape(-1, 50, 2)
    result = data["baseline"] + residual
    assert forecast._errors(result, data["future"]) == metrics["learned"]
    assert forecast._errors(data["baseline"], data["future"]) == metrics["baseline"]


def test_public_inference_matches_report_on_all_heldout_trajectories(trained):
    path, metrics = trained
    data = forecast._synthetic_trajectories(metrics["validation_seeds"])
    # Reconstruct observed histories from the generated trajectory's current
    # speed and constant past derivatives. The public API gets no future labels.
    speed = data["features"][:, 0, 0].astype(float) * 20
    acceleration = data["features"][:, 0, 1].astype(float) * 3
    yaw_rate = data["features"][:, 0, 2].astype(float) * .5
    frames = [[actor(id=str(i), x=float(speed[i] * t), speed=float(speed[i] + acceleration[i] * t),
                     yaw=float(yaw_rate[i] * t)) for i in range(len(speed))]
              for t in np.arange(-4, 1) * .1]
    predictions = forecast.predict_actors_history(frames[-1], frames, np.arange(1, 51) * .1, path)
    coordinates = np.array([np.stack((a["x"], a["y"]), -1) for a in predictions])
    measured = forecast._errors(coordinates, data["future"])
    assert measured["ade"] == pytest.approx(metrics["metrics"]["learned_ade"], abs=1e-5)
    assert measured["fde"] == pytest.approx(metrics["metrics"]["learned_fde"], abs=1e-5)


@pytest.mark.parametrize("horizon", [1, 2, 3, 4, 5])
def test_inference_from_observations_improves_accelerated_turning_case(trained, horizon):
    frames = history()
    times = np.arange(1, horizon * 10 + 1) * .1
    prediction = forecast.predict_actors_history(frames[-1], frames, times, trained[0])[0]
    cv = predict_actors(frames[-1], times)[0]
    midpoint = times - .05
    expected = np.cumsum(np.stack(((10 + midpoint) * np.cos(.2 * midpoint),
                                   (10 + midpoint) * np.sin(.2 * midpoint)), -1) * .1, axis=0)
    learned_error = np.linalg.norm(np.stack((prediction["x"], prediction["y"]), -1) - expected, axis=-1).mean()
    baseline_error = np.linalg.norm(np.stack((cv["x"], cv["y"]), -1) - expected, axis=-1).mean()
    assert learned_error < baseline_error
    assert prediction["x"].shape == times.shape


@pytest.mark.parametrize("speed", [0., 10.])
def test_cv_and_stationary_unchanged(trained, speed):
    frames = history(speed=speed, acceleration=0., yaw_rate=0., yaw=1.2)
    times = np.linspace(.1, 5, 50)
    result = forecast.predict_actors_history(frames[-1], frames, times, trained[0])
    baseline = predict_actors(frames[-1], times)
    np.testing.assert_allclose(result[0]["x"], baseline[0]["x"], atol=1e-12)
    np.testing.assert_allclose(result[0]["y"], baseline[0]["y"], atol=1e-12)


def test_history_free_invalid_missing_and_bad_checkpoint(tmp_path, trained):
    a = actor(yaw=1.)
    times = np.array([1., 2.])
    baseline = predict_actors([a], times)[0]
    for frames, path in [(None, trained[0]), ([], trained[0]), ([[a]], trained[0]),
                         (history(yaw=1.), tmp_path / "absent.pt")]:
        result = forecast.predict_actors_history([a, dict(a, valid=False), dict(a, x=float("nan")), {}], frames, times, path)
        assert len(result) == 1
        np.testing.assert_allclose(result[0]["x"], baseline["x"])
        np.testing.assert_allclose(result[0]["y"], baseline["y"])
    bad = tmp_path / "bad.pt"
    bad.write_bytes(b"broken checkpoint")
    assert not forecast.status(bad)["trained"]
    assert not forecast.status(tmp_path / "absent.pt")["trained"]
    result = forecast.predict_actors_history([a], history(yaw=1.), times, bad)[0]
    np.testing.assert_allclose(result["x"], baseline["x"])
    assert forecast.predict_actors_history([], [], times, trained[0]) == []


def test_actor_local_rotation_translation_batch_and_wrapped_yaw(trained):
    frames = history()
    angle = math.pi - .02
    rotated = deepcopy(frames)
    for frame in rotated:
        for a in frame:
            x, y = a["x"], a["y"]
            a["x"] = 100 + math.cos(angle) * x - math.sin(angle) * y
            a["y"] = -50 + math.sin(angle) * x + math.cos(angle) * y
            a["yaw"] = math.atan2(math.sin(a["yaw"] + angle), math.cos(a["yaw"] + angle))
    times = np.linspace(.1, 5, 50)
    original = forecast.predict_actors_history(frames[-1], frames, times, trained[0])[0]
    turned = forecast.predict_actors_history(rotated[-1], rotated, times, trained[0])[0]
    np.testing.assert_allclose(turned["x"], 100 + math.cos(angle) * original["x"] - math.sin(angle) * original["y"], atol=1e-5)
    np.testing.assert_allclose(turned["y"], -50 + math.sin(angle) * original["x"] + math.cos(angle) * original["y"], atol=1e-5)
    batch = [[*f, dict(f[0], id="b", x=f[0]["x"] + 30)] for f in frames]
    predicted = forecast.predict_actors_history(batch[-1], batch, times, trained[0])
    np.testing.assert_allclose(predicted[1]["x"], predicted[0]["x"] + 30)
    np.testing.assert_allclose(predicted[1]["y"], predicted[0]["y"])


def test_future_absent_signature_and_inputs_only(trained):
    signature = inspect.signature(forecast.predict_actors_history)
    assert list(signature.parameters) == ["actors", "history", "times", "checkpoint"]
    frames = history()
    before = deepcopy(frames)
    times = np.array([1., 2., 3.])
    original = forecast.predict_actors_history(frames[-1], frames, times, trained[0])
    poisoned = deepcopy(frames)
    for frame in poisoned:
        for a in frame:
            a["future"] = [{"x": -1e9, "y": 1e9}]
            a["logged_future_acceleration"] = 1e9
    result = forecast.predict_actors_history(poisoned[-1], poisoned, times, trained[0])
    np.testing.assert_array_equal(original[0]["x"], result[0]["x"])
    np.testing.assert_array_equal(original[0]["y"], result[0]["y"])
    assert before == frames


def test_checkpoint_cache_is_reused_and_file_change_reloads(trained, tmp_path):
    torch = pytest.importorskip("torch")
    path, _ = trained
    model, _ = forecast._load_model(path)
    assert forecast._load_model(path)[0] is model
    copy_path = tmp_path / "copy.pt"
    payload = torch.load(path, weights_only=True, map_location="cpu")
    torch.save(payload, copy_path)
    old = forecast._load_model(copy_path)[0]
    payload["state_dict"]["0.bias"] += .01
    torch.save(payload, copy_path)
    assert forecast._load_model(copy_path)[0] is not old


def test_seed_determines_whole_trajectory_independent_of_batch():
    batch = forecast._synthetic_trajectories([101, 102, 103])
    alone = forecast._synthetic_trajectories([103])
    np.testing.assert_array_equal(batch["future"][2], alone["future"][0])
    np.testing.assert_array_equal(batch["features"][2], alone["features"][0])


def test_deterministic_training_preserves_rng_and_thread_settings(trained, tmp_path):
    torch = pytest.importorskip("torch")
    path, first = trained
    rng_before = torch.get_rng_state().clone()
    threads_before = torch.get_num_threads()
    second_path = tmp_path / "repeat.pt"
    second = forecast.train_model(second_path, seed=42, epochs=100)
    assert torch.equal(torch.get_rng_state(), rng_before)
    assert torch.get_num_threads() == threads_before
    assert first["metrics"] == second["metrics"]
    a = torch.load(path, weights_only=True, map_location="cpu")["state_dict"]
    b = torch.load(second_path, weights_only=True, map_location="cpu")["state_dict"]
    assert all(torch.equal(a[key], b[key]) for key in a)


def test_discontinuous_mismatched_and_extreme_history_falls_back(trained):
    a = actor()
    times = np.array([.1, 1., 5.])
    baseline = predict_actors([a], times)[0]
    for frames in ([[dict(a, speed=9)], [], [a]], history(speed=8),
                   [[dict(a, speed=0)], [a]], [[dict(a, speed=9)], [a, dict(a)]],
                   [[dict(a, yaw=float("nan"))], [a]]):
        result = forecast.predict_actors_history([a], frames, times, trained[0])[0]
        np.testing.assert_array_equal(result["x"], baseline["x"])
        np.testing.assert_array_equal(result["y"], baseline["y"])


@pytest.mark.parametrize("epochs", [0, -1, True, 1.5, 1001])
def test_training_argument_validation(epochs, tmp_path):
    with pytest.raises(ValueError):
        forecast.train_model(tmp_path / "model.pt", epochs=epochs)


def test_missing_checkpoint_contract(tmp_path):
    report = forecast.status(tmp_path / "missing.pt")
    assert report["source"] == "synthetic-motion"
    assert not report["trained"]
    assert report["train_trajectories"] == report["validation_trajectories"] == 0
    assert report["horizon_seconds"] == 5
    assert report["metrics"] == dict(baseline_ade=None, baseline_fde=None, learned_ade=None, learned_fde=None)


@pytest.mark.parametrize("times", [[-1.], [6.], [float("nan")], [[1.]], [2., 1.]])
def test_horizon_validation(times):
    with pytest.raises(ValueError):
        forecast.predict_actors_history([actor()], [], times)
