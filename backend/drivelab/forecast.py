"""Optional CPU motion forecasting, trained exclusively on synthetic trajectories.

Inference accepts current actors and observed history only. History is a list of
actor lists sampled at 10 Hz, with the current frame last (the simulator's dt).
No logged future or ScenarioData is accepted. Missing models/history use CV.
"""
from __future__ import annotations

from functools import lru_cache
import importlib.util
import math
from pathlib import Path
import threading
import time

import numpy as np


DEFAULT_CHECKPOINT = Path(__file__).resolve().parents[2] / "data/models/forecast.pt"
HISTORY_DT = 0.1
FEATURE_NAMES = ["speed", "estimated_acceleration", "estimated_yaw_rate", "horizon"]
SOURCE = "synthetic-motion"
TRAINING_DESCRIPTION = "Deterministic synthetic kinematic trajectories; no real dataset training"
_TRAIN_LOCK = threading.Lock()


def _torch():
    try:
        import torch
    except ImportError as exc:
        raise ImportError("Optional PyTorch dependency is not installed") from exc
    return torch


def _make_model(torch):
    return torch.nn.Sequential(torch.nn.Linear(4, 48), torch.nn.SiLU(),
                               torch.nn.Linear(48, 48), torch.nn.SiLU(),
                               torch.nn.Linear(48, 4))


def _inputs(speed, acceleration, yaw_rate, times):
    """Vectorized causal features and residual scale, shared by train/inference."""
    speed, acceleration, yaw_rate, times = np.broadcast_arrays(speed, acceleration, yaw_rate, times)
    features = np.stack((speed / 20, acceleration / 3, yaw_rate / .5, times / 5), axis=-1)
    # Exactly zero for CV; the network cannot perturb stationary/steady actors.
    scale = .5 * times[..., None]**2 * np.stack((acceleration, speed * yaw_rate), axis=-1)
    return features.astype(np.float32), scale.astype(np.float32)


def _residual_prediction(model, features, scale):
    """Learn two 2D coefficients, scaled by signed acceleration/turn motion.

    Separating the physical gates makes straight acceleration and pure turning
    distinguishable. All four coefficients are learned; both gates vanish for CV.
    """
    coefficients = model(features).reshape(-1, 2, 2)
    return (coefficients * scale[:, None, :]).sum(dim=-1)


def _synthetic_trajectories(seeds):
    """Each seed is one whole physical trajectory, never split across datasets.

    Local x/y use midpoint integration at 0.1 s. Independent random translations
    and rotations are unnecessary: the representation is actor-local by design.
    """
    parameters = np.array([[np.random.default_rng(int(seed)).uniform(6, 22),
                            np.random.default_rng(int(seed) + 10_000_000).uniform(-.9, 1.8),
                            np.random.default_rng(int(seed) + 20_000_000).uniform(-.45, .45)]
                           for seed in seeds])
    speed, acc, yaw_rate = parameters.T.copy()
    # Include CV, stationary, acceleration-only and turn-only controls in each split.
    kinds = np.asarray(seeds) % 10
    acc[np.isin(kinds, [0, 1, 3])] = 0
    yaw_rate[np.isin(kinds, [0, 1, 2])] = 0
    speed[kinds == 0] = 0
    times = np.arange(1, 51, dtype=np.float64) * HISTORY_DT
    midtimes = times - HISTORY_DT / 2
    velocity = speed[:, None] + acc[:, None] * midtimes
    heading = yaw_rate[:, None] * midtimes
    future = np.cumsum(np.stack((velocity * np.cos(heading), velocity * np.sin(heading)), -1)
                       * HISTORY_DT, axis=1)
    baseline = np.stack((speed[:, None] * times, np.zeros((len(seeds), len(times)))), -1)
    features, scale = _inputs(speed[:, None], acc[:, None], yaw_rate[:, None], times)
    return dict(features=features, scale=scale, residual=future - baseline,
                future=future, baseline=baseline, kinds=kinds, seeds=list(map(int, seeds)))


def _errors(predicted, truth):
    errors = np.linalg.norm(predicted - truth, axis=-1)
    # Equal trajectory weighting: every trajectory has the same 50 horizons.
    return dict(ade=float(errors.mean(axis=1).mean()), fde=float(errors[:, -1].mean()))


