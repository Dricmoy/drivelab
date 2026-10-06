"""Generated TFExample fixtures verify decoding; no Waymo dataset is supplied."""
import numpy as np
import pytest

from drivelab.waymax_adapter import available, import_dataset, WaymaxStepper


def write_generated_tfexample(path, future_length=4.6):
    import tensorflow as tf
    from waymax.dataloader import womd_utils
    schema = womd_utils.get_features_description(max_num_rg_points=30000, include_sdc_paths=False)
    arrays = {key: np.zeros(spec.shape, dtype=np.float32 if spec.dtype == tf.float32 else np.int64)
              for key, spec in schema.items()}
    arrays["state/id"][:] = -1
    arrays["state/id"][:2] = [0, 1]
    arrays["state/type"][:2] = 1
    arrays["state/is_sdc"][0] = 1
    arrays["state/tracks_to_predict"][:2] = 1
    for part, times in (("past", np.arange(10) * .1), ("current", np.array([1.])),
                        ("future", np.arange(11, 91) * .1)):
        for object_id, speed in ((0, 8.), (1, 2.)):
            for key, value in (("x", speed * times + (0 if object_id == 0 else 30)),
                               ("y", 0.), ("velocity_x", speed), ("velocity_y", 0.),
                               ("speed", speed), ("bbox_yaw", 0.), ("vel_yaw", 0.),
                               ("length", future_length if part == "future" else 4.6),
                               ("width", 1.85), ("height", 1.5), ("valid", 1),
                               ("timestamp_micros", (times * 1e6).astype(np.int64))):
                arrays[f"state/{part}/{key}"][object_id] = value
    # 32 lane samples + boundaries, with every other roadgraph slot invalid.
    for index, y, kind, direction in ((0, 0., 2, 1), (1, -5.5, 15, 1), (2, 5.5, 15, -1)):
        sl = slice(index * 32, (index + 1) * 32)
        arrays["roadgraph_samples/xyz"][sl, 0] = np.linspace(-20, 140, 32)
        arrays["roadgraph_samples/xyz"][sl, 1] = y
        arrays["roadgraph_samples/dir"][sl, 0] = direction
        arrays["roadgraph_samples/id"][sl, 0] = index + 100
        arrays["roadgraph_samples/type"][sl, 0] = kind
        arrays["roadgraph_samples/valid"][sl, 0] = 1
    features = {}
    for key, values in arrays.items():
        if schema[key].dtype == tf.float32:
            features[key] = tf.train.Feature(float_list=tf.train.FloatList(value=values.ravel()))
        else:
            features[key] = tf.train.Feature(int64_list=tf.train.Int64List(value=values.ravel()))
    example = tf.train.Example(features=tf.train.Features(feature=features)).SerializeToString()
    example_proto = tf.train.Example.FromString(example)
    example_proto.features.feature["drivelab/source"].bytes_list.value.append(b"synthetic-fixture")
    example = example_proto.SerializeToString()
    with tf.io.TFRecordWriter(str(path)) as writer:
        writer.write(example)
        writer.write(example)


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
def test_actual_local_decoder_limit_causal_dimensions_and_stepping(tmp_path):
    path = tmp_path / "generated-synthetic-only.tfrecord"
    write_generated_tfexample(path, future_length=9.)
    imported = import_dataset(str(path), 1)
    assert len(imported) == 1  # File really has two records; bounded decoding.
    scenario = imported[0]
    assert scenario.public["source"] == "synthetic-tfexample"
    assert scenario.public["ego"]["x"] == pytest.approx(8.)
    assert scenario.public["ego"]["length"] == pytest.approx(4.6)
    assert scenario.public["actors"][0]["length"] == pytest.approx(4.6)
    assert scenario.public["route"][0] == pytest.approx([-20, 0])
    assert len(scenario.actor_tracks) == 81
    stepper = WaymaxStepper(scenario)
    assert int(stepper.state.timestep) == 10
    ego, actors = stepper.step(dict(scenario.public["ego"], x=8.8))
    assert int(stepper.state.timestep) == 11
    assert ego["x"] == pytest.approx(8.8)
    assert ego["length"] == pytest.approx(4.6)
    assert actors[0]["x"] == pytest.approx(32.2)
    # Arrival-time actor dimensions can change, but current observations cannot
    # be affected by poisoning future dimensions before the first decision.
    from drivelab.geometry import Route
    from drivelab.models import PlannerConfig
    from drivelab.planner import decide
    clean_path = tmp_path / "clean-generated.tfrecord"
    write_generated_tfexample(clean_path)
    clean = import_dataset(str(clean_path), 1)[0]
    def decision(s):
        p = s.public
        return decide(p["ego"], p["actors"], Route(p["route"]), p["road_polygons"], PlannerConfig(), .1, "lattice")
    assert decision(clean).candidates == decision(scenario).candidates


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
def test_generated_tfexample_import_through_api_and_restart(tmp_path):
    from fastapi.testclient import TestClient
    from drivelab.api import create_app
    path = tmp_path / "generated-synthetic-tfexample.tfrecord"
    write_generated_tfexample(path)
    db = tmp_path / "generated-test.db"
    client = TestClient(create_app(db, engine="waymax"))
    response = client.post("/api/datasets/import", json={"path": str(path), "limit": 1})
    assert response.status_code == 200, response.text
    assert response.json()["source"] == "synthetic-tfexample"
    assert response.json()["imported"] == 1
    assert client.get("/api/health").json()["dataset_count"] == 0
    id = response.json()["scenarios"][0]["id"]
    scenario = client.get(f"/api/scenarios/{id}").json()
    assert scenario["source"] == "synthetic-tfexample"
    assert scenario["ego"]["length"] == pytest.approx(4.6)
    result = client.post("/api/runs", json={"scenario_id": id, "planner": "lattice"})
    assert result.status_code == 200, result.text
    assert result.json()["engine"] == "waymax-state-dynamics"
    assert len(result.json()["frames"]) == 81
    assert result.json()["source"] == "synthetic-tfexample"
    restarted = TestClient(create_app(db, engine="waymax"))
    assert restarted.get("/api/health").json()["dataset_count"] == 0
    assert restarted.get(f"/api/scenarios/{id}").json() == scenario
    assert restarted.app.state.scenarios[id].road_cells == client.app.state.scenarios[id].road_cells
    second = restarted.post("/api/runs", json={"scenario_id": id, "planner": "lattice"})
    assert second.status_code == 200, second.text
    assert second.json()["metrics"]["distance"] == pytest.approx(result.json()["metrics"]["distance"], abs=.01)
