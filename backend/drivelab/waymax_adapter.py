"""Optional genuine Waymax dynamics and bounded local WOMD TFExample decoding."""
from functools import lru_cache
from dataclasses import replace
import hashlib
import importlib.util
import math
import os
from pathlib import Path

import numpy as np

from .geometry import Route, corridor, corridor_cells
from .scenarios import ScenarioData, vehicle

os.environ.setdefault("JAX_PLATFORMS", "cpu")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_NUM_INTRAOP_THREADS", "1")
os.environ.setdefault("TF_NUM_INTEROP_THREADS", "1")


class DatasetError(ValueError):
    pass


@lru_cache(maxsize=1)
def available():
    if not all(importlib.util.find_spec(name) is not None for name in ("waymax", "jax", "tensorflow")):
        return False
    try:
        import jax
        import tensorflow
        from waymax import datatypes, dynamics, env, dataloader
        return bool(jax.devices()) and hasattr(dynamics, "StateDynamics") and hasattr(dataloader, "preprocess_serialized_womd_data")
    except Exception:
        return False


@lru_cache(maxsize=32)
def environment(n, init_steps):
    import jax
    from waymax import config, dynamics, env
    simulator = env.BaseEnvironment(dynamics.StateDynamics(), config.EnvironmentConfig(
        max_num_objects=n, init_steps=init_steps, controlled_object=config.ObjectType.SDC,
        compute_reward=False, allow_new_objects_after_warmup=True))
    return simulator, jax.jit(simulator.step)


class WaymaxStepper:
    def __init__(self, scenario):
        if not available():
            raise DatasetError("Waymax is unavailable. Install the backend[waymax] extra in the Python 3.12 environment.")
        import jax.numpy as jnp
        from waymax import datatypes
        self.scenario = scenario
        self.dt = scenario.public["dt"]
        self.jnp, self.datatypes = jnp, datatypes
        if scenario.waymax_state is not None:
            state = scenario.waymax_state
            self.ego_slot = scenario.ego_index
            self.ids = ["ego" if i == self.ego_slot else str(int(id)) for i, id in enumerate(np.asarray(state.object_metadata.ids))]
            self.simulator, self.advance = environment(state.num_objects, scenario.start_index + 1)
            self.state = self.simulator.reset(state)
            return
        self.ids = [scenario.public["ego"]["id"]] + sorted({a["id"] for frame in scenario.actor_tracks for a in frame})
        self.ego_slot = 0
        n, t = len(self.ids), len(scenario.actor_tracks)
        fields = {k: np.zeros((n, t), dtype=np.float32) for k in ("x", "y", "z", "vel_x", "vel_y", "yaw", "length", "width", "height")}
        valid = np.zeros((n, t), dtype=bool)
        for step, actors in enumerate(scenario.actor_tracks):
            objects = {a["id"]: a for a in actors}
            objects[self.ids[0]] = scenario.public["ego"]
            for i, id in enumerate(self.ids):
                if id not in objects:
                    continue
                a = objects[id]
                for key in ("x", "y", "yaw", "length", "width"):
                    fields[key][i, step] = a[key]
                fields["vel_x"][i, step] = a["speed"] * math.cos(a["yaw"])
                fields["vel_y"][i, step] = a["speed"] * math.sin(a["yaw"])
                fields["height"][i, step] = 1.5
                valid[i, step] = a.get("valid", True)
        log = datatypes.Trajectory(**{k: jnp.asarray(v) for k, v in fields.items()}, valid=jnp.asarray(valid),
                                  timestamp_micros=jnp.broadcast_to((jnp.arange(t) * self.dt * 1e6).astype(jnp.int32), (n, t)))
        log.validate()
        mask = jnp.arange(n) == 0
        metadata = datatypes.ObjectMetadata(ids=jnp.arange(n, dtype=jnp.int32), object_types=jnp.ones(n, jnp.int32),
                                           is_sdc=mask, is_modeled=mask, is_valid=jnp.any(log.valid, -1),
                                           objects_of_interest=jnp.zeros(n, bool), is_controlled=mask)
        lights = datatypes.TrafficLights(x=jnp.zeros((0, t)), y=jnp.zeros((0, t)), z=jnp.zeros((0, t)),
                                       state=jnp.zeros((0, t), jnp.int32), lane_ids=jnp.zeros((0, t), jnp.int32),
                                       valid=jnp.zeros((0, t), bool))
        self.state = datatypes.SimulatorState(sim_trajectory=log.replace(valid=log.valid & (jnp.arange(t)[None, :] == 0)),
                                             log_trajectory=log, object_metadata=metadata,
                                             log_traffic_light=lights, timestep=jnp.asarray(0, jnp.int32))
        self.state.validate()
        self.simulator, self.advance = environment(n, 1)
        self.state = self.simulator.reset(self.state)

    def step(self, target):
        jnp = self.jnp
        if bool(self.state.is_done):
            raise ValueError("Waymax state is at the end of its trajectory.")
        data = np.zeros((len(self.ids), 5), dtype=np.float32)
        data[self.ego_slot] = [target["x"], target["y"], target["yaw"],
                               target["speed"] * math.cos(target["yaw"]), target["speed"] * math.sin(target["yaw"])]
        valid = np.zeros((len(self.ids), 1), bool)
        valid[self.ego_slot] = True
        action = self.datatypes.Action(data=jnp.asarray(data), valid=jnp.asarray(valid))
        self.state = self.advance(self.state, action)
        # One small host transfer per field, not scalar JAX slicing/dispatch
        # per actor and timestep (128 slots in a typical decoded record).
        trajectory = self.state.current_sim_trajectory
        values = {key: np.asarray(getattr(trajectory, key))[:, 0]
                  for key in ("x", "y", "vel_x", "vel_y", "yaw", "length", "width", "valid")}
        frame, ego = [], None
        for k, id in enumerate(self.ids):
            if k != self.ego_slot and not bool(values["valid"][k]):
                continue
            item = vehicle(id, float(values["x"][k]), float(values["y"][k]),
                           float(np.hypot(values["vel_x"][k], values["vel_y"][k])),
                           float(values["yaw"][k]), float(values["length"][k]),
                           float(values["width"][k]), valid=bool(values["valid"][k]))
            if k == self.ego_slot:
                ego = item
            else:
                frame.append(item)
        return ego, frame


