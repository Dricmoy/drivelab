# DriveLab backend

From the project root:

```sh
.venv/bin/python -m pip --isolated install --index-url https://pypi.org/simple -e 'backend[test]'
.venv/bin/python -m pytest backend/tests -q
.venv/bin/uvicorn drivelab.api:app --host 127.0.0.1 --port 8765
```

The editable package must be installed or `PYTHONPATH=backend` supplied. Pytest's
backend configuration sets its own import path. The API serves `web/dist` plus
SPA fallback and keeps reports in `data/drivelab.sqlite3`. `DRIVELAB_DB` overrides
the database path. `DRIVELAB_FORECAST_PATH` overrides the model checkpoint path.
`create_app(db_path, static_dir, engine, forecast_path)` supports isolated
tests. `engine="numpy"` forces the deterministic dependency-light implementation;
default `auto` uses actual Waymax when its imports succeed. The compatibility
extra pins JAX/TF/Flax; the root `requirements-waymax.txt` is the fully pinned
environment used by the project. Do not upgrade these transitively.

## Contract

`GET /api/scenarios` returns summary arrays; `GET /api/scenarios/{id}` returns
geometry and initial objects. `POST /api/runs` accepts `scenario_id`, `planner`
(`baseline` or `lattice`), and `config` (`target_speed` 1–20 m/s, `safety_margin`
0–3 m, `horizon` 1–5 s, `prediction` constant_velocity or learned, and `scoring`
auto, numpy or rust).
Default config is 8 m/s, 1 m, 3 s, constant velocity, automatic scoring, matching the UI. It returns
the full report from `web/src/types.ts`. `GET /api/runs` returns persisted
summaries without frames; `GET /api/runs/{id}` loads the complete replay on
demand. The list has a bounded optional `limit` (1–100, default 50).
New full replays use lossless zlib compression in SQLite; earlier JSON rows
remain readable without migration or data loss.

`GET /api/health` also reports `native_available`. Build with `make native`;
automatic scoring resolves to Rust when its ABI-compatible library loads, or
NumPy otherwise. Explicit unavailable Rust returns 503 with setup instructions.
`scoring_backend` records actual execution independently of the Waymax/NumPy
simulation engine. The checked ctypes wrapper owns contiguous float64 buffers;
native code retains no pointers. Rust accelerates collision/clearance only,
preserving Python road checks, candidate generation, and cost weights.

New frames retain `actor_forecasts`: actor IDs, relative forecast times, and
points used by the planner. Each path begins at the observed actor position;
no recorded future is used for the overlay. Terminal frames have no forecasts.
Reports also retain `timing` with total_seconds, planning_seconds, decisions and
mean_decision_ms. Decision time includes candidate generation/road checks/scoring
but excludes forecasting and environment stepping. Timings are local wall-clock
measurements, not safety guarantees. Legacy reports without these additive fields
remain readable.

`POST /api/evaluations` accepts `scenario_ids` (1–100) and the same config, runs
both planners from identical initial states, and returns their summaries plus
arithmetic means computed from them. Duplicate ids are deduplicated. Summary
`collision`/`offroad` and their `_rate` aliases are fractions; `success_rate`
means no collision or road departure, not arrival at the goal. Evaluations and
their constituent runs persist; `GET /api/evaluations/{id}` retrieves one.
Evaluation summaries retain run IDs, config, source, metrics and failures, but
not duplicate copies of every candidate trajectory. Full constituent runs are
available through their run IDs.

`GET /api/model` returns checkpoint status and synthetic validation metrics.
`POST /api/model/train` accepts strict integer seed (0–100000) and epochs
(10–200) and trains a small PyTorch residual network on deterministic generated
trajectories. Full-trajectory train/validation seeds are disjoint. Inference
receives only current actors and 0.1-second observed history; unsupported motion
or missing history uses constant velocity. These are not real Waymo training
or benchmark scores. Use `make ml` for the optional dependency.

`POST /api/datasets/import` accepts an existing local `path` and integer `limit`
(1–20). The decoder reads at most that many actual TFRecords through Waymax's
public TFExample preprocess/factory APIs. Roadgraph array size is read from
the record, supporting 20k and 30k sample layouts. No file means no imported
scenarios; invalid/missing dependencies or format produces an actionable 400.
Imported scenarios also persist in SQLite, without modifying the source file.

## Simulation and provenance

Nine deterministic synthetic fixtures include a curved route, crossing topology,
turning traffic, and a clear control. Summary payloads also
include route, road polygons, and bounds for genuine thumbnails. Baseline tracks route and target speed. Lattice proposes acceleration
and lateral targets, rolls forward 1–5 seconds, predicts other actors using
observed speed/heading or learned residuals from observed motion history,
checks oriented boxes (SAT) and road polygon union,
and executes just the first 0.1-second step. Costs, rejected paths, explanations,
and measured failure frames are retained. There is no future ego route extraction
or logged actor future access in `planner.py`.

Waymax uses `BaseEnvironment.reset`/`step` with `StateDynamics` absolute
`(N,5)` actions and `(N,1)` valid masks, controlled SDC and replayed non-ego
actors. Imported original states start at step 10 after 11 warmup steps; persisted
decoded scenes are reconstructed from their saved current state and actor tracks
after a server restart. Runtime engine is labeled in each report. Simulation
stops at the finite log horizon. A dependency import check makes health availability
more than a package-presence claim.

WOMD factory averages dimensions across the full log. Import replaces those
dimensions with each object's most recent valid raw visible dimension at each
timestep before constructing planner observations. Routes use static lane geometry
and initial heading; continuation links are heuristic. Imported road corridors use
an explicitly labeled 3.8m width approximation. Traffic signals are not enforced;
other actors do not respond to ego; pose dynamics permit actions that a real
vehicle could not execute. Collision checks include three interpolated substeps
per transition, rather than a formal continuous collision proof. The report
continues recording after failures; there is no collision-response physics.

Progress is route arclength completed divided by remaining route length (0–1).
Distance sums actual ego displacements. Mean speed is distance / elapsed time.
Jerk is the norm of the finite difference of vector acceleration, including
the initial change from zero acceleration. Clearance is exact oriented-box edge
distance capped at 100m; no valid actors gives this finite 100m sentinel.
Candidate feasibility is a prediction over the selected horizon, not a guarantee
about the rest of the scenario.

Tests cover geometry, road footprint, computed outcomes, metrics reconstruction,
determinism, configuration sensitivity, no future-log influence on the first
decision, API contract/range validation, SQLite restart, paired summaries, static
fallback, import errors, actual installed Waymax stepping, and generated TFExample
decoding/causal dimensions. Generated decoder fixtures are synthetic tests only.
Generated records include a `drivelab/source=synthetic-fixture` marker; their
imported source remains `synthetic-tfexample` through the API and persistence.
Health `dataset_count` counts only `waymo-open-motion` sources, excluding these
generated test records. Import checks use a 25m grid index and short corridor
sections sharing the original lane normals; bounding-box rejection and unresolved
footprint checks avoid evaluating far-away or already-covered road polygons.
Full lane coordinates and viewer polygons remain available without decimation.
The user's actual WOMD shard has not been supplied or benchmarked.
