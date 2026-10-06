//! Batched rectangle collision and clearance scoring. No external dependencies.
//! The C boundary borrows caller-owned contiguous buffers only for this call.
use std::slice;

fn overlap(a: &[f64], b: &[f64]) -> bool {
    for rectangle in [a, b] {
        for i in 0..2 {
            let axis_x = -(rectangle[2 * (i + 1) + 1] - rectangle[2 * i + 1]);
            let axis_y = rectangle[2 * (i + 1)] - rectangle[2 * i];
            let mut amin = f64::INFINITY;
            let mut amax = f64::NEG_INFINITY;
            let mut bmin = f64::INFINITY;
            let mut bmax = f64::NEG_INFINITY;
            for j in 0..4 {
                let pa = a[2 * j] * axis_x + a[2 * j + 1] * axis_y;
                let pb = b[2 * j] * axis_x + b[2 * j + 1] * axis_y;
                amin = amin.min(pa);
                amax = amax.max(pa);
                bmin = bmin.min(pb);
                bmax = bmax.max(pb);
            }
            if amax < bmin - 1e-8 || bmax < amin - 1e-8 {
                return false;
            }
        }
    }
    true
}

fn clearance(a: &[f64], b: &[f64]) -> f64 {
    if overlap(a, b) {
        return 0.;
    }
    let mut distance = f64::INFINITY;
    for (vertices, polygon) in [(a, b), (b, a)] {
        for vertex in 0..4 {
            for start in 0..4 {
                let end = (start + 1) % 4;
                let ex = polygon[2 * end] - polygon[2 * start];
                let ey = polygon[2 * end + 1] - polygon[2 * start + 1];
                let dx = vertices[2 * vertex] - polygon[2 * start];
                let dy = vertices[2 * vertex + 1] - polygon[2 * start + 1];
                let u = ((dx * ex + dy * ey) / (ex * ex + ey * ey).max(1e-12)).clamp(0., 1.);
                let px = dx - u * ex;
                let py = dy - u * ey;
                distance = distance.min((px * px + py * py).sqrt());
            }
        }
    }
    distance
}

/// ABI version allows the Python wrapper to reject incompatible libraries.
#[no_mangle]
pub extern "C" fn drivelab_scoring_version() -> u32 {
    1
}

/// Score n candidate trajectories, steps future poses and m predicted actors.
/// Ego buffers have shape (n, steps, 4, 2); actors have shape (m, steps, 4, 2).
/// Outputs have shape (n, steps). Touching edges collide; clearance caps at 100m.
/// Returns 0 on success, 1 for invalid dimensions/pointers and 2 for nonfinite data.
///
/// # Safety
/// Caller must provide valid, aligned buffers with the lengths above. Output
/// buffers must not alias each other or the immutable inputs. Borrowed pointers
/// are not retained. The checked Python wrapper owns every buffer for the call.
#[no_mangle]
pub unsafe extern "C" fn drivelab_score_actors(
    n: usize,
    steps: usize,
    m: usize,
    ego: *const f64,
    inflated: *const f64,
    actors: *const f64,
    collision: *mut u8,
    distances: *mut f64,
) -> i32 {
    let Some(count) = n.checked_mul(steps) else {
        return 1;
    };
    let Some(ego_len) = count.checked_mul(8) else {
        return 1;
    };
    let Some(actor_len) = m.checked_mul(steps).and_then(|v| v.checked_mul(8)) else {
        return 1;
    };
    if n == 0
        || steps == 0
        || count > 10_000_000
        || actor_len > 100_000_000
        || ego.is_null()
        || inflated.is_null()
        || collision.is_null()
        || distances.is_null()
        || (m > 0 && actors.is_null())
    {
        return 1;
    }
    let ego = slice::from_raw_parts(ego, ego_len);
    let inflated = slice::from_raw_parts(inflated, ego_len);
    let actors = if m == 0 {
        &[]
    } else {
        slice::from_raw_parts(actors, actor_len)
    };
    if !ego
        .iter()
        .chain(inflated)
        .chain(actors)
        .all(|v| v.is_finite())
    {
        return 2;
    }
    let collision = slice::from_raw_parts_mut(collision, count);
    let distances = slice::from_raw_parts_mut(distances, count);
    for pose in 0..count {
        let actual = &ego[pose * 8..pose * 8 + 8];
        let padded = &inflated[pose * 8..pose * 8 + 8];
        collision[pose] = 0;
        distances[pose] = 100.;
        let time = pose % steps;
        for actor in 0..m {
            let offset = (actor * steps + time) * 8;
            let other = &actors[offset..offset + 8];
            collision[pose] |= u8::from(overlap(padded, other));
            distances[pose] = distances[pose].min(clearance(actual, other));
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rectangle(x: f64) -> [f64; 8] {
        [x + 1., -1., x + 1., 1., x - 1., 1., x - 1., -1.]
    }
    #[test]
    fn touching_edges_collide() {
        assert!(overlap(&rectangle(0.), &rectangle(2.)));
    }
    #[test]
    fn separated_edge_distance_is_exact() {
        assert_eq!(clearance(&rectangle(0.), &rectangle(5.)), 3.);
    }
    #[test]
    fn overlap_has_zero_clearance() {
        assert_eq!(clearance(&rectangle(0.), &rectangle(0.5)), 0.);
    }
    #[test]
    fn invalid_abi_arguments_are_rejected() {
        unsafe {
            assert_eq!(
                drivelab_score_actors(
                    0,
                    0,
                    0,
                    std::ptr::null(),
                    std::ptr::null(),
                    std::ptr::null(),
                    std::ptr::null_mut(),
                    std::ptr::null_mut()
                ),
                1
            );
        }
    }
    #[test]
    fn empty_actor_batch_is_clear() {
        let a = rectangle(0.);
        let mut collision = [9];
        let mut distances = [-1.];
        unsafe {
            assert_eq!(
                drivelab_score_actors(
                    1,
                    1,
                    0,
                    a.as_ptr(),
                    a.as_ptr(),
                    std::ptr::null(),
                    collision.as_mut_ptr(),
                    distances.as_mut_ptr()
                ),
                0
            );
        }
        assert_eq!(collision, [0]);
        assert_eq!(distances, [100.]);
    }
}