def lane_geometry(state, ego):
    rg = state.roadgraph_points
    if rg is None:
        raise DatasetError("Decoded scenario contains no roadgraph; cannot derive an independent route.")
    xy = np.asarray(rg.xy)
    types, ids, valid = np.asarray(rg.types), np.asarray(rg.ids), np.asarray(rg.valid)
    lanes = []
    lane_mask = valid & np.isin(types, [1, 2])
    for lane_id in np.unique(ids[lane_mask]):
        points = xy[lane_mask & (ids == lane_id)]
        if len(points) < 2:
            continue
        points = points[np.r_[True, np.linalg.norm(np.diff(points, axis=0), axis=-1) > .01]]
        if len(points) >= 2:
            lanes.append(dict(id=str(int(lane_id)), points=points.tolist()))
    if not lanes:
        raise DatasetError("No valid driving-lane centerlines found in WOMD roadgraph.")
    ranked = []
    for lane in lanes:
        route = Route(lane["points"])
        s, d = route.project(ego["x"], ego["y"])
        _, yaw = route.sample(s)
        heading_penalty = 5 * (1 - math.cos(float(yaw) - ego["yaw"]))
        ranked.append((abs(d) + heading_penalty, lane, s))
    _, chosen, _ = min(ranked, key=lambda entry: entry[0])
    points = list(chosen["points"])
    used = {chosen["id"]}
    # Link roadgraph lane ends using position and orientation only, never SDC future.
    for _ in range(12):
        endpoint = np.asarray(points[-1])
        direction = endpoint - np.asarray(points[-2])
        options = []
        for lane in lanes:
            if lane["id"] in used:
                continue
            p = np.asarray(lane["points"])
            gap = np.linalg.norm(p[0] - endpoint)
            alignment = direction @ (p[1] - p[0]) / max(np.linalg.norm(direction) * np.linalg.norm(p[1] - p[0]), 1e-6)
            if gap < 5. and alignment > .5:
                options.append((gap + (1 - alignment), lane))
        if not options:
            break
        _, lane = min(options, key=lambda entry: entry[0])
        addition = lane["points"]
        if np.linalg.norm(np.asarray(addition[0]) - endpoint) < .01:
            addition = addition[1:]
        points.extend(addition)
        used.add(lane["id"])
    # WOMD TFExample exposes lane centerlines, not lane polygons: explicitly
    # label the 3.8m corridor approximation in every imported scenario.
    return lanes, points, [corridor(lane["points"], 1.9) for lane in lanes]


