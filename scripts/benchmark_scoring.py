"""Reproducible real kernel timings, including the checked Python/Rust boundary."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import statistics
import time

import numpy as np

from drivelab.geometry import corners
from drivelab.models import PlannerConfig
from drivelab.native_scoring import library_path, resolve_backend, score_actors
from drivelab.scenarios import synthetic_scenarios
from drivelab.simulation import simulate


def median_ms(function, repeats):
    function()  # Exclude cold library load and caches from steady-state timing.
    samples = []
    for _ in range(repeats):
        start = time.perf_counter()
        function()
        samples.append((time.perf_counter() - start) * 1000)
    return statistics.median(samples)


def benchmark(repeats=9):
    resolve_backend('rust')
    rng = np.random.default_rng(42)
    kernels = []
    for steps in (30, 50):
        for actor_count in (5, 32, 128):
            n = 42
            x = np.linspace(0, 25, steps)[None, :] + np.zeros((n, steps))
            y = np.linspace(-5, 5, n)[:, None] + np.zeros((n, steps))
            ego, inflated = corners(x, y, 0., 4.5, 1.9), corners(x, y, 0., 6.5, 3.9)
            positions = rng.uniform(-20, 50, (actor_count, steps, 2))
            actors = corners(positions[..., 0], positions[..., 1], rng.uniform(-np.pi, np.pi, (actor_count, steps)), 4.5, 1.9)
            a, b = score_actors(ego, inflated, actors, 'numpy'), score_actors(ego, inflated, actors, 'rust')
            np.testing.assert_array_equal(a[0], b[0])
            np.testing.assert_allclose(a[1], b[1], atol=1e-10)
            timings = {backend: median_ms(lambda backend=backend: score_actors(ego, inflated, actors, backend), repeats)
                       for backend in ('numpy', 'rust')}
            kernels.append(dict(candidates=n, steps=steps, actors=actor_count, median_ms=timings,
                                numpy_over_rust=timings['numpy'] / timings['rust'], parity=True))
    rollouts = []
    for scene in ('parked-car', 'turning-traffic', 'staggered-obstacles'):
        scenario = synthetic_scenarios()[scene]
        reports = {backend: simulate(scenario, config=PlannerConfig(scoring=backend), engine='numpy') for backend in ('numpy', 'rust')}
        assert [f['selected_candidate'] for f in reports['numpy']['frames']] == [f['selected_candidate'] for f in reports['rust']['frames']]
        np.testing.assert_allclose(list(reports['numpy']['metrics'].values()), list(reports['rust']['metrics'].values()), atol=1e-8)
        timings = {backend: median_ms(lambda backend=backend: simulate(scenario, config=PlannerConfig(scoring=backend), engine='numpy'), min(repeats, 5))
                   for backend in ('numpy', 'rust')}
        rollouts.append(dict(scenario_id=scene, frames=len(reports['rust']['frames']), median_ms=timings,
                             numpy_over_rust=timings['numpy'] / timings['rust'], parity=True))
    with library_path().open('rb') as stream:
        native_sha256 = hashlib.file_digest(stream, 'sha256').hexdigest()
    return dict(source='synthetic-scoring-inputs-and-bundled-scenes', python=platform.python_version(),
                numpy=np.__version__, platform=platform.platform(), machine=platform.machine(),
                native_library_sha256=native_sha256,
                repeats=repeats, kernels=kernels, rollouts=rollouts,
                scope='Steady-state local timings include validation, buffer copies and ctypes calls. Kernel ratios do not imply equal end-to-end speedups. Not a Waymo benchmark.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repeats', type=int, default=9)
    parser.add_argument('--report', type=Path, default=Path('data/scoring-benchmark.json'))
    args = parser.parse_args()
    if not 3 <= args.repeats <= 100:
        parser.error('--repeats must be between 3 and 100')
    result = benchmark(args.repeats)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