def train_model(output_path=DEFAULT_CHECKPOINT, seed=42, epochs=100):
    """Train a tiny MLP on CPU and save weights plus measured held-out metrics.

    Returns JSON-safe source, split seeds/counts, baseline/learned ADE/FDE (m),
    subgroup results and duration. Validation trajectories never enter optimization.
    The held-out set is evaluated once after the fixed epoch budget, not selected
    for favorable results. Reported runtime includes generation, training and
    evaluation; checkpoint serialization follows immediately afterward.
    """
    if isinstance(epochs, bool) or not isinstance(epochs, int) or not 1 <= epochs <= 1000:
        raise ValueError("epochs must be an integer in [1, 1000]")
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed < 2**31:
        raise ValueError("seed must be an integer in [0, 2**31)")
    torch = _torch()
    with _TRAIN_LOCK:
        started = time.perf_counter()
        old_threads = torch.get_num_threads()
        try:
            torch.set_num_threads(2)
            # Isolate initialization/training RNG from the rest of the application.
            with torch.random.fork_rng(devices=[]):
                torch.manual_seed(seed)
                seed_base = seed * 100_000
                train = _synthetic_trajectories(range(seed_base, seed_base + 512))
                validation = _synthetic_trajectories(range(seed_base + 50_000, seed_base + 50_256))
                model = _make_model(torch).cpu()
                model.train()
                features = torch.from_numpy(train["features"].reshape(-1, 4))
                scales = torch.from_numpy(train["scale"].reshape(-1, 2))
                target = torch.from_numpy(train["residual"].reshape(-1, 2).astype(np.float32))
                optimizer = torch.optim.Adam(model.parameters(), lr=.008)
                for _ in range(epochs):
                    optimizer.zero_grad(set_to_none=True)
                    prediction = _residual_prediction(model, features, scales)
                    loss = torch.nn.functional.mse_loss(prediction, target)
                    loss.backward()
                    optimizer.step()
                model.eval()
                with torch.inference_mode():
                    residual = _residual_prediction(model, torch.from_numpy(validation["features"].reshape(-1, 4)),
                                                    torch.from_numpy(validation["scale"].reshape(-1, 2)))
                    residual = residual.numpy().reshape(-1, 50, 2)
                predicted = validation["baseline"] + residual
                baseline_metrics = _errors(validation["baseline"], validation["future"])
                learned_metrics = _errors(predicted, validation["future"])
                groups = {}
                for name, mask in [("stationary", validation["kinds"] == 0),
                                   ("constant_velocity", validation["kinds"] == 1),
                                   ("accelerating", validation["kinds"] == 2),
                                   ("turning", validation["kinds"] == 3),
                                   ("accelerating_and_turning", validation["kinds"] >= 4)]:
                    groups[name] = dict(trajectories=int(mask.sum()),
                                       baseline=_errors(validation["baseline"][mask], validation["future"][mask]),
                                       learned=_errors(predicted[mask], validation["future"][mask]))
                metrics = dict(available=True, trained=True, source=SOURCE,
                               training_description=TRAINING_DESCRIPTION,
                               seed=seed, epochs=epochs, device="cpu", units="meters",
                               history_dt=HISTORY_DT, horizon_seconds=5.,
                               train_trajectories=512, validation_trajectories=256,
                               train_samples=int(len(features)), validation_samples=256 * 50,
                               train_seeds=train["seeds"], validation_seeds=validation["seeds"],
                               baseline=baseline_metrics, learned=learned_metrics, groups=groups,
                               metrics=dict(baseline_ade=baseline_metrics["ade"], baseline_fde=baseline_metrics["fde"],
                                            learned_ade=learned_metrics["ade"], learned_fde=learned_metrics["fde"]),
                               ade_improvement_fraction=float(1 - learned_metrics["ade"] / baseline_metrics["ade"]),
                               final_train_mse=float(loss.detach()),
                               checkpoint=str(Path(output_path).resolve()))
                path = Path(output_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                # Atomic replacement: readers never see half-written weights.
                import tempfile
                import os
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".pt", delete=False) as stream:
                        temporary = Path(stream.name)
                    metrics["training_seconds"] = time.perf_counter() - started
                    torch.save(dict(format_version=2, feature_names=FEATURE_NAMES,
                                    state_dict=model.state_dict(), metrics=metrics), temporary)
                    os.replace(temporary, path)
                finally:
                    if temporary is not None:
                        temporary.unlink(missing_ok=True)
                _cached_model.cache_clear()
                return metrics
        finally:
            torch.set_num_threads(old_threads)


@lru_cache(maxsize=4)
def _cached_model(path, mtime_ns, size, inode):
    torch = _torch()
    payload = torch.load(path, map_location="cpu", weights_only=True)
    if payload.get("format_version") != 2 or payload.get("feature_names") != FEATURE_NAMES:
        raise ValueError("Unsupported forecast checkpoint format/features")
    metrics = payload["metrics"]
    if metrics.get("history_dt") != HISTORY_DT or metrics.get("source") != SOURCE:
        raise ValueError("Unsupported forecast checkpoint history/source")
    model = _make_model(torch).cpu()
    model.load_state_dict(payload["state_dict"], strict=True)
    model.eval()
    if not all(torch.isfinite(p).all() for p in model.parameters()):
        raise ValueError("Forecast checkpoint contains nonfinite parameters")
    return model, metrics


def _load_model(checkpoint):
    path = Path(checkpoint).resolve()
    stat = path.stat()
    return _cached_model(str(path), stat.st_mtime_ns, stat.st_size, stat.st_ino)


