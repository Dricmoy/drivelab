"""Checked NumPy/ctypes boundary to the optional Rust collision scorer."""
import ctypes
from functools import lru_cache
import os
from pathlib import Path
import sys

import numpy as np

from .geometry import sat_overlap, box_clearance


def library_path():
    filename = 'libdrivelab_scoring.dylib' if sys.platform == 'darwin' else 'drivelab_scoring.dll' if sys.platform == 'win32' else 'libdrivelab_scoring.so'
    return Path(os.environ.get('DRIVELAB_NATIVE_LIB', str(Path(__file__).resolve().parents[2] / 'native/target/release' / filename)))


@lru_cache(maxsize=4)
def _load(path):
    library = ctypes.CDLL(path)
    library.drivelab_scoring_version.restype = ctypes.c_uint32
    if library.drivelab_scoring_version() != 1:
        raise ValueError('Unsupported Rust scoring ABI')
    double_ptr = ctypes.POINTER(ctypes.c_double)
    library.drivelab_score_actors.argtypes = [ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t,
        double_ptr, double_ptr, double_ptr, ctypes.POINTER(ctypes.c_uint8), double_ptr]
    library.drivelab_score_actors.restype = ctypes.c_int
    return library


def available():
    try:
        _load(str(library_path().resolve()))
        return True
    except (OSError, ValueError, AttributeError):
        return False


def resolve_backend(backend='auto'):
    if backend not in ('auto', 'numpy', 'rust'):
        raise ValueError('Unknown scoring backend')
    if backend == 'numpy':
        return 'numpy'
    if available():
        return 'rust'
    if backend == 'rust':
        raise ValueError('Rust scoring is unavailable. Build it with make native.')
    return 'numpy'


def score_actors_numpy(ego, inflated, actors):
    collision = np.zeros(ego.shape[:2], dtype=bool)
    distance = np.full(ego.shape[:2], 100.)
    for other in actors:
        collision |= sat_overlap(inflated, other)
        distance = np.minimum(distance, box_clearance(ego, other))
    return collision, distance


def score_actors(ego, inflated, actors, backend='auto'):
    backend = resolve_backend(backend)
    ego, inflated, actors = [np.asarray(a, dtype=np.float64) for a in (ego, inflated, actors)]
    if ego.ndim != 4 or ego.shape[-2:] != (4, 2) or not all(ego.shape[:2]):
        raise ValueError('Ego boxes must have shape (candidates, steps, 4, 2)')
    if inflated.shape != ego.shape or actors.ndim != 4 or actors.shape[1:] != ego.shape[1:]:
        raise ValueError('Actor/inflated box shapes do not match the rollout horizon')
    if not all(np.isfinite(a).all() for a in (ego, inflated, actors)):
        raise ValueError('Scoring inputs must be finite')
    if ego.shape[0] * ego.shape[1] > 10_000_000 or actors.size > 100_000_000:
        raise ValueError('Scoring batch exceeds supported bounds')
    if backend == 'numpy':
        return score_actors_numpy(ego, inflated, actors)
    try:
        library = _load(str(library_path().resolve()))
    except (OSError, ValueError, AttributeError) as exc:
        raise ValueError('Rust scoring is unavailable. Build it with make native.') from exc
    ego, inflated, actors = [np.ascontiguousarray(a) for a in (ego, inflated, actors)]
    collision = np.empty(ego.shape[:2], dtype=np.uint8)
    distances = np.empty(ego.shape[:2], dtype=np.float64)
    pointer = ctypes.POINTER(ctypes.c_double)
    code = library.drivelab_score_actors(ego.shape[0], ego.shape[1], actors.shape[0],
        ego.ctypes.data_as(pointer), inflated.ctypes.data_as(pointer), actors.ctypes.data_as(pointer),
        collision.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8)), distances.ctypes.data_as(pointer))
    if code:
        raise ValueError(f'Rust scoring rejected the inputs (status {code})')
    return collision.astype(bool), distances
