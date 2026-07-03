pub fn normalize(v: [f64; 3]) -> [f64; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len < 1e-12 {
        return [0.0, 0.0, 1.0];
    }
    [v[0] / len, v[1] / len, v[2] / len]
}

pub fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

pub fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

pub fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

pub fn add(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

pub fn scale(v: [f64; 3], s: f64) -> [f64; 3] {
    [v[0] * s, v[1] * s, v[2] * s]
}

pub fn extent_along_axis(points: &[[f64; 3]], axis: [f64; 3]) -> f64 {
    if points.is_empty() {
        return 0.0;
    }
    let mut min = dot(points[0], axis);
    let mut max = min;
    for p in points.iter().skip(1) {
        let proj = dot(*p, axis);
        min = min.min(proj);
        max = max.max(proj);
    }
    (max - min).abs()
}

pub fn polygon_area_3d(points: &[[f64; 3]]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    let origin = points[0];
    let mut area = 0.0;
    for i in 1..points.len() - 1 {
        let v1 = sub(points[i], origin);
        let v2 = sub(points[i + 1], origin);
        area += cross(v1, v2).iter().map(|c| c * c).sum::<f64>().sqrt() * 0.5;
    }
    area
}

pub fn polygon_area_in_plane(points: &[[f64; 3]], normal: [f64; 3]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    let n = normalize(normal);
    let ref_axis = if n[2].abs() < 0.9 {
        [0.0, 0.0, 1.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    let u = normalize(cross(n, ref_axis));
    let v = cross(n, u);

    let projected: Vec<[f64; 2]> = points.iter().map(|p| [dot(*p, u), dot(*p, v)]).collect();

    shoelace_2d(&projected).abs()
}

fn shoelace_2d(points: &[[f64; 2]]) -> f64 {
    if points.len() < 3 {
        return 0.0;
    }
    let mut area = 0.0;
    for i in 0..points.len() {
        let j = (i + 1) % points.len();
        area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
    }
    area * 0.5
}

/// Order coplanar points counter-clockwise in their plane (for simple polygon fan).
pub fn sort_points_ccw_in_plane(points: &[[f64; 3]], normal: [f64; 3]) -> Vec<[f64; 3]> {
    if points.len() < 3 {
        return points.to_vec();
    }

    let n = normalize(normal);
    let ref_axis = if n[2].abs() < 0.9 {
        [0.0, 0.0, 1.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    let u = normalize(cross(n, ref_axis));
    let v = cross(n, u);

    let mut unique = Vec::new();
    for p in points {
        let duplicate = unique.iter().any(|q: &[f64; 3]| {
            (q[0] - p[0]).abs() < 1e-6 && (q[1] - p[1]).abs() < 1e-6 && (q[2] - p[2]).abs() < 1e-6
        });
        if !duplicate {
            unique.push(*p);
        }
    }

    if unique.len() < 3 {
        return unique;
    }

    let centroid = [
        unique.iter().map(|p| p[0]).sum::<f64>() / unique.len() as f64,
        unique.iter().map(|p| p[1]).sum::<f64>() / unique.len() as f64,
        unique.iter().map(|p| p[2]).sum::<f64>() / unique.len() as f64,
    ];

    let mut scored: Vec<(f64, [f64; 3])> = unique
        .iter()
        .map(|p| {
            let du = dot(*p, u) - dot(centroid, u);
            let dv = dot(*p, v) - dot(centroid, v);
            (dv.atan2(du), *p)
        })
        .collect();
    scored.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.into_iter().map(|(_, p)| p).collect()
}

fn plane_basis(normal: [f64; 3]) -> ([f64; 3], [f64; 3], [f64; 3]) {
    let n = normalize(normal);
    let ref_axis = if n[2].abs() < 0.9 {
        [0.0, 0.0, 1.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    let u = normalize(cross(n, ref_axis));
    let v = cross(n, u);
    (n, u, v)
}

fn project_to_plane_2d(points: &[[f64; 3]], normal: [f64; 3]) -> Vec<[f64; 2]> {
    let (_, u, v) = plane_basis(normal);
    points.iter().map(|p| [dot(*p, u), dot(*p, v)]).collect()
}

fn cross2(a: [f64; 2], b: [f64; 2], c: [f64; 2]) -> f64 {
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

fn point_in_triangle_2d(p: [f64; 2], a: [f64; 2], b: [f64; 2], c: [f64; 2]) -> bool {
    let d1 = cross2(p, a, b);
    let d2 = cross2(p, b, c);
    let d3 = cross2(p, c, a);
    let has_neg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
    let has_pos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
    !(has_neg && has_pos)
}

fn ear_clip_indices(points: &[[f64; 2]]) -> Vec<[usize; 3]> {
    if points.len() < 3 {
        return Vec::new();
    }
    let mut ring: Vec<usize> = (0..points.len()).collect();
    let mut tris = Vec::new();
    let mut guard = 0usize;

    while ring.len() > 3 && guard < points.len() * points.len() {
        guard += 1;
        let mut ear_found = false;
        let n = ring.len();
        for i in 0..n {
            let i_prev = (i + n - 1) % n;
            let i_next = (i + 1) % n;
            let prev = ring[i_prev];
            let curr = ring[i];
            let next = ring[i_next];
            let a = points[prev];
            let b = points[curr];
            let c = points[next];
            if cross2(a, b, c) <= 1e-9 {
                continue;
            }
            let mut inside = false;
            for &idx in &ring {
                if idx == prev || idx == curr || idx == next {
                    continue;
                }
                if point_in_triangle_2d(points[idx], a, b, c) {
                    inside = true;
                    break;
                }
            }
            if inside {
                continue;
            }
            tris.push([prev, curr, next]);
            ring.remove(i);
            ear_found = true;
            break;
        }
        if !ear_found {
            break;
        }
    }

    if ring.len() == 3 {
        tris.push([ring[0], ring[1], ring[2]]);
    }
    tris
}

fn fan_indices(vertex_count: usize) -> Vec<[usize; 3]> {
    if vertex_count < 3 {
        return Vec::new();
    }
    (1..vertex_count - 1).map(|i| [0, i, i + 1]).collect()
}

/// Ear-clip a simple polygon in 3D; falls back to a vertex fan for difficult loops.
pub fn triangulate_polygon_in_plane(points: &[[f64; 3]], normal: [f64; 3]) -> Vec<[usize; 3]> {
    let sorted = sort_points_ccw_in_plane(points, normal);
    if sorted.len() < 3 {
        return Vec::new();
    }
    let pts2d = project_to_plane_2d(&sorted, normal);
    let mut tris = ear_clip_indices(&pts2d);
    if tris.len() + 2 < sorted.len().saturating_sub(1) {
        tris = fan_indices(sorted.len());
    }
    tris
}

/// Area-weighted setup directions — ignores tiny tessellation facets.
pub fn cluster_count_weighted(
    items: &[([f64; 3], f64)],
    angle_threshold: f64,
    min_cluster_weight_frac: f64,
) -> usize {
    let total_weight: f64 = items.iter().map(|(_, w)| *w).sum();
    if total_weight <= 0.0 {
        return 1;
    }
    let mut clusters: Vec<([f64; 3], f64)> = Vec::new();
    for (n, w) in items {
        if *w <= 0.0 {
            continue;
        }
        let normalized = normalize(*n);
        if let Some(cluster) = clusters
            .iter_mut()
            .find(|(c, _)| dot(normalized, *c).abs() > angle_threshold)
        {
            cluster.1 += w;
        } else {
            clusters.push((normalized, *w));
        }
    }
    let min_w = total_weight * min_cluster_weight_frac;
    clusters.iter().filter(|(_, w)| *w >= min_w).count().max(1)
}
