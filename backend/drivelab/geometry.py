"""Vectorized oriented rectangles, polygon union constraints, and route coordinates."""
import numpy as np


def corners(x, y, yaw, length, width):
    x, y, yaw, length, width = np.broadcast_arrays(x, y, yaw, length, width)
    local_x = length[..., None] * np.array([1, 1, -1, -1]) / 2
    local_y = width[..., None] * np.array([-1, 1, 1, -1]) / 2
    c, s = np.cos(yaw)[..., None], np.sin(yaw)[..., None]
    return np.stack((x[..., None] + c * local_x - s * local_y,
                     y[..., None] + s * local_x + c * local_y), axis=-1)


def sat_overlap(a, b):
    """All four separating axes; touching edges count as a collision."""
    a, b = np.broadcast_arrays(np.asarray(a), np.asarray(b))
    edges = np.concatenate((a[..., 1:3, :] - a[..., :2, :],
                            b[..., 1:3, :] - b[..., :2, :]), axis=-2)
    axes = np.stack((-edges[..., 1], edges[..., 0]), axis=-1)
    pa = np.einsum("...vi,...ai->...av", a, axes)
    pb = np.einsum("...vi,...ai->...av", b, axes)
    separated = (pa.max(-1) < pb.min(-1) - 1e-8) | (pb.max(-1) < pa.min(-1) - 1e-8)
    return ~np.any(separated, axis=-1)


def box_clearance(a, b):
    """Euclidean edge distance between oriented boxes; zero on overlap."""
    a, b = np.broadcast_arrays(np.asarray(a), np.asarray(b))
    distances = []
    for vertices, polygon in ((a, b), (b, a)):
        start = polygon[..., None, :, :]
        edge = (np.roll(polygon, -1, axis=-2) - polygon)[..., None, :, :]
        delta = vertices[..., :, None, :] - start
        u = np.clip(np.sum(delta * edge, -1) / np.maximum(np.sum(edge * edge, -1), 1e-12), 0, 1)
        distances.append(np.linalg.norm(delta - u[..., None] * edge, axis=-1).min(axis=(-1, -2)))
    return np.where(sat_overlap(a, b), 0.0, np.minimum(*distances))


def inside_polygon(points, polygon):
    points, poly = np.asarray(points), np.asarray(polygon)
    x, y = points[..., 0, None], points[..., 1, None]
    start, end = poly, np.roll(poly, -1, axis=0)
    edge, delta = end - start, points[..., None, :] - start
    cross = edge[:, 0] * delta[..., 1] - edge[:, 1] * delta[..., 0]
    projection = np.sum(delta * edge, axis=-1)
    boundary = (np.abs(cross) < 1e-7) & (projection >= -1e-7) & (projection <= np.sum(edge * edge, -1) + 1e-7)
    denominator = end[:, 1] - start[:, 1]
    denominator = np.where(np.abs(denominator) < 1e-12, 1e-12, denominator)
    crosses = ((start[:, 1] > y) != (end[:, 1] > y)) & (
        x < (end[:, 0] - start[:, 0]) * (y - start[:, 1]) / denominator + start[:, 0])
    return (np.count_nonzero(crosses, axis=-1) % 2 == 1) | boundary.any(-1)


class RoadMap:
    """Grid broadphase over road cells; geometry remains unchanged."""
    def __init__(self, polygons, cell_size=25.):
        self.polygons = [np.asarray(p, dtype=float) for p in polygons]
        self.cell_size = cell_size
        self.bounds = [(p.min(0), p.max(0)) for p in self.polygons]
        self.index = {}
        self.global_ids = set()
        for i, (low, high) in enumerate(self.bounds):
            start = np.floor((low - 1e-7) / cell_size).astype(int)
            end = np.floor((high + 1e-7) / cell_size).astype(int)
            if np.prod(end - start + 1) > 4096:
                self.global_ids.add(i)
                continue
            for x in range(start[0], end[0] + 1):
                for y in range(start[1], end[1] + 1):
                    self.index.setdefault((x, y), set()).add(i)

    def nearby(self, points):
        start = np.floor(points.min(0) / self.cell_size).astype(int)
        end = np.floor(points.max(0) / self.cell_size).astype(int)
        if np.prod(end - start + 1) > 4096:
            return range(len(self.polygons))
        found = set(self.global_ids)
        for x in range(start[0], end[0] + 1):
            for y in range(start[1], end[1] + 1):
                found.update(self.index.get((x, y), ()))
        return sorted(found)


