from copy import deepcopy
import numpy as np
import pytest

from drivelab.scenarios import synthetic_scenarios
from drivelab.waymax_adapter import available, WaymaxStepper, DatasetError, import_dataset


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax] to exercise genuine Waymax dynamics")
def test_real_waymax_dynamics_step_on_synthetic_state():
    scenario = synthetic_scenarios()["slow-lead"]
    stepper = WaymaxStepper(scenario)
    target = dict(scenario.public["ego"], x=.8)
    ego, actors = stepper.step(target)
    assert int(stepper.state.timestep) == 1
    assert ego["x"] == pytest.approx(.8)
    assert ego["speed"] == pytest.approx(8.)
    assert actors[0]["x"] == pytest.approx(24.3)
    assert float(stepper.state.sim_trajectory.x[0, 1]) == pytest.approx(.8)
    assert float(stepper.state.log_trajectory.x[0, 1]) == 0
    assert not bool(stepper.state.sim_trajectory.valid[0, 2])


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
def test_real_waymax_full_rollout_has_computed_results():
    from drivelab.simulation import simulate
    scenario = synthetic_scenarios()["parked-car"]
    report = simulate(scenario, engine="waymax")
    assert report["engine"] == "waymax-state-dynamics"
    assert len(report["frames"]) == 101
    assert report["metrics"]["distance"] > 50
    assert not report["metrics"]["collision"]
    assert report["source"] == "synthetic"


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
def test_malformed_tfrecord_reports_decode_failure(tmp_path):
    # Deliberately bad local bytes exercise the real loader, never a fake import.
    path = tmp_path / "malformed.tfrecord"
    path.write_bytes(b"this is not a TFRecord")
    with pytest.raises(DatasetError, match="decode failed"):
        import_dataset(str(path), 1)


def test_import_missing_dependencies_is_actionable(tmp_path, monkeypatch):
    path = tmp_path / "some.tfrecord"
    path.write_bytes(b"record")
    monkeypatch.setattr("drivelab.waymax_adapter.available", lambda: False)
    with pytest.raises(DatasetError, match="dependencies are missing"):
        import_dataset(str(path), 1)


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
@pytest.mark.parametrize("id", ["curved-road", "oncoming"])
@pytest.mark.parametrize("parameters", [(8., 1., 3.), (10., .7, 3.)],
                         ids=["ui-defaults", "previous-defaults"])
def test_waymax_demo_safety_and_progress_at_both_configs(id, parameters):
    from drivelab.models import PlannerConfig
    from drivelab.simulation import simulate
    config = PlannerConfig(target_speed=parameters[0], safety_margin=parameters[1], horizon=parameters[2])
    scenario = synthetic_scenarios()[id]
    baseline = simulate(scenario, "baseline", config, engine="waymax")
    lattice = simulate(scenario, "lattice", config, engine="waymax")
    assert baseline["metrics"]["collision"]
    assert not lattice["metrics"]["collision"]
    assert not lattice["metrics"]["offroad"]
    assert lattice["metrics"]["progress"] > .6
    assert lattice["metrics"]["min_clearance"] > 0
    assert lattice["config"] == config.model_dump()
