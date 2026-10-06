import json

from drivelab.store import Store


def sample(id):
    return dict(id=id, created_at="2026-10-02T00:00:00Z", scenario_id="demo", metrics={"collision": False},
                frames=[{"time": i * .1, "candidates": [[1., 2.]] * 100} for i in range(100)])


def test_compressed_full_report_roundtrip_and_lightweight_list(tmp_path):
    store = Store(tmp_path / "runs.sqlite3")
    report = sample("compressed")
    store.save_run(report)
    with store.connect() as db:
        encoded = db.execute("SELECT report FROM runs").fetchone()[0]
    assert isinstance(encoded, bytes) and encoded.startswith(b"DLZ1")
    assert len(encoded) < len(json.dumps(report)) / 10
    assert store.get_run(report["id"]) == report
    assert store.list_runs() == [{k: v for k, v in report.items() if k != "frames"}]
    assert Store(store.path).get_run(report["id"]) == report


def test_legacy_uncompressed_report_is_still_readable(tmp_path):
    store = Store(tmp_path / "legacy.sqlite3")
    report = sample("legacy")
    with store.connect() as db:
        db.execute("INSERT INTO runs VALUES (?, ?, ?)", (report["id"], report["created_at"], json.dumps(report)))
    assert store.get_run("legacy") == report
    assert store.list_runs()[0]["id"] == "legacy"
    assert "frames" not in store.list_runs()[0]
