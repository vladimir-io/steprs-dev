use std::collections::HashSet;
use std::f64::consts::PI;

use crate::core::MAX_MESH_TRIANGLES;
use crate::entity::StepEntity;
use crate::output::TessellatedMesh;
use crate::pipeline::ParseContext;
use crate::resolver::{collect_loop_points_ordered, resolve_axis2_basis};

use super::geometry::{
    add, cross, dot, normalize, polygon_area_in_plane, scale, sort_points_ccw_in_plane, sub,
    triangulate_polygon_in_plane,
};

const CYL_THETA_STEPS: usize = 24;
const CYL_HEIGHT_STEPS: usize = 6;

pub fn tessellate_mesh(ctx: &ParseContext<'_>) -> Option<TessellatedMesh> {
    // Lean path: fan-triangulate from topology built during parse (no STEP re-read).
    tessellate_mesh_fan(ctx).map(|mut m| {
        m.mesh_engine = "fan".into();
        m
    })
}

#[cfg(feature = "brepkit-kernel")]
#[allow(dead_code)]
pub fn tessellate_mesh_brepkit(ctx: &ParseContext<'_>) -> Option<TessellatedMesh> {
    if let Ok(text) = std::str::from_utf8(ctx.raw_bytes) {
        if let Ok(mut mesh) = crate::kernel::tessellate_step_preview(text, ctx.scale_to_mm) {
            mesh.mesh_engine = "brepkit".into();
            return Some(mesh);
        }
    }
    tessellate_mesh(ctx)
}

fn tessellate_mesh_fan(ctx: &ParseContext<'_>) -> Option<TessellatedMesh> {
    let scale = ctx.scale_to_mm;
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut indices = Vec::new();
    let mut edge_positions = Vec::new();
    let mut edge_keys = HashSet::new();
    let mut triangle_count = 0usize;
    let mut edge_segment_count = 0usize;
    let mut truncated = false;
    let mut face_ranges = Vec::new();

    for face in &ctx.topology.faces {
        if triangle_count >= MAX_MESH_TRIANGLES {
            truncated = true;
            break;
        }

        let margin = bbox_margin(&ctx.raw_bbox);

        let best_loop = if let Some(StepEntity::AdvancedFace {
            bounds,
            face_geometry,
            ..
        }) = ctx.arena.get(face.id)
        {
            largest_loop(ctx, *face_geometry, bounds, face.normal)
                .map(|pts| filter_loop_to_bbox(&pts, &ctx.raw_bbox, margin))
                .filter(|pts| pts.len() >= 3)
                .or_else(|| {
                    let filtered =
                        filter_loop_to_bbox(&face.boundary_points, &ctx.raw_bbox, margin);
                    if filtered.len() >= 3 {
                        Some(filtered)
                    } else {
                        None
                    }
                })
        } else if face.boundary_points.len() >= 3 {
            let filtered = filter_loop_to_bbox(&face.boundary_points, &ctx.raw_bbox, margin);
            if filtered.len() >= 3 {
                Some(filtered)
            } else {
                None
            }
        } else {
            None
        };

        let Some(points) = best_loop else {
            continue;
        };

        if points.len() < 3 {
            continue;
        }

        let plane_normal = face
            .normal
            .or_else(|| match ctx.arena.get(face.geometry_id) {
                Some(StepEntity::Plane { placement }) => {
                    crate::resolver::resolve_plane_normal(ctx.arena, *placement)
                }
                _ => None,
            });

        let mut face_filled = false;
        let index_start = indices.len() as u32;

        let is_cylinder = matches!(
            ctx.arena.get(face.geometry_id),
            Some(StepEntity::CylindricalSurface { .. })
        );

        if is_cylinder {
            if let Some(StepEntity::CylindricalSurface {
                placement, radius, ..
            }) = ctx.arena.get(face.geometry_id)
            {
                let before = triangle_count;
                append_cylinder_patch(
                    ctx.arena,
                    *placement,
                    *radius,
                    &points,
                    scale,
                    &mut positions,
                    &mut normals,
                    &mut indices,
                    &mut triangle_count,
                    &mut truncated,
                );
                face_filled = triangle_count > before;
            }
        } else if matches!(
            ctx.arena.get(face.geometry_id),
            Some(StepEntity::Plane { .. })
        ) {
            if let Some(normal) = plane_normal {
                let area = polygon_area_in_plane(&points, normal);
                if area > 1e-9 {
                    let before = triangle_count;
                    append_planar_triangulated(
                        &points,
                        normal,
                        scale,
                        &mut positions,
                        &mut normals,
                        &mut indices,
                        &mut triangle_count,
                        &mut truncated,
                    );
                    face_filled = triangle_count > before;
                }
            }
        }

        let index_count = indices.len() as u32 - index_start;
        if index_count > 0 {
            face_ranges.push(crate::output::FaceMeshRange {
                face_id: face.id,
                index_start,
                index_count,
            });
        }

        // Wireframe fallback only when the mesh has no solid fill at all.
        if !face_filled && positions.is_empty() {
            push_loop_edges(
                &points,
                scale,
                &mut edge_positions,
                &mut edge_keys,
                &mut edge_segment_count,
            );
        }
    }

    if positions.is_empty() && edge_positions.is_empty() {
        return None;
    }

    Some(TessellatedMesh {
        positions,
        normals,
        indices,
        triangle_count,
        truncated,
        face_ranges,
        edge_positions,
        edge_segment_count,
        mesh_engine: "fan".into(),
    })
}

