import importlib.util
from pathlib import Path

import pytest

from drivelab.waymax_adapter import available


spec = importlib.util.spec_from_file_location("verify_dataset", Path(__file__).resolve().parents[2] / "scripts/verify_dataset.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def test_missing_input_is_actionable_and_does_not_write_report(tmp_path, capsys):
    output = tmp_path / "report.json"
    assert verifier.main([str(tmp_path / "missing"), "--report", str(output)]) == 2
    assert "Verification failed" in capsys.readouterr().err
    assert not output.exists()


@pytest.mark.parametrize("limit", [0, 21, True, 1.5])
def test_input_limit_is_bounded(limit):
    with pytest.raises(ValueError, match="limit"):
        verifier.verify("unused", limit=limit)


@pytest.mark.waymax
@pytest.mark.skipif(not available(), reason="Install backend[waymax]")
def test_generated_marker_wins_over_declared_dataset_and_runs_complete_pairs(tmp_path):
    from test_decoder import write_generated_tfexample
    source = tmp_path / "generated.tfrecord"
    write_generated_tfexample(source)
    original = source.read_bytes()
    report = verifier.verify(source, limit=1, kind="waymo")
    assert report["status"] == "passed"
    assert report["input_bytes"] == len(original)
    assert len(report["sha256"]) == 64
    assert len(report["scenarios"]) == 1
    pair = report["scenarios"][0]
    assert pair["source"] == "synthetic-tfexample"
    assert pair["actors"] == 1
    for planner in ("baseline", "lattice"):
        assert pair["planners"][planner]["engine"] == "waymax-state-dynamics"
        assert pair["planners"][planner]["frames"] == 81
    assert source.read_bytes() == original