def from_waymax_state(state, scenario_id):
    log = state.log_trajectory
    values = {key: np.asarray(getattr(log, key))
              for key in ("x", "y", "vel_x", "vel_y", "yaw", "length", "width", "valid")}
    sdc = np.flatnonzero(np.asarray(state.object_metadata.is_sdc))
    if len(sdc) != 1:
        raise DatasetError("Expected exactly one SDC in decoded record.")
    ego_index, start = int(sdc[0]), 10
    if log.num_timesteps <= start + 1 or not bool(values["valid"][ego_index, start]):
        raise DatasetError("Record has no valid current SDC state and future simulation interval.")
    object_ids = np.asarray(state.object_metadata.ids)
    kinds = np.asarray(state.object_metadata.object_types)
    def object_at(i, t):
        return vehicle("ego" if i == ego_index else str(int(object_ids[i])),
                       float(values["x"][i, t]), float(values["y"][i, t]), float(np.hypot(values["vel_x"][i, t], values["vel_y"][i, t])),
                       float(values["yaw"][i, t]), max(float(values["length"][i, t]), .2), max(float(values["width"][i, t]), .2),
                       kind={1: "vehicle", 2: "pedestrian", 3: "cyclist"}.get(int(kinds[i]), "other"),
                       valid=bool(values["valid"][i, t]))
    ego = object_at(ego_index, start)
    lanes, route, roads = lane_geometry(state, ego)
    tracks = [[object_at(i, t) for i in range(log.num_objects) if i != ego_index and bool(values["valid"][i, t])]
              for t in range(start, log.num_timesteps)]
    xy = np.asarray([p for lane in lanes for p in lane["points"]])
    public = dict(id=scenario_id, name=f"WOMD · {scenario_id[-8:]}",
                  description="Decoded local WOMD TFExample. Other actors replay logged motion; road corridors approximate lane width (3.8 m). Traffic signals are not enforced.",
                  source="waymo-open-motion", dt=.1, duration=(len(tracks) - 1) * .1,
                  bounds=[float(xy[:, 0].min() - 5), float(xy[:, 1].min() - 5), float(xy[:, 0].max() + 5), float(xy[:, 1].max() + 5)],
                  road_polygons=roads, lanes=lanes, route=route, ego=ego, actors=tracks[0],
                  tags=["WOMD", "logged-actors", "approximate-road", "signals-not-modeled"])
    return ScenarioData(public, tracks, state, ego_index, start,
                        notes=["Local decoded WOMD; no benchmark claim.", "Road width approximated from lane centerlines; traffic lights not enforced."],
                        road_cells=[cell for lane in lanes for cell in corridor_cells(lane["points"], 1.9)])