fn filter_loop_to_bbox(
    points: &[[f64; 3]],
    bbox: &crate::output::BoundingBox,
    margin: f64,
) -> Vec<[f64; 3]> {
    points
        .iter()
        .copied()
        .filter(|p| point_in_bbox(*p, bbox, margin))
        .collect()
}

fn point_in_bbox(p: [f64; 3], bbox: &crate::output::BoundingBox, margin: f64) -> bool {
    p[0] >= bbox.min.x - margin
        && p[0] <= bbox.max.x + margin
        && p[1] >= bbox.min.y - margin
        && p[1] <= bbox.max.y + margin
        && p[2] >= bbox.min.z - margin
        && p[2] <= bbox.max.z + margin
}

fn bbox_margin(bbox: &crate::output::BoundingBox) -> f64 {
    let dx = bbox.dimensions.x;
    let dy = bbox.dimensions.y;
    let dz = bbox.dimensions.z;
    0.05 * (dx * dx + dy * dy + dz * dz).sqrt().max(1e-9)
}

fn largest_loop(
    ctx: &ParseContext<'_>,
    face_geometry: u32,
    bounds: &[u32],
    face_normal: Option<[f64; 3]>,
) -> Option<Vec<[f64; 3]>> {
    let is_cylinder = matches!(
        ctx.arena.get(face_geometry),
        Some(StepEntity::CylindricalSurface { .. })
    );

    let plane_normal = face_normal.or_else(|| match ctx.arena.get(face_geometry) {
        Some(StepEntity::Plane { placement }) => {
            crate::resolver::resolve_plane_normal(ctx.arena, *placement)
        }
        _ => None,
    });

    let mut best_loop: Option<Vec<[f64; 3]>> = None;
    let mut best_score = 0.0f64;

    for bound_id in bounds {
        let Some(StepEntity::FaceBound { bound, .. }) = ctx.arena.get(*bound_id) else {
            continue;
        };

        let loop_points = collect_loop_points_ordered(ctx.arena, *bound);
        if loop_points.len() < 3 {
            continue;
        }

        let score = if is_cylinder {
            loop_perimeter(&loop_points)
        } else if let Some(normal) = plane_normal {
            polygon_area_in_plane(&loop_points, normal).abs()
        } else {
            continue;
        };

        if score < 1e-9 {
            continue;
        }

        if score > best_score {
            best_score = score;
            best_loop = Some(loop_points);
        }
    }

    best_loop
}

fn loop_perimeter(points: &[[f64; 3]]) -> f64 {
    if points.len() < 2 {
        return 0.0;
    }
    let mut len = 0.0;
    for i in 0..points.len() {
        let a = points[i];
        let b = points[(i + 1) % points.len()];
        let dx = a[0] - b[0];
        let dy = a[1] - b[1];
        let dz = a[2] - b[2];
        len += (dx * dx + dy * dy + dz * dz).sqrt();
    }
    len
}

fn push_loop_edges(
    points: &[[f64; 3]],
    scale: f64,
    edge_positions: &mut Vec<f32>,
    edge_keys: &mut HashSet<([i64; 3], [i64; 3])>,
    edge_segment_count: &mut usize,
) {
    if points.len() < 2 {
        return;
    }

    for i in 0..points.len() {
        push_unique_edge(
            points[i],
            points[(i + 1) % points.len()],
            scale,
            edge_positions,
            edge_keys,
            edge_segment_count,
        );
    }
}

