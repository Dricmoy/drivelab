#!/usr/bin/env python3
"""Exercise installed official Waymax, independently of DriveLab backend/web.

Every fixture is generated synthetic data. No Waymo dataset is downloaded.
Run: .venv/bin/python scripts/verify_waymax.py
Optional: --report /tmp/waymax-verification.json --keep-fixture /tmp/fake.tfrecord
"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
import platform
from pathlib import Path
import tempfile

# Conservative CPU defaults before JAX/TensorFlow import; honor explicit overrides.
os.environ.setdefault("JAX_PLATFORMS", "cpu")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "1")
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")

import jax
import jax.numpy as jnp
import numpy as np
import tensorflow as tf
from waymax import config, dataloader, datatypes, dynamics, env
from waymax.dataloader import womd_utils

COMMIT = "a64dfec9be8576b60d9cecc94f406d9812d4a7d0"


def make_state():
    """Three synthetic cars, 91 steps at 10 Hz, straight lane with two edges."""
    n, steps = 3, 91
    t = np.arange(steps, dtype=np.float32) * 0.1
    x = np.stack([10 * t, 25 + 8 * t, 60 + 2 * t])
    trajectory = datatypes.Trajectory.zeros((n, steps)).replace(
        x=jnp.asarray(x),
        y=jnp.asarray(np.broadcast_to(np.array([0, 3.5, 0], np.float32)[:, None], (n, steps))),
        vel_x=jnp.asarray(np.broadcast_to(np.array([10, 8, 2], np.float32)[:, None], (n, steps))),
        length=jnp.full((n, steps), 4.5, jnp.float32),
        width=jnp.full((n, steps), 1.8, jnp.float32),
        height=jnp.full((n, steps), 1.5, jnp.float32),
        timestamp_micros=jnp.broadcast_to(jnp.arange(steps, dtype=jnp.int32) * 100000, (n, steps)),
        valid=jnp.ones((n, steps), jnp.bool_),
    )
    metadata = datatypes.ObjectMetadata(
        ids=jnp.arange(n, dtype=jnp.int32), object_types=jnp.ones(n, jnp.int32),
        is_sdc=jnp.array([True, False, False]), is_modeled=jnp.ones(n, jnp.bool_),
        is_valid=jnp.ones(n, jnp.bool_), objects_of_interest=jnp.zeros(n, jnp.bool_),
        is_controlled=jnp.zeros(n, jnp.bool_),
    )
    # Preserve per-feature point order and direction. Edge normals face away
    # from the road according to Waymax's signed-distance convention.
    rg_x = np.tile(np.linspace(-20, 120, 64, dtype=np.float32), 3)
    rg_y = np.repeat(np.array([0, -5, 5], np.float32), 64)
    roadgraph = datatypes.RoadgraphPoints(
        x=jnp.asarray(rg_x), y=jnp.asarray(rg_y), z=jnp.zeros(192, jnp.float32),
        dir_x=jnp.asarray(np.repeat(np.array([1, 1, -1], np.float32), 64)),
        dir_y=jnp.zeros(192, jnp.float32), dir_z=jnp.zeros(192, jnp.float32),
        types=jnp.asarray(np.repeat(np.array([2, 15, 15], np.int32), 64)),
        ids=jnp.asarray(np.repeat(np.array([100, 101, 102], np.int32), 64)),
        valid=jnp.ones(192, jnp.bool_),
    )
    tl_shape = (1, steps)
    lights = datatypes.TrafficLights(
        x=jnp.zeros(tl_shape, jnp.float32), y=jnp.zeros(tl_shape, jnp.float32),
        z=jnp.zeros(tl_shape, jnp.float32), state=jnp.zeros(tl_shape, jnp.int32),
        lane_ids=jnp.zeros(tl_shape, jnp.int32), valid=jnp.zeros(tl_shape, jnp.bool_),
    )
    state = datatypes.SimulatorState(
        sim_trajectory=datatypes.Trajectory.zeros((n, steps)), log_trajectory=trajectory,
        log_traffic_light=lights, object_metadata=metadata, roadgraph_points=roadgraph,
        timestep=jnp.asarray(0, jnp.int32), sdc_paths=None,
    )
    for component in (trajectory, metadata, roadgraph, lights, state):
        component.validate()
    return state


def make_environment(n, init_steps=11):
    return env.BaseEnvironment(
        dynamics.StateDynamics(), config.EnvironmentConfig(
            max_num_objects=n, init_steps=init_steps, controlled_object=config.ObjectType.SDC,
            compute_reward=False,
            metrics=config.MetricsConfig(metrics_to_run=("overlap", "offroad", "kinematic_infeasibility")),
        ),
    )


def observation(state, history=3):
    assert history <= int(state.timestep) + 1
    return datatypes.sdc_observation_from_state(
        state, obs_num_steps=history, roadgraph_top_k=min(192, state.roadgraph_points.num_points),
        coordinate_frame=config.CoordinateFrame.GLOBAL,
    )


def map_lane_route(state):
    """Select one forward lane from current ego pose and static map only.

    This small verification helper does not infer intersection connectivity.
    """
    rg = state.roadgraph_points
    ego = int(np.flatnonzero(np.asarray(state.object_metadata.is_sdc))[0])
    position = np.asarray(state.current_sim_trajectory.xy)[ego, 0]
    yaw = float(np.asarray(state.current_sim_trajectory.yaw)[ego, 0])
    heading = np.array([np.cos(yaw), np.sin(yaw)])
    xy, directions = np.asarray(rg.xy), np.asarray(rg.dir_xy)
    lane = np.asarray(rg.valid) & np.isin(np.asarray(rg.types), [1, 2, 3])
    aligned = lane & ((directions @ heading) > 0.5)
    if not aligned.any():
        raise ValueError("No valid forward lane near the ego")
    score = np.where(aligned, np.linalg.norm(xy - position, axis=-1), np.inf)
    closest = int(np.argmin(score))
    lane_id = np.asarray(rg.ids)[closest]
    selected = lane & (np.asarray(rg.ids) == lane_id)
    return xy[selected]


def verify_stepping(state):
    simulator = make_environment(state.num_objects)
    state = simulator.reset(state)
    assert int(state.timestep) == 10
    assert not np.asarray(state.sim_trajectory.valid)[:, 11:].any()
    single_spec = simulator.dynamics.action_spec()
    assert tuple(single_spec.shape) == (5,)
    # This pinned upstream release indexes scalar BoundedArray min/max as
    # vectors when expanding the environment spec. Record the defect rather
    # than modifying installed Waymax; reset/step do not use action_spec().
    try:
        environment_spec = simulator.action_spec()
    except IndexError as error:
        if "too many indices" not in str(error):
            raise
        assert np.ndim(single_spec.minimum) == 0
        assert np.ndim(single_spec.maximum) == 0
        spec_status = {"available": False, "upstream_error": str(error),
                       "workaround": "validate rows against dynamics.action_spec(); construct Action directly"}
    else:
        assert tuple(environment_spec.data.shape) == (3, 5)
        assert tuple(environment_spec.valid.shape) == (3, 1)
        spec_status = {"available": True}
    before = np.asarray(state.current_sim_trajectory.x)[:, 0]
    action = datatypes.Action(
        data=jnp.asarray([[10.5, 0, 0, 5, 0], [-999, -999, 0, 0, 0], [-999, -999, 0, 0, 0]], jnp.float32),
        valid=jnp.array([[True], [False], [False]]),
    )
    action.validate()
    assert action.data.shape == (state.num_objects, 5)
    assert action.valid.shape == (state.num_objects, 1)
    for row in np.asarray(action.data):
        single_spec.validate(row)
    following = jax.jit(simulator.step)(state, action)
    np.testing.assert_allclose(np.asarray(following.current_sim_trajectory.x)[:, 0], [10.5, 33.8, 62.2], atol=1e-5)
    assert int(following.timestep) == 11
    clear_metrics = simulator.metrics(following)
    assert float(np.asarray(clear_metrics["overlap"].value)[0]) == 0.0
    assert float(np.asarray(clear_metrics["offroad"].value)[0]) == 0.0
    # Built-in overlap must detect a deliberate overlap with car #1.
    crash_action = action.replace(data=action.data.at[0].set(jnp.array([34.6, 3.5, 0, 8, 0], jnp.float32)))
    crashed = simulator.step(following, crash_action)
    crash_metrics = simulator.metrics(crashed)
    assert bool(np.asarray(crash_metrics["overlap"].valid)[0])
    assert float(np.asarray(crash_metrics["overlap"].value)[0]) == 1.0
    offroad_action = action.replace(data=action.data.at[0].set(jnp.array([11, 12, 0, 5, 0], jnp.float32)))
    offroad = simulator.step(following, offroad_action)
    assert float(np.asarray(simulator.metrics(offroad)["offroad"].value)[0]) == 1.0
    obs = observation(following)
    assert tuple(obs.trajectory.shape) == (1, 3, 3)
    # Poison simulator-only futures: bounded observations must not change.
    poisoned = following.replace(
        log_trajectory=following.log_trajectory.replace(
            x=following.log_trajectory.x.at[:, 12:].set(99999),
            y=following.log_trajectory.y.at[:, 12:].set(-99999),
        ),
        sim_trajectory=following.sim_trajectory.replace(
            x=following.sim_trajectory.x.at[:, 12:].set(99999),
        ),
        log_traffic_light=following.log_traffic_light.replace(
            state=following.log_traffic_light.state.at[:, 12:].set(7),
        ),
    )
    for left, right in zip(jax.tree_util.tree_leaves(obs), jax.tree_util.tree_leaves(observation(poisoned)), strict=True):
        np.testing.assert_array_equal(np.asarray(left), np.asarray(right))
    route = map_lane_route(following)
    np.testing.assert_array_equal(route, map_lane_route(poisoned))
    assert route.shape == (64, 2)
    # Verify the public terminal flag across an entire closed-loop rollout.
    terminal = following
    step = jax.jit(simulator.step)
    while not bool(terminal.is_done):
        next_x = terminal.current_sim_trajectory.x[0, 0] + 0.5
        rollout_action = action.replace(data=action.data.at[0, 0].set(next_x))
        terminal = step(terminal, rollout_action)
    assert int(terminal.timestep) == 90
    assert int(terminal.remaining_timesteps) == 0
    np.testing.assert_allclose(np.asarray(terminal.current_sim_trajectory.x)[0, 0], 50.0, atol=1e-5)
    # Directly setting poses does not enforce physical feasibility; metrics do.
    return {
        "synthetic": True, "warmup_timestep": 10, "stepped_timestep": 11,
        "environment_action_spec": spec_status,
        "previous_x": before.tolist(), "next_x": np.asarray(following.current_sim_trajectory.x)[:, 0].tolist(),
        "ego_absolute_action_applied": True, "non_ego_logged_playback": True,
        "jit_step": True, "built_in_overlap_detected": True, "built_in_offroad_detected": True,
        "clear_state_metrics_zero": True, "rollout_terminal_timestep": 90,
        "history_observation_shape": list(obs.trajectory.shape), "future_poison_invariance": True,
        "static_map_route_future_invariance": True,
        "metrics": {key: {"value": np.asarray(value.value).tolist(), "valid": np.asarray(value.valid).tolist()} for key, value in crash_metrics.items()},
    }


def write_fake_tfexample(path, state):
    """Generate every required field using Waymax's official TFExample schema."""
    schema = womd_utils.get_features_description(max_num_rg_points=192, include_sdc_paths=False)
    arrays = {key: np.zeros(spec.shape, dtype=np.float32 if spec.dtype == tf.float32 else np.int64) for key, spec in schema.items()}
    arrays["state/id"][:] = -1
    arrays["state/tracks_to_predict"][:] = -1
    arrays["state/id"][:3] = np.arange(3)
    arrays["state/type"][:3] = 1
    arrays["state/is_sdc"][0] = 1
    arrays["state/tracks_to_predict"][:3] = 1
    fields = {"bbox_yaw": "yaw", "velocity_x": "vel_x", "velocity_y": "vel_y"}
    for part, interval in {"past": slice(0, 10), "current": slice(10, 11), "future": slice(11, 91)}.items():
        for key in arrays:
            if key.startswith(f"state/{part}/"):
                field = key.rsplit("/", 1)[1]
                if field == "speed":
                    value = state.log_trajectory.speed
                elif field == "vel_yaw":
                    value = state.log_trajectory.vel_yaw
                else:
                    value = getattr(state.log_trajectory, fields.get(field, field))
                arrays[key][:3] = np.asarray(value)[:, interval]
    rg = state.roadgraph_points
    arrays["roadgraph_samples/xyz"][:] = np.asarray(rg.xyz)
    arrays["roadgraph_samples/dir"][:] = np.asarray(rg.dir_xyz)
    for field in ("id", "type", "valid"):
        arrays[f"roadgraph_samples/{field}"][:, 0] = np.asarray(getattr(rg, {"id": "ids", "type": "types"}.get(field, field)))
    features = {}
    for key, values in arrays.items():
        if schema[key].dtype == tf.float32:
            features[key] = tf.train.Feature(float_list=tf.train.FloatList(value=values.ravel()))
        else:
            features[key] = tf.train.Feature(int64_list=tf.train.Int64List(value=values.ravel()))
    # Preserve provenance even when this fixture is imported through the app.
    features["drivelab/source"] = tf.train.Feature(bytes_list=tf.train.BytesList(value=[b"synthetic-fixture"]))
    serialized = tf.train.Example(features=tf.train.Features(feature=features)).SerializeToString()
    path.parent.mkdir(parents=True, exist_ok=True)
    with tf.io.TFRecordWriter(str(path)) as writer:
        writer.write(serialized)
    return len(schema)


