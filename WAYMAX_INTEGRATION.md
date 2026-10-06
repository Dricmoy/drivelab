# Independent official Waymax integration verification

Scope: verification only, no backend/web edits. Source inspected at official
commit `a64dfec9be8576b60d9cecc94f406d9812d4a7d0` in
`/tmp/drivelab-waymax-verify.gUkbz4/waymax`. The installed official source at the
same commit was exercised successfully after the parent installation.
`scripts/verify_waymax.py` is self-contained and generates synthetic
fixtures; these are explicitly not records from the Waymo dataset.

## Runtime handoff to main / backend

Verified on 2026-10-02 using the shared `.venv`: **all standalone integration
checks passed**, with the known upstream action-spec defect described below.
The verifier made no backend/web changes and did not install or patch packages.

**Avoid `BaseEnvironment.action_spec()` with the pinned StateDynamics.** It raises
`IndexError: too many indices for array: array is 0-dimensional, but 1 were indexed`
at BaseEnvironment line 176 because `StateDynamics.action_spec()` returns scalar
min/max and BaseEnvironment attempts `minimum[jnp.newaxis, :]`. Reset/step do not
call this method. Construct the real `datatypes.Action(data=(N,5),valid=(N,1))`
directly, call `Action.validate()`, and if needed validate each data row against
`environment.dynamics.action_spec()`. The verifier records this upstream defect
in its JSON; it does not suppress unrelated exceptions or alter Waymax.

**Do not claim all loader attributes are causal** without sanitizing dimensions.
A generated Example with unchanged past/current length=4.5 but future length=9
produces observed length `(11*4.5+80*9)/91 = 8.456044...` at the current timestep.
The future position/light poisoning test passes; future dimension averaging is
a separate preprocessing issue that was reproduced in the installed loader.

No `send_input` or equivalent agent-targeted tool is exposed to this verifier.
This file and the final response provide the handoff for backend agent
`01a0fee2-59bc-74c0-a075-15bcab96714a` and main.

## Exact stepping APIs

- `datatypes.Trajectory.zeros((N, T)).replace(...)`: float32 x, y, z, vel_x,
  vel_y, yaw, length, width, height; bool valid; int32 timestamp_micros.
- `ObjectMetadata`: int32 ids and object_types; bool is_sdc, is_modeled,
  is_valid, objects_of_interest, is_controlled, all shaped `(N,)`.
- `TrafficLights`: x/y/z float32, state/lane_ids int32, valid bool, shaped `(L,T)`.
- `RoadgraphPoints`: x/y/z and dir_x/dir_y/dir_z float32, types/ids int32,
  valid bool, shaped `(R,)`.
- `SimulatorState(sim_trajectory=..., log_trajectory=...,
  log_traffic_light=..., object_metadata=..., timestep=jnp.array(0,jnp.int32),
  roadgraph_points=..., sdc_paths=None)`.
- `env.BaseEnvironment(dynamics.StateDynamics(), config.EnvironmentConfig(
  max_num_objects=N, init_steps=11, controlled_object=config.ObjectType.SDC,
  compute_reward=False))`; `state=environment.reset(state)` initializes steps
  0..10 and sets timestep 10. `init_steps=1` starts a purely synthetic scenario
  at zero instead. Ensure T is at least init_steps.
- `datatypes.Action(data=jnp.array(...,jnp.float32), valid=jnp.array(...,bool))`:
  **data `(N,5)`, valid `(N,1)`**. Fields in order: **absolute next x, y, yaw,
  vel_x, vel_y**. `StateDynamics` does not interpret x/y as deltas.
- `state=environment.step(state,action)` increments timestep by one. Pass all
  N object slots, control SDC via metadata/config; non-SDC actors use logged
  playback even if their supplied action data is garbage. Invalid actions for
  controlled actors fall back to constant speed, not logged motion.
