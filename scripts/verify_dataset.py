"""Verify a local TFExample with both planners; never infer dataset provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from drivelab.models import PlannerConfig
from drivelab.simulation import simulate
from drivelab.waymax_adapter import DatasetError, import_dataset


def verify(path, limit=1, kind="unknown", prediction="constant_velocity", scoring="auto"):
    path = Path(path).resolve()
    if kind not in ("unknown", "waymo", "waymax-fixture"):
        raise ValueError("Unknown input provenance")
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 20:
        raise ValueError("limit must be an integer from 1 to 20")
    scenarios = import_dataset(str(path), limit)
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    config = PlannerConfig(prediction=prediction, scoring=scoring)
    results = []
    for scene in scenarios:
        generated = scene.public["source"] == "synthetic-tfexample"
        source = "synthetic-tfexample" if generated else {
            "unknown": "external-tfexample",
            "waymo": "waymo-open-motion",
            "waymax-fixture": "waymax-testdata",
        }[kind]
        scene.public["source"] = source
        pair = dict(scenario_id=scene.public["id"], source=source,
                    actors=len(scene.public["actors"]), lanes=len(scene.public["lanes"]),
                    road_cells=len(scene.road_cells), planners={})
        initial = None
        for planner in ("baseline", "lattice"):
            started = perf_counter()
            report = simulate(scene, planner, config, engine="waymax")
            first = (report["frames"][0]["ego"], report["frames"][0]["actors"])
            if initial is not None and first != initial:
                raise AssertionError("Paired planners did not start from the same observations")
            initial = first
            expected = min(round(scene.public["duration"] / scene.public["dt"]), len(scene.actor_tracks) - 1) + 1
            if len(report["frames"]) != expected or report["engine"] != "waymax-state-dynamics":
                raise AssertionError("Waymax did not execute the complete finite scenario")
            pair["planners"][planner] = dict(engine=report["engine"], scoring_backend=report["scoring_backend"], frames=len(report["frames"]),
                                            seconds=round(perf_counter() - started, 4), metrics=report["metrics"])
        results.append(pair)
    return dict(status="passed", input_path=str(path), input_bytes=path.stat().st_size,
                sha256=digest, declared_input_kind=kind, config=config.model_dump(), scenarios=results,
                scope="Decoder and complete paired Waymax execution; not a safety or dataset benchmark. "
                      "Input provenance is caller-declared. Generated fixture markers take precedence.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--kind", choices=["unknown", "waymo", "waymax-fixture"], default="unknown")
    parser.add_argument("--prediction", choices=["constant_velocity", "learned"], default="constant_velocity")
    parser.add_argument("--scoring", choices=["auto", "numpy", "rust"], default="auto")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    try:
        result = verify(args.path, args.limit, args.kind, args.prediction, args.scoring)
        output = json.dumps(result, indent=2, allow_nan=False) + "\n"
        if args.report:
            if args.report.resolve() == args.path.resolve():
                raise ValueError("Report path must differ from the input dataset")
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(output, encoding="utf-8")
        print(output, end="")
        return 0
    except (DatasetError, ValueError, OSError) as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
