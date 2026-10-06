"""Frenet lattice: short rollouts, current-state CV predictions, first-step execution."""
from dataclasses import dataclass
import math

import numpy as np

from .geometry import Route, corners, on_road
from .models import PlannerConfig
from .native_scoring import score_actors


@dataclass
class Decision:
    candidates: list[dict]
    selected: int
    trajectories: np.ndarray
    speeds: np.ndarray
    explanation: str
    actor_forecasts: list[dict]


def predict_actors(actors, times):
    # No ScenarioData, actor_tracks, or log trajectory can enter the planner.
    return [dict(actor, x=actor["x"] + np.cos(actor["yaw"]) * actor["speed"] * times,
                 y=actor["y"] + np.sin(actor["yaw"]) * actor["speed"] * times)
            for actor in actors if actor.get("valid", True)]


def decide(ego, actors, route: Route, roads, config: PlannerConfig, dt, planner, previous_acceleration=0., predicted_actors=None):
    s0, d0 = route.project(ego["x"], ego["y"])
    _, route_yaw = route.sample(s0)
    heading_error = math.atan2(math.sin(ego["yaw"] - route_yaw), math.cos(ego["yaw"] - route_yaw))
    v0 = max(0., ego["speed"] * math.cos(heading_error))
    lateral_v0 = ego["speed"] * math.sin(heading_error)
    cruise_acc = float(np.clip((config.target_speed - v0) * 1.5, -3., 2.))
    if planner == "baseline":
        accelerations, offsets = np.array([cruise_acc]), np.array([0.])
    else:
        pairs = [(a, d) for a in sorted(set([-5., -3., -1., 0., 2., cruise_acc]))
                 for d in [-5.1, -3.4, -1.7, 0., 1.7, 3.4, 5.1]]
        accelerations, offsets = np.asarray(pairs).T
    n, steps = len(accelerations), int(math.ceil(config.horizon / dt))
    times = np.arange(1, steps + 1) * dt
    trajectories = np.zeros((n, steps, 3))
    speeds = np.zeros((n, steps))
    lat_accs = np.zeros((n, steps))
    s, d = np.full(n, s0), np.full(n, d0)
    v, lateral_v = np.full(n, v0), np.full(n, lateral_v0)
    for k in range(steps):
        next_v = np.maximum(0., v + accelerations * dt)
        # Positive accelerations may not exceed the requested cruise speed.
        next_v = np.where(accelerations > 0, np.minimum(next_v, max(config.target_speed, v0)), next_v)
        # The route endpoint is a stopping goal; constrain forward motion to it.
        remaining = np.maximum(0., route.length - s)
        next_v = np.minimum(next_v, np.sqrt(2 * 3.0 * remaining))
        advancement = (v + next_v) * dt / 2
        at_end = advancement >= remaining
        s = np.minimum(route.length, s + advancement)
        next_v = np.where(at_end, 0., next_v)
        lat_acc = np.clip(2.8 * (offsets - d) - 3.2 * lateral_v, -2.5, 2.5)
        next_lat_v = np.clip(lateral_v + lat_acc * dt, -2., 2.)
        next_lat_v = np.clip(next_lat_v, -next_v * 0.5, next_v * 0.5)
        d += (lateral_v + next_lat_v) * dt / 2
        # A stopped car stays stopped rather than sliding sideways.
        next_lat_v = np.where(next_v < 0.05, 0., next_lat_v)
        xy, tangent_yaw = route.sample(s, d)
        trajectories[:, k, :2] = xy
        trajectories[:, k, 2] = tangent_yaw + np.arctan2(next_lat_v, np.maximum(next_v, 0.01))
        speeds[:, k] = np.hypot(next_v, next_lat_v)
        lat_accs[:, k] = lat_acc
        v, lateral_v = next_v, next_lat_v

    boxes = corners(trajectories[..., 0], trajectories[..., 1], trajectories[..., 2], ego["length"], ego["width"])
    road_valid = on_road(boxes, roads)
    inflated = corners(trajectories[..., 0], trajectories[..., 1], trajectories[..., 2],
                       ego["length"] + 2 * config.safety_margin, ego["width"] + 2 * config.safety_margin)
    predictions = predicted_actors if predicted_actors is not None else predict_actors(actors, times)
    actor_boxes = [corners(actor["x"], actor["y"], actor["yaw"], actor["length"], actor["width"]) for actor in predictions]
    actor_boxes = np.stack(actor_boxes) if actor_boxes else np.empty((0, steps, 4, 2))
    collision, clearance = score_actors(boxes, inflated, actor_boxes, config.scoring)
    collision_cost = collision.sum(-1) * 10000. + np.mean(1 / np.maximum(clearance, 0.1), -1)
    offroad_cost = (~road_valid).sum(-1) * 20000.
    progress_cost = -(s - s0) * 2.0 + np.mean((speeds - config.target_speed)**2, -1) * 6.0
    comfort_cost = accelerations**2 * .20 + np.mean(lat_accs**2, -1) * .30 + np.abs(offsets) * .65 + np.abs(accelerations - previous_acceleration) * .18
    cost = collision_cost + offroad_cost + progress_cost + comfort_cost
    feasible = ~collision.any(-1) & road_valid.all(-1)
    if planner == "baseline":
        selected = 0
        explanation = "Route follower: track the lane center and requested speed; no obstacle avoidance."
    else:
        allowed = np.where(feasible)[0]
        selected = int(allowed[np.argmin(cost[allowed])]) if len(allowed) else int(np.argmin(cost))
        rejected_collision, rejected_road = int(collision.any(-1).sum()), int((~road_valid).any(-1).sum())
        explanation = (f"Selected {'feasible' if feasible[selected] else 'least-cost emergency'} trajectory: "
                       f"acceleration {accelerations[selected]:+.1f} m/s², lateral target {offsets[selected]:+.1f} m. "
                       f"{rejected_collision}/{n} candidates predict a safety-margin overlap; "
                       f"{rejected_road}/{n} leave the road. "
                       f"Traffic forecast: {'learned motion residuals from observed history' if predicted_actors is not None else 'constant velocity'} over {config.horizon:.1f} s.")
    candidates = [dict(id=f"candidate-{i}", points=trajectories[i, :, :2].tolist(), cost=float(cost[i]),
                       feasible=bool(feasible[i]), collision_cost=float(collision_cost[i]), offroad_cost=float(offroad_cost[i]),
                       progress_cost=float(progress_cost[i]), comfort_cost=float(comfort_cost[i]),
                       acceleration=float(accelerations[i]), offset=float(offsets[i])) for i in range(n)]
    observed = {actor["id"]: actor for actor in actors}
    forecasts = [dict(actor_id=actor["id"], times=[0.] + times.tolist(),
                      points=[[observed[actor["id"]]["x"], observed[actor["id"]]["y"]]] +
                             np.stack((actor["x"], actor["y"]), axis=-1).tolist()) for actor in predictions]
    return Decision(candidates, selected, trajectories, speeds, explanation, forecasts)
