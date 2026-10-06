"""Execute the actual shared library, not a mocked native implementation."""
import ctypes
import os

from fastapi.testclient import TestClient
import numpy as np
import pytest

from drivelab import native_scoring as native
from drivelab.api import create_app
from drivelab.geometry import corners
from drivelab.models import PlannerConfig
from drivelab.scenarios import synthetic_scenarios
from drivelab.simulation import simulate


@pytest.fixture
def rust():
    if not native.available():
        if os.environ.get('DRIVELAB_REQUIRE_NATIVE') == '1':
            pytest.fail('Required Rust library is unavailable; run make native')
        pytest.skip('Optional Rust library is not built; run make native')
    return native


def boxes(seed, candidates=42, steps=30, actors=12, origin=0.):
    rng = np.random.default_rng(seed)
    pose = rng.normal(0, 10, (candidates, steps, 3))
    others = rng.normal(0, 10, (actors, steps, 3))
    ego = corners(pose[..., 0] + origin, pose[..., 1] + origin, pose[..., 2], 4.5, 1.9)
    padded = corners(pose[..., 0] + origin, pose[..., 1] + origin, pose[..., 2], 6.5, 3.9)
    traffic = corners(others[..., 0] + origin, others[..., 1] + origin, others[..., 2],
                      rng.uniform(.2, 12, (actors, 1)), rng.uniform(.2, 3, (actors, 1)))
    return ego, padded, traffic


@pytest.mark.parametrize('seed,origin,actors', [(0, 0, 0), (1, 0, 1), (2, 0, 32), (3, 1e6, 12)])
def test_rotated_batched_scoring_matches_numpy(rust, seed, origin, actors):
    inputs = boxes(seed, actors=actors, origin=origin)
    expected = native.score_actors(*inputs, backend='numpy')
    actual = native.score_actors(*inputs, backend='rust')
    np.testing.assert_array_equal(actual[0], expected[0])
    np.testing.assert_allclose(actual[1], expected[1], rtol=1e-10, atol=1e-8)


@pytest.mark.parametrize('gap', [-.1, 0., 1e-10, 1e-6, 3., 200.])
def test_touching_tolerance_padding_and_clearance_cap(rust, gap):
    ego = corners(np.zeros((1, 1)), np.zeros((1, 1)), 0., 2., 2.)
    other = corners(np.array([[2. + gap]]), np.zeros((1, 1)), 0., 2., 2.)
    for padding in (0., 1.):
        padded = corners(np.zeros((1, 1)), np.zeros((1, 1)), 0., 2. + padding, 2. + padding)
        a = native.score_actors(ego, padded, other, 'numpy')
        b = native.score_actors(ego, padded, other, 'rust')
        np.testing.assert_array_equal(a[0], b[0])
        np.testing.assert_allclose(a[1], b[1], atol=1e-12)


def test_noncontiguous_buffers_and_degenerate_edges(rust):
    arrays = boxes(5, steps=60)
    inputs = tuple(a[:, ::2] for a in arrays)
    assert not inputs[0].flags.c_contiguous
    a, b = native.score_actors(*inputs, 'numpy'), native.score_actors(*inputs, 'rust')
    np.testing.assert_array_equal(a[0], b[0])
    np.testing.assert_allclose(a[1], b[1], atol=1e-10)
    zero = np.zeros((1, 1, 4, 2))
    a, b = native.score_actors(zero, zero, zero, 'numpy'), native.score_actors(zero, zero, zero, 'rust')
    np.testing.assert_array_equal(a[0], b[0])
    np.testing.assert_array_equal(a[1], b[1])


def test_invalid_inputs_never_enter_native_boundary(rust):
    ego, inflated, actors = boxes(6)
    with pytest.raises(ValueError, match='backend'):
        native.score_actors(ego, inflated, actors, 'magic')
    with pytest.raises(ValueError, match='shape'):
        native.score_actors(ego[0], inflated, actors, 'rust')
    with pytest.raises(ValueError, match='shape'):
        native.score_actors(ego, inflated, actors[:, :-1], 'rust')
    ego[0, 0, 0, 0] = np.nan
    with pytest.raises(ValueError, match='finite'):
        native.score_actors(ego, inflated, actors, 'rust')