def status(checkpoint=DEFAULT_CHECKPOINT):
    """JSON-safe optional-model status; a bad/missing model does not break the API."""
    path = Path(checkpoint)
    torch_available = importlib.util.find_spec("torch") is not None
    result = dict(available=torch_available, trained=False, torch_available=torch_available,
                  checkpoint=str(path.resolve()), source=SOURCE, history_dt=HISTORY_DT,
                  training_description=TRAINING_DESCRIPTION,
                  feature_names=FEATURE_NAMES, fallback="constant_velocity", seed=None, epochs=0,
                  train_trajectories=0, validation_trajectories=0, horizon_seconds=5.,
                  metrics=dict(baseline_ade=None, baseline_fde=None, learned_ade=None, learned_fde=None))
    if not path.is_file():
        return dict(result, reason="Checkpoint has not been trained")
    try:
        _, metrics = _load_model(path)
        return dict(result, **{key: value for key, value in metrics.items() if key not in result},
                    available=True, trained=True, seed=metrics["seed"], epochs=metrics["epochs"],
                    train_trajectories=metrics["train_trajectories"],
                    validation_trajectories=metrics["validation_trajectories"], metrics=metrics["metrics"])
    except Exception as exc:
        return dict(result, reason=f"Checkpoint unavailable: {type(exc).__name__}: {exc}")


def _valid_actor(actor):
    if not isinstance(actor, dict) or not actor.get("valid", True):
        return False
    try:
        return all(math.isfinite(float(actor[key])) for key in ("x", "y", "speed", "yaw")) and float(actor["speed"]) >= 0
    except (KeyError, TypeError, ValueError, OverflowError):
        return False


def _observed_motion(actor, history):
    """Estimate motion from a contiguous suffix ending in the current actor."""
    if not history or actor.get("id") is None:
        return 0., 0.
    samples = []
    for frame in reversed(history[-5:]):
        if not isinstance(frame, (list, tuple)):
            break
        matches = [a for a in frame if isinstance(a, dict) and a.get("id") == actor["id"]]
        if len(matches) != 1 or not _valid_actor(matches[0]):
            break
        samples.append(matches[0])
    if len(samples) < 2:
        return 0., 0.
    current = samples[0]
    if any(not math.isclose(float(current[k]), float(actor[k]), abs_tol=1e-5) for k in ("x", "y", "speed", "yaw")):
        return 0., 0.
    samples.reverse()
    speeds = np.array([float(a["speed"]) for a in samples])
    yaws = np.array([float(a["yaw"]) for a in samples])
    acceleration = float(np.median(np.diff(speeds)) / HISTORY_DT)
    differences = np.diff(yaws)
    yaw_rate = float(np.median(np.arctan2(np.sin(differences), np.cos(differences))) / HISTORY_DT)
    # Conservative fallback beyond synthetic training support, never extrapolate.
    if not (-1. <= acceleration <= 2. and abs(yaw_rate) <= .5 and float(actor["speed"]) <= 23):
        return 0., 0.
    acceleration = 0. if abs(acceleration) < 1e-5 else acceleration
    yaw_rate = 0. if abs(yaw_rate) < 1e-5 else yaw_rate
    return acceleration, yaw_rate


def predict_actors_history(actors, history, times, checkpoint=DEFAULT_CHECKPOINT):
    """Return planner-compatible actor dicts with x/y arrays, CPU-batched.

    Only actor speed/yaw and contiguous observed history enter the model. Input
    extras (including possible future fields) are never used as model features.
    Times are increasing offsets in seconds in [0, 5]. Missing/invalid history or
    checkpoints fall back to CV. Invalid actors are omitted. No inputs mutate.
    """
    times = np.asarray(times, dtype=np.float64)
    if times.ndim != 1 or not np.isfinite(times).all() or np.any(times < 0) or np.any(times > 5 + 1e-8) or np.any(np.diff(times) <= 0):
        raise ValueError("times must be finite, increasing 1D offsets between 0 and 5 seconds")
    valid = [a for a in actors if _valid_actor(a)]
    if not valid:
        return []
    speed = np.array([float(a["speed"]) for a in valid])
    yaw = np.array([float(a["yaw"]) for a in valid])
    local_x = speed[:, None] * times
    local_y = np.zeros_like(local_x)
    motion = np.array([_observed_motion(a, history) for a in valid])
    features, scale = _inputs(speed[:, None], motion[:, 0, None], motion[:, 1, None], times)
    if len(times) and np.any(scale):
        try:
            model, _ = _load_model(checkpoint)
        except Exception:
            model = None
        if model is not None:
            torch = _torch()
            with torch.inference_mode():
                residual = _residual_prediction(model, torch.from_numpy(features.reshape(-1, 4)),
                                                torch.from_numpy(scale.reshape(-1, 2))).numpy().reshape(len(valid), len(times), 2)
            residual[~np.isfinite(residual)] = 0
            local_x += residual[..., 0]
            local_y += residual[..., 1]
    c, s = np.cos(yaw)[:, None], np.sin(yaw)[:, None]
    world_x = np.array([float(a["x"]) for a in valid])[:, None] + c * local_x - s * local_y
    world_y = np.array([float(a["y"]) for a in valid])[:, None] + s * local_x + c * local_y
    return [dict(actor, x=world_x[i], y=world_y[i]) for i, actor in enumerate(valid)]
