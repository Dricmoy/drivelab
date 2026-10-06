from copy import deepcopy
import math

import numpy as np
import pytest

from drivelab.geometry import Route
from drivelab.models import PlannerConfig
from drivelab.planner import decide, predict_actors
from drivelab.scenarios import synthetic_scenarios, vehicle
from drivelab.simulation import simulate


@pytest.mark.parametrize("id", ["parked-car", "slow-lead", "cross-traffic", "narrow-stop", "oncoming", "staggered-obstacles", "curved-road"])
@pytest.mark.parametrize("config", [PlannerConfig(target_speed=8, safety_margin=1, horizon=3),
                                   PlannerConfig(target_speed=10, safety_margin=.7, horizon=3)],
                         ids=["ui-defaults", "previous-defaults"])
def test_measured_baseline_failures_and_lattice_safety(id, config):
    scenario = synthetic_scenarios()[id]
    baseline = simulate(scenario, "baseline", config=config, engine="numpy")
    lattice = simulate(scenario, "lattice", config=config, engine="numpy")
    assert baseline["metrics"]["collision"]
    assert any(f["metrics"]["collision"] for f in baseline["frames"])
    assert any(f["type"] == "collision" for f in baseline["failures"])
    assert not lattice["metrics"]["collision"]
    assert not lattice["metrics"]["offroad"]
    assert lattice["metrics"]["progress"] > .25
    assert lattice["metrics"]["min_clearance"] > 0
    assert all(f["explanation"] for f in lattice["frames"])
    assert lattice["source"] == "synthetic"
    assert lattice["engine"] == "numpy-kinematic"


def test_metrics_come_from_frames_and_positions():
    report = simulate(synthetic_scenarios()["parked-car"], engine="numpy")
    positions = np.array([[f["ego"]["x"], f["ego"]["y"]] for f in report["frames"]])
    distance = np.linalg.norm(np.diff(positions, axis=0), axis=-1).sum()
    assert report["metrics"]["distance"] == pytest.approx(distance)
    assert report["metrics"]["mean_speed"] == pytest.approx(distance / report["metrics"]["duration"])
    assert report["metrics"]["max_jerk"] == max(f["metrics"]["jerk"] for f in report["frames"])
    assert report["metrics"]["min_clearance"] == min(f["metrics"]["clearance"] for f in report["frames"])
    assert report["metrics"]["progress"] == report["frames"][-1]["metrics"]["progress"]
    assert len(report["frames"][0]["candidates"]) >= 25
    assert {c["offset"] for c in report["frames"][0]["candidates"]} == {-5.1, -3.4, -1.7, 0., 1.7, 3.4, 5.1}


def test_determinism_and_config_changes_computed_behavior():
    scenario = synthetic_scenarios()["clear-road"]
    a = simulate(scenario, engine="numpy")
    b = simulate(scenario, engine="numpy")
    assert a["frames"] == b["frames"]
    assert a["metrics"] == b["metrics"]
    slower = simulate(scenario, config=PlannerConfig(target_speed=4), engine="numpy")
    assert slower["metrics"]["distance"] < a["metrics"]["distance"] - 20
    assert not a["metrics"]["collision"]


def test_future_log_cannot_change_current_decision():
    scenario = synthetic_scenarios()["cross-traffic"]
    modified = deepcopy(scenario)
    for frame in modified.actor_tracks[1:]:
        frame[0]["x"] = -1000
    a = simulate(scenario, engine="numpy")
    b = simulate(modified, engine="numpy")
    assert a["frames"][0]["candidates"] == b["frames"][0]["candidates"]
    assert a["frames"][0]["selected_candidate"] == b["frames"][0]["selected_candidate"]
    assert a["frames"][0]["actor_forecasts"] == b["frames"][0]["actor_forecasts"]


def test_replay_forecasts_are_the_planner_inputs_not_logged_future():
    scenario = synthetic_scenarios()["turning-traffic"]
    report = simulate(scenario, engine="numpy")
    frame = report["frames"][20]
    for path in frame["actor_forecasts"]:
        actor = next(a for a in frame["actors"] if a["id"] == path["actor_id"])
        assert path["points"][0] == [actor["x"], actor["y"]]
        assert path["times"][0] == 0.
        assert path["times"][-1] == 3.
        expected = predict_actors([actor], np.asarray(path["times"][1:]))[0]
        np.testing.assert_allclose(path["points"][1:], np.stack((expected["x"], expected["y"]), axis=-1))
        logged = scenario.actors_at(20 + len(path["times"]) - 1)[0]
        assert np.linalg.norm(np.asarray(path["points"][-1]) - [logged["x"], logged["y"]]) > 1.
    assert report["frames"][-1]["actor_forecasts"] == []


def test_predictor_uses_observed_heading_and_speed():
    actor = vehicle("a", 10, 20, 3, math.pi / 2)
    result = predict_actors([actor], np.array([1., 2.]))[0]
    np.testing.assert_allclose(result["x"], [10, 10])
    np.testing.assert_allclose(result["y"], [23, 26])


def test_margin_and_horizon_affect_candidate_feasibility():
    s = synthetic_scenarios()["parked-car"].public
    ego = dict(s["ego"], x=20)
    small = decide(ego, s["actors"], Route(s["route"]), s["road_polygons"], PlannerConfig(safety_margin=0), .1, "lattice")
    large = decide(ego, s["actors"], Route(s["route"]), s["road_polygons"], PlannerConfig(safety_margin=3), .1, "lattice")
    assert sum(c["feasible"] for c in small.candidates) > sum(c["feasible"] for c in large.candidates)
    short = decide(ego, s["actors"], Route(s["route"]), s["road_polygons"], PlannerConfig(horizon=1), .1, "lattice")
    assert len(short.candidates[0]["points"]) == 10
    assert len(large.candidates[0]["points"]) == 30


def test_offroad_failure_is_measured():
    scenario = synthetic_scenarios()["clear-road"]
    scenario.public["ego"]["y"] = 10
    report = simulate(scenario, "baseline", engine="numpy")
    assert report["metrics"]["offroad"]
    assert report["failures"][0]["type"] == "offroad"


def test_curving_and_intersection_topology_and_candidate_road_detection():
    scenarios = synthetic_scenarios()
    curve = scenarios["curved-road"]
    assert np.ptp(np.asarray(curve.public["route"])[:, 1]) > 40
    report = simulate(curve, engine="numpy")
    assert abs(report["frames"][-1]["ego"]["yaw"]) > .7
    assert any(c["offroad_cost"] > 0 for f in report["frames"] for c in f["candidates"])
    assert len(scenarios["cross-traffic"].public["road_polygons"]) == 2
    assert any(lane["id"] == "crossing-lane" for lane in scenarios["cross-traffic"].public["lanes"])
    assert len(scenarios["clear-road"].public["lanes"]) == 3