def on_road(boxes, polygons):
    # Check corners and sampled edges, including the center: handles a lane union
    # and detects straddling gaps that a center-only check would miss.
    samples = np.concatenate([boxes, (boxes + np.roll(boxes, -1, axis=-2)) / 2,
                              boxes.mean(axis=-2, keepdims=True)], axis=-2)
    flat = samples.reshape(-1, 2)
    inside = np.zeros(len(flat), dtype=bool)
    road = polygons if isinstance(polygons, RoadMap) else RoadMap(polygons)
    for i in road.nearby(flat):
        low, high = road.bounds[i]
        mask = ~inside & np.all(flat >= low - 1e-7, -1) & np.all(flat <= high + 1e-7, -1)
        if mask.any():
            inside[mask] = inside_polygon(flat[mask], road.polygons[i])
        if inside.all():
            break
    return inside.reshape(samples.shape[:-1]).all(-1)


class Route:
    def __init__(self, points):
        self.points = np.asarray(points, dtype=float)
        if len(self.points) < 2:
            raise ValueError("Route needs at least two points")
        self.edges = np.diff(self.points, axis=0)
        self.lengths = np.linalg.norm(self.edges, axis=-1)
        if np.any(self.lengths < 1e-6):
            raise ValueError("Route contains repeated adjacent points")
        self.s = np.r_[0.0, np.cumsum(self.lengths)]
        self.length = float(self.s[-1])

    def project(self, x, y):
        point = np.array([x, y])
        u = np.clip(np.sum((point - self.points[:-1]) * self.edges, axis=-1) / self.lengths**2, 0, 1)
        nearest = self.points[:-1] + u[:, None] * self.edges
        i = int(np.argmin(np.sum((point - nearest)**2, axis=-1)))
        normal = np.array([-self.edges[i, 1], self.edges[i, 0]]) / self.lengths[i]
        return float(self.s[i] + u[i] * self.lengths[i]), float((point - nearest[i]) @ normal)

    def sample(self, s, offset=0):
        s = np.clip(s, 0, self.length)
        i = np.clip(np.searchsorted(self.s, s, side="right") - 1, 0, len(self.edges) - 1)
        tangent = self.edges[i] / self.lengths[i, None]
        normal = np.stack((-tangent[..., 1], tangent[..., 0]), axis=-1)
        position = self.points[i] + (np.asarray(s) - self.s[i])[..., None] * tangent + np.asarray(offset)[..., None] * normal
        return position, np.arctan2(tangent[..., 1], tangent[..., 0])


def corridor(points, half_width):
    p = np.asarray(points, dtype=float)
    direction = np.gradient(p, axis=0)
    direction /= np.maximum(np.linalg.norm(direction, axis=-1, keepdims=True), 1e-9)
    normal = np.stack((-direction[:, 1], direction[:, 0]), -1)
    return np.concatenate((p + half_width * normal, (p - half_width * normal)[::-1])).tolist()


def corridor_cells(points, half_width, chunk=8):
    """Partition a corridor using identical normals and shared cross sections."""
    polygon = np.asarray(corridor(points, half_width))
    n = len(points)
    left, right = polygon[:n], polygon[n:][::-1]
    return [np.concatenate((left[start:end], right[start:end][::-1])).tolist()
            for start in range(0, n - 1, chunk - 1)
            for end in [min(start + chunk, n)]]