- `state.current_sim_trajectory` is `(N,1)`; `state.is_done` prevents stepping
  beyond the log horizon. BaseEnvironment does not enforce this guard for you.
- `environment.metrics(state)` returns `{name: MetricResult(value=(N,),
  valid=(N,))}`. Include `overlap`, `offroad`, `kinematic_infeasibility`.
  StateDynamics directly sets poses; kinematic feasibility is evaluated rather
  than imposed. TIME_INTERVAL is 0.1 seconds.

## Dataset loader and important format constraints

`dataloader.simulator_state_generator(config.DatasetConfig(path=local_path,
repeat=1, batch_dims=(), shuffle_seed=None, num_shards=1, deterministic=True,
include_sdc_paths=False, max_num_objects=128, max_num_rg_points=30000,
drop_remainder=False))`. The default repeat=None is infinite: explicitly set 1
for bounded import. The result contains 91 timesteps: 10 past, 1 current,
80 future. reset(init_steps=11) begins control at current timestep 10.

This expects WOMD **TFExample TFRecords** with `state/past/...`, `state/current/...`,
`state/future/...`, `roadgraph_samples/...`, and traffic light features. A TFRecord
of Scenario protocol buffers is a different format despite having the same file
extension. It needs conversion and must produce an explicit format error here.
`max_num_objects` is applied by slicing after parsing 128-slot TFExamples; shrinking
it can accidentally remove the SDC. Keep 128 until selecting/remapping objects.

`womd_utils.get_features_description(...)` defines all mandatory fixed-size fields.
The verifier uses it to generate a complete fake Example, writes one TFRecord,
loads through the real public generator, and steps the resulting state.

## Planner observations, route and map without future leakage

**Do not pass `BaseEnvironment.observe(state)` to the planner**: it returns the
entire SimulatorState unchanged, including logged futures. Use
`datatypes.sdc_observation_from_state(state, obs_num_steps=history,
roadgraph_top_k=min(K,R), coordinate_frame=config.CoordinateFrame.GLOBAL)`.
Require history <= timestep+1. Output trajectory shape is `(1,N,history)` and
ends at the current simulated step; traffic lights also stop at current time.
Export only currently valid/history-visible actors to the planner.

Static roadgraph points contain geometry; group valid lane samples (types 1/2/3)
by feature id, preserving sample order and direction. Road edge types 15/16 are
useful for Waymax offroad; they are sampled boundaries, not drivable polygons.
Lane width is not in the TFExample point map. Any buffered lane polygon width
is an approximation and must be labeled accordingly. Route selection should
use initial ego pose/heading and static lane geometry; choose a deterministic
map continuation with heading/connectivity tolerances, or supply a user-selected
goal. Do not derive the route from future ego x/y and then score the planner
against its own privileged route. TFExample roadgraph samples do not supply the
full Scenario proto lane connectivity graph; endpoint stitching is heuristic.

For WOMD >=1.3.1, optional `include_sdc_paths=True` requires num_paths and
num_points_per_path matching the files. Paths enumerate roadgraph continuations
but `Paths.on_route` can encode the actual logged future route: exclude that
annotation from planner inputs. For the first release, keep include_sdc_paths=False.

One subtle source leak: `trajectory_from_womd_dict` computes length/width/height
using a masked mean across **all** 91 steps. Strict causal perception should replace
these dimensions in planner observations with estimates from visible raw TFExample
past/current fields, or disclose fixed full-track dimensions as an oracle attribute.
Likewise `is_modeled`, `objects_of_interest`, and `is_valid` can contain track-level
annotations: planner actor masks should come from current trajectory validity.
Use id/type/is_sdc only as needed; do not use future-selected track annotations.

The verification script poisons future log/sim positions and future light states
after current timestep and asserts the bounded observation remains unchanged.
This verifies the history extraction API, not all backend preprocessing.

## Dependencies and results

