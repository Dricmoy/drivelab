import math
import numpy as np
import pytest

from drivelab.geometry import Route, RoadMap, corners, sat_overlap, on_road, box_clearance, corridor, corridor_cells, inside_polygon


def test_oriented_sat_rejects_aabb_false_positive_and_handles_contact():
    a = corners(0, 0, math.pi / 4, 6, .5)
    b = corners(-.7, .7, math.pi / 4, 6, .5)
    assert not sat_overlap(a, b)
    assert box_clearance(a, b) > .4
    c = corners(4, 0, 0, 4, 2)
    assert sat_overlap(corners(0, 0, 0, 4, 2), c)
    assert box_clearance(corners(0, 0, 0, 4, 2), c) == 0


def test_vectorized_collisions():
    boxes = corners(np.array([0, 10, 20]), 0, 0, 4, 2)
    np.testing.assert_array_equal(sat_overlap(boxes, corners(10, 0, 0, 4, 2)), [False, True, False])


def test_road_checks_footprint_not_just_center():
    road = [[[-10, -2], [10, -2], [10, 2], [-10, 2]]]
    assert on_road(corners(0, 0, 0, 4, 2), road)
    assert not on_road(corners(0, 1.5, 0, 4, 2), road)
    gap = [[[-10, -4], [10, -4], [10, -1], [-10, -1]],
           [[-10, 1], [10, 1], [10, 4], [-10, 4]]]
    assert not on_road(corners(0, 0, 0, 4, 4), gap)


def test_route_projection_uses_map_arclength():
    route = Route([[0, 0], [10, 0], [10, 10]])
    assert route.project(10, 5) == pytest.approx((15, 0))
    xy, yaw = route.sample(np.array([5, 15]), 1)
    np.testing.assert_allclose(xy, [[5, 1], [9, 5]])
    np.testing.assert_allclose(yaw, [0, math.pi / 2])


def test_indexed_corridor_sections_preserve_full_curved_road():
    angle = np.linspace(0, 1.5, 121)
    points = np.stack((70 * np.sin(angle), 70 * (1 - np.cos(angle))), -1)
    full, cells = [corridor(points, 1.9)], corridor_cells(points, 1.9)
    boxes = corners(np.linspace(-5, 80, 35)[:, None], np.linspace(-5, 80, 35)[None, :], .4, 4.6, 1.85)
    # Compare indexed partitioned geometry with direct polygon ray-casting.
    samples = np.concatenate([boxes, (boxes + np.roll(boxes, -1, axis=-2)) / 2,
                              boxes.mean(axis=-2, keepdims=True)], -2)
    reference = inside_polygon(samples, full[0]).all(-1)
    np.testing.assert_array_equal(on_road(boxes, RoadMap(cells)), reference)


def test_broadphase_skips_distant_lane_polygons(monkeypatch):
    import drivelab.geometry as geometry
    polygons = [corridor([[0, 0], [100, 0]], 2)]
    polygons += [corridor([[0, y], [100, y]], 2) for y in range(100, 10000, 20)]
    road = RoadMap(polygons)
    box = corners(10, 0, 0, 4, 1.8)
    assert len(road.nearby(box)) == 1
    calls = []
    original = geometry.inside_polygon
    def observed(points, polygon):
        calls.append(len(points))
        return original(points, polygon)
    monkeypatch.setattr(geometry, "inside_polygon", observed)
    assert on_road(box, road)
    assert len(calls) == 1