def test_unavailable_native_falls_back_only_when_requested(monkeypatch, tmp_path):
    monkeypatch.setenv('DRIVELAB_NATIVE_LIB', '/missing/drivelab-scoring-library')
    assert not native.available()
    assert native.resolve_backend('auto') == 'numpy'
    inputs = boxes(7)
    a, b = native.score_actors(*inputs, 'auto'), native.score_actors(*inputs, 'numpy')
    np.testing.assert_array_equal(a[0], b[0])
    np.testing.assert_array_equal(a[1], b[1])
    with pytest.raises(ValueError, match='make native'):
        native.resolve_backend('rust')
    scenario = synthetic_scenarios()['clear-road']
    scenario.public['duration'] = .2
    report = simulate(scenario, config=PlannerConfig(), engine='numpy')
    assert report['scoring_backend'] == 'numpy'
    client = TestClient(create_app(tmp_path / 'fallback.sqlite3', engine='numpy'))
    assert not client.get('/api/health').json()['native_available']
    assert client.post('/api/runs', json={'scenario_id': 'clear-road', 'config': {'scoring': 'rust'}}).status_code == 503
    assert client.post('/api/runs', json={'scenario_id': 'clear-road', 'config': {'scoring': 'magic'}}).status_code == 422


def test_raw_abi_rejects_nonfinite_without_touching_output(rust):
    library = native._load(str(native.library_path().resolve()))
    ego = np.zeros(8, dtype=np.float64)
    ego[0] = np.inf
    collision, distance = np.array([9], dtype=np.uint8), np.array([-1.], dtype=np.float64)
    pointer = ctypes.POINTER(ctypes.c_double)
    status = library.drivelab_score_actors(1, 1, 0, ego.ctypes.data_as(pointer), ego.ctypes.data_as(pointer),
        None, collision.ctypes.data_as(ctypes.POINTER(ctypes.c_uint8)), distance.ctypes.data_as(pointer))
    assert status == 2
    assert collision[0] == 9 and distance[0] == -1.


@pytest.fixture(scope='module')
def checkpoint(tmp_path_factory):
    pytest.importorskip('torch')
    from drivelab.forecast import train_model
    path = tmp_path_factory.mktemp('native-forecast') / 'forecast.pt'
    train_model(path, seed=42, epochs=20)
    return path


@pytest.mark.parametrize('scene', list(synthetic_scenarios()))
@pytest.mark.parametrize('planner', ['baseline', 'lattice'])
@pytest.mark.parametrize('prediction', ['constant_velocity', 'learned'])
def test_full_rollout_choices_scores_and_metrics_match(rust, checkpoint, scene, planner, prediction):
    scenario = synthetic_scenarios()[scene]
    config = PlannerConfig(prediction=prediction)
    a = simulate(scenario, planner, config.model_copy(update={'scoring': 'numpy'}), engine='numpy', forecast_checkpoint=checkpoint)
    b = simulate(scenario, planner, config.model_copy(update={'scoring': 'rust'}), engine='numpy', forecast_checkpoint=checkpoint)
    assert a['scoring_backend'] == 'numpy' and b['scoring_backend'] == 'rust'
    assert a['engine'] == b['engine'] == 'numpy-kinematic'
    assert len(a['frames']) == len(b['frames'])
    assert a['metrics'] == pytest.approx(b['metrics'], abs=1e-8)
    assert a['failures'] == b['failures']
    for x, y in zip(a['frames'], b['frames']):
        assert x['selected_candidate'] == y['selected_candidate']
        assert x['ego'] == y['ego']
        assert [c['feasible'] for c in x['candidates']] == [c['feasible'] for c in y['candidates']]
        for key in ('cost', 'collision_cost', 'offroad_cost', 'comfort_cost', 'progress_cost'):
            np.testing.assert_allclose([c[key] for c in x['candidates']], [c[key] for c in y['candidates']], rtol=1e-11, atol=1e-8)