fn push_unique_edge(
    a: [f64; 3],
    b: [f64; 3],
    scale: f64,
    edge_positions: &mut Vec<f32>,
    edge_keys: &mut HashSet<([i64; 3], [i64; 3])>,
    edge_segment_count: &mut usize,
) {
    let qa = quantize_mm(a, scale);
    let qb = quantize_mm(b, scale);
    if qa == qb {
        return;
    }
    let key = if qa <= qb { (qa, qb) } else { (qb, qa) };
    if !edge_keys.insert(key) {
        return;
    }
    push_scaled_point(a, scale, edge_positions);
    push_scaled_point(b, scale, edge_positions);
    *edge_segment_count += 1;
}

fn quantize_mm(point: [f64; 3], scale_to_mm: f64) -> [i64; 3] {
    [
        (point[0] * scale_to_mm * 10.0).round() as i64,
        (point[1] * scale_to_mm * 10.0).round() as i64,
        (point[2] * scale_to_mm * 10.0).round() as i64,
    ]
}

#[allow(clippy::too_many_arguments)]
fn append_planar_triangulated(
    points: &[[f64; 3]],
    normal: [f64; 3],
    scale: f64,
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
    indices: &mut Vec<u32>,
    triangle_count: &mut usize,
    truncated: &mut bool,
) {
    if points.len() < 3 {
        return;
    }

    let n = normalize(normal);
    let sorted = sort_points_ccw_in_plane(points, n);
    let tris = triangulate_polygon_in_plane(&sorted, n);
    if tris.is_empty() {
        return;
    }

    let base = (positions.len() / 3) as u32;
    for p in &sorted {
        push_vertex(*p, n, scale, positions, normals);
    }

    for [a, b, c] in tris {
        if *triangle_count >= MAX_MESH_TRIANGLES {
            *truncated = true;
            return;
        }
        indices.extend([base + a as u32, base + b as u32, base + c as u32]);
        *triangle_count += 1;
    }
}

#[allow(clippy::too_many_arguments)]
fn append_cylinder_patch(
    arena: &crate::arena::Arena,
    placement_id: u32,
    radius: f64,
    boundary: &[[f64; 3]],
    scale: f64,
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
    indices: &mut Vec<u32>,
    triangle_count: &mut usize,
    truncated: &mut bool,
) {
    let Some((origin_v, axis_raw, ref_dir)) = resolve_axis2_basis(arena, placement_id) else {
        return;
    };

    let origin = [origin_v.x, origin_v.y, origin_v.z];
    let axis = normalize(axis_raw);
    let u = normalize(ref_dir);
    let v = normalize(cross(axis, u));

    let mut h_min = f64::INFINITY;
    let mut h_max = f64::NEG_INFINITY;
    let mut thetas = Vec::with_capacity(boundary.len());

    for p in boundary {
        let rel = sub(*p, origin);
        let h = dot(rel, axis);
        h_min = h_min.min(h);
        h_max = h_max.max(h);
        let radial = sub(rel, super::geometry::scale(axis, h));
        let theta = dot(radial, v).atan2(dot(radial, u));
        thetas.push(theta);
    }

    if !h_min.is_finite() || h_max - h_min < 1e-12 {
        return;
    }

    let (theta_min, theta_max) = unwrap_theta_range(&thetas);
    let d_theta = (theta_max - theta_min).max(PI / 8.0);
    let n_theta = CYL_THETA_STEPS.max(4);
    let n_h = CYL_HEIGHT_STEPS.max(2);

    let mut grid: Vec<Vec<[f64; 3]>> = Vec::with_capacity(n_h);

    for j in 0..n_h {
        let t_h = if n_h == 1 {
            0.0
        } else {
            j as f64 / (n_h - 1) as f64
        };
        let h = h_min + (h_max - h_min) * t_h;
        let mut row = Vec::with_capacity(n_theta);
        for i in 0..n_theta {
            let t_theta = if n_theta == 1 {
                0.0
            } else {
                i as f64 / (n_theta - 1) as f64
            };
            let theta = theta_min + d_theta * t_theta;
            let pt = cylinder_point(origin, axis, u, v, radius, theta, h);
            row.push(pt);
        }
        grid.push(row);
    }

    for j in 0..n_h - 1 {
        for i in 0..n_theta - 1 {
            if *triangle_count >= MAX_MESH_TRIANGLES {
                *truncated = true;
                return;
            }

            let p00 = grid[j][i];
            let p10 = grid[j][i + 1];
            let p01 = grid[j + 1][i];
            let p11 = grid[j + 1][i + 1];

            let base = (positions.len() / 3) as u32;
            for p in [p00, p10, p01, p11] {
                let rel = sub(p, origin);
                let h = dot(rel, axis);
                let radial = normalize(sub(rel, super::geometry::scale(axis, h)));
                push_vertex(p, radial, scale, positions, normals);
            }

            indices.extend([base, base + 1, base + 2, base + 1, base + 3, base + 2]);
            *triangle_count += 2;
        }
    }
}