def verify_dataloader(path, original):
    num_features = write_fake_tfexample(path, original)
    dataset_config = config.DatasetConfig(
        path=str(path), repeat=1, batch_dims=(), shuffle_seed=None, num_shards=1,
        deterministic=True, include_sdc_paths=False, max_num_objects=128,
        max_num_rg_points=192, drop_remainder=False,
    )
    generator = dataloader.simulator_state_generator(dataset_config)
    loaded = next(generator)
    assert tuple(loaded.log_trajectory.shape) == (128, 91)
    np.testing.assert_allclose(np.asarray(loaded.log_trajectory.x)[:3], np.asarray(original.log_trajectory.x))
    assert loaded.roadgraph_points.num_points == 192
    assert np.asarray(loaded.object_metadata.is_sdc).sum() == 1
    assert not np.asarray(loaded.object_metadata.is_valid)[3:].any()
    assert loaded.sdc_paths is None
    assert next(generator, None) is None, "repeat=1 must terminate"
    simulator = make_environment(128)
    reset = simulator.reset(loaded)
    payload = np.zeros((128, 5), np.float32)
    payload[0] = [10.25, 0, 0, 2.5, 0]
    valids = np.zeros((128, 1), bool)
    valids[0] = True
    following = simulator.step(reset, datatypes.Action(data=jnp.asarray(payload), valid=jnp.asarray(valids)))
    np.testing.assert_allclose(np.asarray(following.current_sim_trajectory.x)[:3, 0], [10.25, 33.8, 62.2], atol=1e-5)
    # Prove the documented dimension preprocessing issue using another
    # generated in-memory Example. Positions/history are otherwise identical.
    serialized = next(iter(tf.data.TFRecordDataset(str(path)))).numpy()
    future_changed = tf.train.Example.FromString(serialized)
    future_lengths = future_changed.features.feature["state/future/length"].float_list.value
    for index in range(3 * 80):
        future_lengths[index] = 9.0
    processed = dataloader.preprocess_serialized_womd_data(future_changed.SerializeToString(), dataset_config)
    changed = dataloader.simulator_state_from_womd_dict({key: value.numpy() for key, value in processed.items()})
    changed_obs = observation(simulator.reset(changed))
    expected_length = (11 * 4.5 + 80 * 9.0) / 91
    np.testing.assert_allclose(np.asarray(changed_obs.trajectory.length)[0, :3], expected_length, atol=1e-5)
    assert not np.allclose(np.asarray(changed_obs.trajectory.length)[0, :3], 4.5)
    return {"synthetic": True, "format": "generated tf.train.Example in TFRecord", "features": num_features,
            "loaded_shape": list(loaded.log_trajectory.shape), "roadgraph_points": 192,
            "finite_iterator": True, "decoded_state_stepped": True, "real_waymo_data_tested": False,
            "full_track_dimension_mean_verified": True,
            "causal_dimension_sanitization_needed": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--keep-fixture", type=Path)
    args = parser.parse_args()
    state = make_state()
    distribution = importlib.metadata.distribution("waymo-waymax")
    installed_origin = json.loads(distribution.read_text("direct_url.json") or "{}")
    installed_commit = installed_origin.get("vcs_info", {}).get("commit_id")
    if installed_commit is not None:
        assert installed_commit == COMMIT, f"Installed Waymax commit differs: {installed_commit}"
    report = {"status": "passed", "inspected_source_commit": COMMIT, "installed_origin": installed_origin,
              "platform": {"python": platform.python_version(), "machine": platform.machine(), "jax_devices": [str(d) for d in jax.devices()]},
              "versions": {name: importlib.metadata.version(name) for name in ("waymo-waymax", "jax", "jaxlib", "tensorflow", "numpy", "chex", "flax")},
              "stepping": verify_stepping(state)}
    with tempfile.TemporaryDirectory(prefix="drivelab-fake-womd-") as directory:
        path = args.keep_fixture or Path(directory) / "synthetic.tfrecord"
        report["dataloader"] = verify_dataloader(path, state)
    text = json.dumps(report, indent=2)
    if args.report:
        args.report.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
