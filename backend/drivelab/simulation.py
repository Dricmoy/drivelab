from copy import deepcopy
from datetime import datetime, timezone
import math
from time import perf_counter
import uuid

import numpy as np

from .geometry import Route, RoadMap, corners, sat_overlap, on_road, box_clearance
from .models import PlannerConfig
from .planner import decide
from .native_scoring import resolve_backend


def scene_metrics(ego, actors, roads):
    box = corners(ego["x"], ego["y"], ego["yaw"], ego["length"], ego["width"])
    collision, clearance = False, 100.0
    for actor in actors:
        if not actor.get("valid", True):
            continue
        other = corners(actor["x"], actor["y"], actor["yaw"], actor["length"], actor["width"])
        collision |= bool(sat_overlap(box, other))
        clearance = min(clearance, float(box_clearance(box, other)))
    return collision, not bool(on_road(box, roads)), clearance


def interpolate(a, b, fraction):
    result = dict(b)
    for key in ("x", "y", "speed"):
        result[key] = a[key] + fraction * (b[key] - a[key])
    delta = math.atan2(math.sin(b["yaw"] - a["yaw"]), math.cos(b["yaw"] - a["yaw"]))
    result["yaw"] = a["yaw"] + fraction * delta
    result["valid"] = a.get("valid", True) and b.get("valid", True)
    return result


def simulate(scenario, planner="lattice", config=None, engine="auto", forecast_checkpoint=None):
    started = perf_counter()
    planning_seconds = 0.
    config = config or PlannerConfig()
    scoring_backend = resolve_backend(config.scoring)
    # Resolve auto once, so an entire persisted run uses one recorded backend.
    execution_config = config.model_copy(update={"scoring": scoring_backend})
    if config.prediction == "learned":
        from .forecast import predict_actors_history, status
        from pathlib import Path
        forecast_checkpoint = forecast_checkpoint or Path(__file__).resolve().parents[2] / "data/models/forecast.pt"
        if not status(forecast_checkpoint).get("trained"):
            raise ValueError("Train the synthetic motion model in the Model tab before choosing learned prediction.")
    public, dt = scenario.public, scenario.public["dt"]
    route = Route(public["route"])
    roads = RoadMap(scenario.road_cells or public["road_polygons"])
    ego = deepcopy(public["ego"])
    start_s, _ = route.project(ego["x"], ego["y"])
    steps = min(round(public["duration"] / dt), len(scenario.actor_tracks) - 1)
    from .waymax_adapter import WaymaxStepper, available
    stepper = None
    if engine == "waymax" or (engine == "auto" and available()):
        stepper = WaymaxStepper(scenario)
    elif scenario.public["source"] != "synthetic":
        raise ValueError("Dataset scenarios require the Waymax dependencies; install backend[waymax].")
    engine_name = "waymax-state-dynamics" if stepper else "numpy-kinematic"
    frames, failures = [], []
    distance, max_jerk, min_clearance = 0., 0., 100.
    acceleration, jerk, previous_acceleration = 0., 0., 0.
    previous_vector_acc = np.zeros(2)
    observed_collision, observed_offroad = False, False
    actors = scenario.actors_at(0)
    for index in range(steps + 1):
        collision, offroad, clearance = scene_metrics(ego, actors, roads)
        # Include all collision checks made between this and the preceding frame.
        if index and frames:
            previous = frames[-1]
            old_actors = {a["id"]: a for a in previous["actors"]}
            for fraction in (.25, .5, .75):
                mid_actors = [interpolate(old_actors[a["id"]], a, fraction)
                              for a in actors if a["id"] in old_actors]
                c, o, cl = scene_metrics(interpolate(previous["ego"], ego, fraction), mid_actors, roads)
                collision |= c
                offroad |= o
                clearance = min(clearance, cl)
        for failure_type, failed, already, message in (
                ("collision", collision, observed_collision, "Ego oriented box overlaps another actor."),
                ("offroad", offroad, observed_offroad, "Ego footprint leaves the road polygon union.")):
            if failed and not already:
                failures.append(dict(time=round(index * dt, 5), frame_index=index, type=failure_type, message=message))
        observed_collision |= collision
        observed_offroad |= offroad
        min_clearance = min(min_clearance, clearance)
        s, _ = route.project(ego["x"], ego["y"])
        progress = float(np.clip((s - start_s) / max(route.length - start_s, 1.), 0., 1.))
        predicted = None
        if config.prediction == "learned" and index < steps:
            history = [f["actors"] for f in frames[-9:]] + [actors]
            times = np.arange(1, int(math.ceil(config.horizon / dt)) + 1) * dt
            predicted = predict_actors_history(actors, history, times, forecast_checkpoint)
        decision = None
        if index < steps:
            decision_started = perf_counter()
            decision = decide(ego, actors, route, roads, execution_config, dt, planner, previous_acceleration, predicted)
            planning_seconds += perf_counter() - decision_started
        frames.append(dict(time=round(index * dt, 5), ego=deepcopy(ego), actors=deepcopy(actors),
                           actor_forecasts=decision.actor_forecasts if decision else [],
                           candidates=decision.candidates if decision else [],
                           selected_candidate=decision.candidates[decision.selected]["id"] if decision else None,
                           explanation=decision.explanation if decision else "End of simulation. " + " ".join(scenario.notes),
                           metrics=dict(collision=collision, offroad=offroad, clearance=clearance,
                                        acceleration=acceleration, jerk=jerk, progress=progress)))
        if index == steps:
            break
        assert decision is not None
        target = decision.trajectories[decision.selected, 0]
        next_ego = dict(ego, x=float(target[0]), y=float(target[1]), yaw=float(target[2]),
                        speed=float(decision.speeds[decision.selected, 0]))
        if stepper:
            next_ego, actors = stepper.step(next_ego)
        else:
            actors = scenario.actors_at(index + 1)
        distance += math.hypot(next_ego["x"] - ego["x"], next_ego["y"] - ego["y"])
        acceleration = (next_ego["speed"] - ego["speed"]) / dt
        old_velocity = ego["speed"] * np.array([math.cos(ego["yaw"]), math.sin(ego["yaw"])])
        new_velocity = next_ego["speed"] * np.array([math.cos(next_ego["yaw"]), math.sin(next_ego["yaw"])])
        vector_acc = (new_velocity - old_velocity) / dt
        jerk = float(np.linalg.norm(vector_acc - previous_vector_acc) / dt)
        max_jerk = max(max_jerk, jerk)
        previous_vector_acc = vector_acc
        previous_acceleration = acceleration
        ego = next_ego
    duration = frames[-1]["time"]
    return dict(id=uuid.uuid4().hex, scenario_id=public["id"], planner=planner, config=config.model_dump(),
                source=public["source"], engine=engine_name, scoring_backend=scoring_backend,
                timing=dict(total_seconds=perf_counter() - started, planning_seconds=planning_seconds,
                            decisions=steps, mean_decision_ms=1000 * planning_seconds / steps if steps else 0.),
                metrics=dict(collision=observed_collision, offroad=observed_offroad, progress=frames[-1]["metrics"]["progress"],
                             distance=distance, mean_speed=distance / duration if duration else 0., max_jerk=max_jerk,
                             min_clearance=min_clearance, duration=duration), frames=frames, failures=failures,
                created_at=datetime.now(timezone.utc).isoformat())