fn cylinder_point(
    origin: [f64; 3],
    axis: [f64; 3],
    u: [f64; 3],
    v: [f64; 3],
    radius: f64,
    theta: f64,
    h: f64,
) -> [f64; 3] {
    let ring = add(
        scale(u, radius * theta.cos()),
        scale(v, radius * theta.sin()),
    );
    add(origin, add(scale(axis, h), ring))
}

fn unwrap_theta_range(thetas: &[f64]) -> (f64, f64) {
    if thetas.is_empty() {
        return (0.0, 2.0 * PI);
    }

    let mut min_t = thetas[0];
    let mut max_t = thetas[0];
    for &t in &thetas[1..] {
        min_t = min_t.min(t);
        max_t = max_t.max(t);
    }

    if max_t - min_t > PI * 1.8 {
        let shifted: Vec<f64> = thetas
            .iter()
            .map(|&t| if t < 0.0 { t + 2.0 * PI } else { t })
            .collect();
        let mut s_min = shifted[0];
        let mut s_max = shifted[0];
        for &t in &shifted[1..] {
            s_min = s_min.min(t);
            s_max = s_max.max(t);
        }
        return (s_min, s_max);
    }

    (min_t, max_t)
}

fn push_scaled_point(point: [f64; 3], scale_to_mm: f64, out: &mut Vec<f32>) {
    out.extend([
        (point[0] * scale_to_mm) as f32,
        (point[1] * scale_to_mm) as f32,
        (point[2] * scale_to_mm) as f32,
    ]);
}

fn push_vertex(
    point: [f64; 3],
    normal: [f64; 3],
    scale_to_mm: f64,
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
) {
    positions.extend([
        (point[0] * scale_to_mm) as f32,
        (point[1] * scale_to_mm) as f32,
        (point[2] * scale_to_mm) as f32,
    ]);
    normals.extend([normal[0] as f32, normal[1] as f32, normal[2] as f32]);
}

#[cfg(test)]
mod tests {
    use crate::pipeline::{run_pipeline, ParseOptions, PipelineState};

    #[test]
    fn mesh_builds_for_prismatic_fixture() {
        let input = include_bytes!(
            "../../tests/fixtures/prismatic/00134379_5714d79fe4b038a63195ab5e_step_003.step"
        );
        let state = PipelineState::new();
        let gen = state.begin_parse();
        let output = run_pipeline(input, ParseOptions::full(), &state, gen, None).unwrap();
        let mesh = output.result.mesh.expect("mesh");
        assert!(
            mesh.triangle_count > 100,
            "triangles {}",
            mesh.triangle_count
        );
    }

    #[test]
    fn mesh_bbox_is_reasonable_for_fixture() {
        let input = include_bytes!(
            "../../tests/fixtures/prismatic/00134379_5714d79fe4b038a63195ab5e_step_003.step"
        );
        let state = PipelineState::new();
        let gen = state.begin_parse();
        let output = run_pipeline(input, ParseOptions::full(), &state, gen, None).unwrap();
        let mesh = output.result.mesh.expect("mesh");
        assert!(mesh.triangle_count > 100);

        let mut min = [f32::MAX; 3];
        let mut max = [f32::MIN; 3];
        for chunk in mesh.positions.chunks(3) {
            for (j, &v) in chunk.iter().enumerate() {
                min[j] = min[j].min(v);
                max[j] = max[j].max(v);
            }
        }
        let dx = max[0] - min[0];
        let dy = max[1] - min[1];
        let dz = max[2] - min[2];
        assert!(
            dx < 200.0 && dy < 200.0 && dz < 200.0,
            "bbox {dx}x{dy}x{dz} mm min={min:?} max={max:?}"
        );
        assert!(dx > 10.0 && dy > 10.0 && dz > 10.0);
    }
}