def sanitize_dimensions(state, processed):
    """Replace full-track averaged dimensions with latest valid visible values."""
    import jax.numpy as jnp
    valid = np.asarray(processed["state/all/valid"]) > 0
    replacements = {}
    for key, default in (("length", 4.6), ("width", 1.85), ("height", 1.5)):
        raw = np.asarray(processed[f"state/all/{key}"], dtype=np.float32)
        last = np.full(raw.shape[0], default, np.float32)
        causal = np.empty_like(raw)
        for t in range(raw.shape[1]):
            known = valid[:, t] & np.isfinite(raw[:, t]) & (raw[:, t] > 0)
            last = np.where(known, raw[:, t], last)
            causal[:, t] = last
        replacements[key] = jnp.asarray(causal)
    return state.replace(log_trajectory=state.log_trajectory.replace(**replacements))


def import_dataset(path, limit):
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 20:
        raise DatasetError("Import limit must be an integer between 1 and 20.")
    file = Path(path).expanduser().resolve()
    if not file.is_file():
        raise DatasetError("Provide an existing local WOMD TFExample TFRecord file, not a directory or cloud URL.")
    if file.stat().st_size == 0:
        raise DatasetError("Dataset file is empty.")
    if not available():
        raise DatasetError("Waymax/TensorFlow dependencies are missing. Install backend[waymax], then import a WOMD tf_example TFRecord shard.")
    try:
        from waymax import config, dataloader
        import tensorflow as tf
        data_config = config.DatasetConfig(path=str(file), repeat=1, batch_dims=(), shuffle_seed=None,
                                           deterministic=True, num_shards=1, max_num_objects=128,
                                           include_sdc_paths=False, max_num_rg_points=30000,
                                           drop_remainder=False)
        # Decode through Waymax's public dataloader preprocess/factory functions.
        # Retain raw time-varying dimensions before its factory averages them.
        records = tf.data.TFRecordDataset(str(file)).take(limit)
        imported = []
        prefix = hashlib.sha256((str(file) + str(file.stat().st_size) + str(file.stat().st_mtime_ns)).encode()).hexdigest()[:12]
        for i, record in enumerate(records):
            serialized = record.numpy()
            example = tf.train.Example.FromString(serialized)
            if "state/current/x" not in example.features.feature or "roadgraph_samples/xyz" not in example.features.feature:
                raise DatasetError("Expected WOMD TFExample features (state/current/x and roadgraph_samples/xyz). Scenario-protobuf TFRecords need conversion first.")
            point_count = len(example.features.feature["roadgraph_samples/xyz"].float_list.value) // 3
            if not 1 <= point_count <= 100000:
                raise DatasetError("Invalid WOMD roadgraph point count.")
            record_config = replace(data_config, max_num_rg_points=point_count)
            processed = dataloader.preprocess_serialized_womd_data(serialized, record_config)
            arrays = {key: value.numpy() if hasattr(value, "numpy") else np.asarray(value) for key, value in processed.items()}
            state = dataloader.simulator_state_from_womd_dict(arrays, include_sdc_paths=False)
            state = sanitize_dimensions(state, arrays)
            scenario = from_waymax_state(state, f"womd-{prefix}-{i}")
            marker = example.features.feature.get("drivelab/source")
            if marker and list(marker.bytes_list.value) == [b"synthetic-fixture"]:
                scenario.public["source"] = "synthetic-tfexample"
                scenario.public["name"] = f"Generated TFExample · {i + 1}"
                scenario.public["description"] = "Generated synthetic TFExample fixture decoded through Waymax. Not a Waymo dataset record or benchmark. Lane widths are approximated."
                scenario.public["tags"] = ["generated-fixture", "synthetic", "approximate-road"]
                scenario.notes = ["Generated synthetic TFExample fixture; no real Waymo data used.", "Road width approximated from lane geometry."]
            imported.append(scenario)
        if not imported:
            raise DatasetError("TFRecord contains no decoded scenarios.")
        return imported
    except DatasetError:
        raise
    except Exception as exc:
        raise DatasetError(f"WOMD TFExample decode failed ({type(exc).__name__}): {str(exc)[:350]}. Use tf_example records; raw Scenario-protobuf TFRecords are not supported by Waymax's TFExample loader.") from exc
