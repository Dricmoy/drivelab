from dataclasses import dataclass, field
from copy import deepcopy
import math

import numpy as np

from .geometry import corridor


def vehicle(id, x, y, speed=0.0, yaw=0.0, length=4.6, width=1.85, kind="vehicle", valid=True):
    return dict(id=id, x=float(x), y=float(y), yaw=float(yaw), speed=float(speed),
                length=float(length), width=float(width), kind=kind, valid=bool(valid))


@dataclass
class ScenarioData:
    public: dict
    actor_tracks: list[list[dict]]
    waymax_state: object | None = None
    ego_index: int = 0
    start_index: int = 0
    notes: list[str] = field(default_factory=list)
    road_cells: list[list[list[float]]] = field(default_factory=list)

    def actors_at(self, step):
        return deepcopy(self.actor_tracks[min(step, len(self.actor_tracks) - 1)])

    def serialize(self):
        return {"public": self.public, "actor_tracks": self.actor_tracks, "notes": self.notes, "road_cells": self.road_cells}


def make_scenario(id, name, description, actors, half_width=5.5, duration=10., route=None, tags=None):
    dt = 0.1
    route = route or [[0., 0.], [120., 0.]]
    if len(route) == 2:
        road_route = [[-10., 0.], [140., 0.]]
    else:
        p = np.asarray(route)
        first, last = p[1] - p[0], p[-1] - p[-2]
        road_route = [(p[0] - 10 * first / np.linalg.norm(first)).tolist(), *route,
                      (p[-1] + 10 * last / np.linalg.norm(last)).tolist()]
    road = corridor(road_route, half_width)
    tracks = []
    for t in np.arange(round(duration / dt) + 1) * dt:
        frame = []
        for actor in actors:
            a = deepcopy(actor)
            a["x"] += math.cos(a["yaw"]) * a["speed"] * float(t)
            a["y"] += math.sin(a["yaw"]) * a["speed"] * float(t)
            frame.append(a)
        tracks.append(frame)
    all_points = np.asarray(road)
    lane_offsets = [-3.4, 0., 3.4] if half_width > 4 else [0.]
    p = np.asarray(road_route)
    direction = np.gradient(p, axis=0)
    direction /= np.linalg.norm(direction, axis=-1, keepdims=True)
    normal = np.stack((-direction[:, 1], direction[:, 0]), -1)
    lanes = [dict(id=f"lane-{i}", points=(p + offset * normal).tolist()) for i, offset in enumerate(lane_offsets)]
    public = dict(id=id, name=name, description=description, source="synthetic", dt=dt,
                  duration=duration, bounds=[float(all_points[:, 0].min() - 5), float(all_points[:, 1].min() - 8),
                                            float(all_points[:, 0].max() + 5), float(all_points[:, 1].max() + 8)],
                  road_polygons=[road], lanes=lanes, route=route,
                  ego=vehicle("ego", route[0][0], route[0][1], 8., math.atan2(route[1][1]-route[0][1], route[1][0]-route[0][0])),
                  actors=deepcopy(actors), tags=tags or [])
    return ScenarioData(public, tracks, notes=["Synthetic fixture; other actors replay prescribed motion."])


def synthetic_scenarios():
    angles = np.linspace(0, 1.4, 81)
    curve = np.stack((70 * np.sin(angles), 70 * (1 - np.cos(angles))), -1).tolist()
    scenarios = [
        make_scenario("parked-car", "Parked car", "A stationary vehicle blocks the route. Brake or use the free road corridor.",
                      [vehicle("parked", 40, 0)], tags=["obstacle", "avoidance"]),
        make_scenario("slow-lead", "Slow lead vehicle", "Catch a vehicle travelling at 3 m/s. Match its speed or pass safely.",
                      [vehicle("lead", 24, 0, 3)], tags=["following", "overtaking"]),
        make_scenario("cross-traffic", "Crossing traffic", "A vehicle crosses the route. Constant-velocity prediction can reveal the conflict.",
                      [vehicle("crossing", 40, -20, 5, math.pi / 2)], tags=["intersection", "yield"]),
        make_scenario("narrow-stop", "Blocked narrow road", "A stopped van occupies a narrow corridor. Passing would leave the road.",
                      [vehicle("van", 45, 0, length=5.4, width=2.1)], half_width=2.25, tags=["braking", "road-boundary"]),
        make_scenario("oncoming", "Oncoming vehicle", "An oncoming vehicle occupies the route while lateral space remains free.",
                      [vehicle("oncoming", 80, 0, 8, math.pi)], tags=["oncoming", "avoidance"]),
        make_scenario("staggered-obstacles", "Staggered obstacles", "Two stopped vehicles require successive decisions along a wide road.",
                      [vehicle("obstacle-a", 36, 0), vehicle("obstacle-b", 72, -2.9)], duration=12., tags=["multi-obstacle", "replanning"]),
        make_scenario("clear-road", "Clear road", "An unobstructed control case for progress and comfort measurements.",
                      [], tags=["control", "cruise"]),
        make_scenario("curved-road", "Sweeping bend", "Follow a curved road and avoid a stopped car on the bend. Candidate headings follow map tangents.",
                      [vehicle("bend-obstacle", 70 * math.sin(.55), 70 * (1 - math.cos(.55)), yaw=.55)],
                      route=curve, tags=["curved-route", "turning", "obstacle"]),
        make_scenario("turning-traffic", "Turning traffic", "An actor turns onto the route. Compare straight-line forecasting with learned turning residuals.",
                      [vehicle("turner", 20, -20, 6, math.pi / 2)], tags=["motion-forecast", "turning", "merge"]),
    ]
    crossing = next(s for s in scenarios if s.public["id"] == "cross-traffic")
    crossing.public["road_polygons"].append([[34.5, -32], [45.5, -32], [45.5, 32], [34.5, 32]])
    crossing.public["lanes"].append(dict(id="crossing-lane", points=[[40., -32.], [40., 32.]]))
    points = np.asarray([p for polygon in crossing.public["road_polygons"] for p in polygon])
    crossing.public["bounds"] = [float(points[:, 0].min() - 5), float(points[:, 1].min() - 8),
                                float(points[:, 0].max() + 5), float(points[:, 1].max() + 8)]
    turning = next(s for s in scenarios if s.public["id"] == "turning-traffic")
    turn_end = math.pi / (.3 * 2)
    for index, frame in enumerate(turning.actor_tracks):
        time = index * turning.public["dt"]
        angle = min(.3 * time, math.pi / 2)
        frame[0].update(x=20 + 20 * (1 - math.cos(angle)) + 6 * max(0., time - turn_end),
                        y=-20 + 20 * math.sin(angle), yaw=math.pi / 2 - angle)
    turning.public["actors"] = deepcopy(turning.actor_tracks[0])
    angles = np.linspace(0, math.pi / 2, 41)
    actor_route = np.stack((20 + 20 * (1 - np.cos(angles)), -20 + 20 * np.sin(angles)), -1).tolist()
    turning.public["road_polygons"].append(corridor(actor_route, 5.5))
    turning.public["lanes"].append(dict(id="turning-lane", points=actor_route))
    points = np.asarray([p for polygon in turning.public["road_polygons"] for p in polygon])
    turning.public["bounds"] = [float(points[:, 0].min() - 5), float(points[:, 1].min() - 8),
                               float(points[:, 0].max() + 5), float(points[:, 1].max() + 8)]
    return {s.public["id"]: s for s in scenarios}
