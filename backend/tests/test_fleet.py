import itertools
import math

import numpy as np

from drivelab.geometry import corners, sat_overlap, on_road
from drivelab.scenarios import synthetic_scenarios
from drivelab.simulation import simulate
from drivelab.models import PlannerConfig


def test_boulevard_has_real_stable_nonoverlapping_actor_tracks():
    scenario = synthetic_scenarios()["busy-boulevard"]
    actors = scenario.public["actors"]
    assert len(actors) == 36
    assert len({a["id"] for a in actors}) == 36
    assert sum(a["speed"] > 0 for a in actors) == 28
    assert sum(a["speed"] == 0 for a in actors) == 8
    assert len({(a["length"], a["width"]) for a in actors}) == 4
    assert len({a["speed"] for a in actors}) > 8
    assert actors == synthetic_scenarios()["busy-boulevard"].public["actors"]
    assert scenario.public["source"] == "synthetic"
    assert "prescribed" in scenario.public["description"]
    for step, frame in enumerate(scenario.actor_tracks):
        assert [a["id"] for a in frame] == [a["id"] for a in actors]
        boxes = [corners(a["x"], a["y"], a["yaw"], a["length"], a["width"]) for a in frame]
        assert all(on_road(box, scenario.public["road_polygons"]) for box in boxes)
        assert all(not sat_overlap(a, b) for a, b in itertools.combinations(boxes, 2))
        for initial, actor in zip(actors, frame):
            t = step * scenario.public["dt"]
            np.testing.assert_allclose([actor["x"], actor["y"]],
                [initial["x"] + math.cos(initial["yaw"]) * initial["speed"] * t,
                 initial["y"] + math.sin(initial["yaw"]) * initial["speed"] * t])


def test_boulevard_traffic_is_in_forecasts_planner_and_metrics():
    scenario = synthetic_scenarios()["busy-boulevard"]
    report = simulate(scenario, config=PlannerConfig(scoring="numpy"), engine="numpy")
    assert all(len(frame["actors"]) == 36 for frame in report["frames"])
    assert len(report["frames"][0]["actor_forecasts"]) == 36
    assert report["timing"]["decisions"] == 100
    assert report["source"] == "synthetic"
    assert report["frames"][0]["metrics"]["clearance"] < 20
    assert any(c["collision_cost"] > 0 for c in report["frames"][0]["candidates"])
    assert report["metrics"]["collision"] == any(f["metrics"]["collision"] for f in report["frames"])