requirements-waymax.txt recommends Python 3.12 CPU macOS arm64 pins, with official
source pinned by commit and public PyPI for wheels. PyPI metadata confirms a
TensorFlow 2.18.1 cp312 macOS arm64 wheel, NumPy >=1.26,<2.1, ml-dtypes >=0.4,<1.
JAX 0.4.38 needs jaxlib 0.4.38; Flax 0.10.2 accepts JAX >=0.4.27; Chex 0.1.88
accepts JAX/JAXlib >=0.4.27. Pin Optax/Orbax to avoid a newer transitive package
forcing JAX upgrades. The public-PyPI dry-run resolver succeeded on the actual
Python 3.12 arm64 environment (exit 0). All specified pins resolve together,
with arm64/universal2 wheels for JAXlib, TensorFlow, and dm-tree. Resolver report:
`/tmp/drivelab-waymax-resolver.json`. Runtime compatibility of the core pins was
subsequently verified in the parent's installed environment; this verifier has
not installed anything.

Actual successful command (exit 0):

```sh
.venv/bin/python scripts/verify_waymax.py \
  --report /tmp/drivelab-waymax-result.json \
  --keep-fixture /tmp/drivelab-generated-fake-womd.tfrecord
```

Actual environment: Python 3.12.13, arm64, JAX CPU `TFRT_CPU_0`, Waymax 0.1.0
at commit a64dfec9be8576b60d9cecc94f406d9812d4a7d0, JAX/JAXlib 0.4.38,
TensorFlow 2.18.1, NumPy 2.0.2, Chex 0.1.88, Flax 0.10.2.

Verified results:

- Reset populates warmup and sets timestep 10; future simulation validity is false.
- At t=11 the direct ego action produces x=10.5; non-ego x values are 33.799999
  and 62.200001, matching logged playback despite bogus supplied non-ego actions.
- JIT rollout reaches timestep 90, remaining_timesteps=0, ego x=50.
- Clear ego overlap/offroad metrics are zero. Deliberate overlap gives overlap=1;
  displaced ego gives offroad=1; deliberate teleport also produces kinematic
  infeasibility=1. Metric validity masks were checked for overlap.
- History observation shape `(1,3,3)`; future log/sim position and traffic-light
  poisoning does not change any observation tree leaf or static map route.
- Generated fake TFRecord: 70 mandatory features, official generator output
  `(128,91)`, 192 roadgraph points, one SDC, unused object slots invalid,
  include_sdc_paths=False, repeat=1 terminates. Decoded state steps correctly.
- Full-track vehicle dimension averaging was reproduced and documented above.

The preserved fake TFRecord deliberately has `max_num_rg_points=192`; configure
the loader accordingly. A normal WOMD file uses the default 30000. The fake
fixture is useful for verification, but must never be labeled real Waymo data.
The generator now adds a `drivelab/source=synthetic-fixture` provenance field
alongside the 70 mandatory fields, so the app labels it `synthetic-tfexample`
and excludes it from the real dataset count when imported.
No real dataset was available or tested. JSON evidence remains at
`/tmp/drivelab-waymax-result.json`; rerunning the command regenerates it.

## Sources

- https://github.com/waymo-research/waymax/blob/a64dfec9be8576b60d9cecc94f406d9812d4a7d0/waymax/dynamics/state_dynamics.py
- https://github.com/waymo-research/waymax/blob/a64dfec9be8576b60d9cecc94f406d9812d4a7d0/waymax/env/base_environment.py
- https://github.com/waymo-research/waymax/blob/a64dfec9be8576b60d9cecc94f406d9812d4a7d0/waymax/datatypes/observation.py
- https://github.com/waymo-research/waymax/blob/a64dfec9be8576b60d9cecc94f406d9812d4a7d0/waymax/dataloader/womd_factories.py
- https://github.com/waymo-research/waymax/blob/a64dfec9be8576b60d9cecc94f406d9812d4a7d0/waymax/dataloader/womd_utils.py
- https://pypi.org/pypi/tensorflow/2.18.1/json
