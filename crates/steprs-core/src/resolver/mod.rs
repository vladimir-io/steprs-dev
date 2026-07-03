use crate::arena::Arena;
use crate::entity::StepEntity;
use crate::output::Vec3;

pub mod aag_edges;

const CURVE_SAMPLES: usize = 16;

pub fn resolve_cartesian_point(arena: &Arena, id: u32) -> Option<[f64; 3]> {
    match arena.get(id)? {
        StepEntity::CartesianPoint { x, y, z } => Some([*x, *y, *z]),
        _ => None,
    }
}

pub fn resolve_direction(arena: &Arena, id: u32) -> Option<[f64; 3]> {
    match arena.get(id)? {
        StepEntity::Direction { x, y, z } => Some([*x, *y, *z]),
        _ => None,
    }
}

pub fn resolve_vector(arena: &Arena, id: u32) -> Option<[f64; 3]> {
    match arena.get(id)? {
        StepEntity::Vector {
            direction,
            magnitude,
        } => {
            let dir = resolve_direction(arena, *direction)?;
            Some([dir[0] * magnitude, dir[1] * magnitude, dir[2] * magnitude])
        }
        _ => None,
    }
}

pub fn resolve_axis2_basis(arena: &Arena, id: u32) -> Option<(Vec3, [f64; 3], [f64; 3])> {
    let entity = arena.get(id)?;
    let StepEntity::Axis2Placement3d {
        location,
        axis,
        ref_direction,
    } = entity
    else {
        return None;
    };

    let origin = resolve_cartesian_point(arena, *location)?;
    let axis_vec = resolve_direction(arena, *axis)?;
    let ref_vec = resolve_direction(arena, *ref_direction)?;

    Some((
        Vec3 {
            x: origin[0],
            y: origin[1],
            z: origin[2],
        },
        axis_vec,
        ref_vec,
    ))
}

pub fn resolve_axis2_placement(arena: &Arena, id: u32) -> Option<(Vec3, Vec3)> {
    resolve_axis2_basis(arena, id).map(|(origin, axis, _)| {
        (
            origin,
            Vec3 {
                x: axis[0],
                y: axis[1],
                z: axis[2],
            },
        )
    })
}

pub fn resolve_plane_normal(arena: &Arena, plane_or_placement: u32) -> Option<[f64; 3]> {
    match arena.get(plane_or_placement)? {
        StepEntity::Plane { placement } => {
            let entity = arena.get(*placement)?;
            let StepEntity::Axis2Placement3d { axis, .. } = entity else {
                return None;
            };
            resolve_direction(arena, *axis)
        }
        StepEntity::Axis2Placement3d { axis, .. } => resolve_direction(arena, *axis),
        _ => None,
    }
}

pub fn resolve_vertex_point(arena: &Arena, id: u32) -> Option<[f64; 3]> {
    let entity = arena.get(id)?;
    match entity {
        StepEntity::VertexPoint { vertex_geometry } => {
            resolve_cartesian_point(arena, *vertex_geometry)
        }
        StepEntity::CartesianPoint { x, y, z } => Some([*x, *y, *z]),
        _ => None,
    }
}

pub struct ResolvedCylindricalSurface {
    pub id: u32,
    pub radius: f64,
    pub origin: Vec3,
    pub axis: Vec3,
}

pub fn resolve_cylindrical_surface(arena: &Arena, id: u32) -> Option<ResolvedCylindricalSurface> {
    let entity = arena.get(id)?;
    let StepEntity::CylindricalSurface {
        placement, radius, ..
    } = entity
    else {
        return None;
    };

    let (origin, axis) = resolve_axis2_placement(arena, *placement)?;

    Some(ResolvedCylindricalSurface {
        id,
        radius: *radius,
        origin,
        axis,
    })
}

pub fn line_segment(arena: &Arena, point_id: u32, vector_id: u32) -> Option<([f64; 3], [f64; 3])> {
    let start = resolve_cartesian_point(arena, point_id)?;
    let delta = resolve_vector(arena, vector_id)?;
    Some((start, add3(start, delta)))
}

pub fn sample_circle_points(
    arena: &Arena,
    placement_id: u32,
    radius: f64,
    segments: usize,
) -> Vec<[f64; 3]> {
    let Some((origin, axis, ref_dir)) = resolve_axis2_basis(arena, placement_id) else {
        return Vec::new();
    };

    let u = normalize3(ref_dir);
    let v = normalize3(cross3(axis, ref_dir));
    let center = [origin.x, origin.y, origin.z];
    sample_planar_curve(center, u, v, radius, radius, segments)
}

pub fn sample_ellipse_points(
    arena: &Arena,
    placement_id: u32,
    semi_axis1: f64,
    semi_axis2: f64,
    segments: usize,
) -> Vec<[f64; 3]> {
    let Some((origin, axis, ref_dir)) = resolve_axis2_basis(arena, placement_id) else {
        return Vec::new();
    };

    let u = normalize3(ref_dir);
    let v = normalize3(cross3(axis, ref_dir));
    let center = [origin.x, origin.y, origin.z];
    sample_planar_curve(center, u, v, semi_axis1, semi_axis2, segments)
}

fn sample_planar_curve(
    center: [f64; 3],
    u: [f64; 3],
    v: [f64; 3],
    semi_axis1: f64,
    semi_axis2: f64,
    segments: usize,
) -> Vec<[f64; 3]> {
    let n = segments.max(3);
    let mut points = Vec::with_capacity(n);
    for i in 0..n {
        let t = (i as f64 / n as f64) * std::f64::consts::TAU;
        let (sin_t, cos_t) = t.sin_cos();
        points.push(add3(
            center,
            add3(scale3(u, semi_axis1 * cos_t), scale3(v, semi_axis2 * sin_t)),
        ));
    }
    points
}

pub fn collect_bound_loop_points(arena: &Arena, loop_id: u32, out: &mut Vec<[f64; 3]>) {
    out.extend(collect_loop_points_ordered(arena, loop_id));
}

/// Walk an edge loop in order, producing a connected polyline suitable for fan triangulation.
pub fn collect_loop_points_ordered(arena: &Arena, loop_id: u32) -> Vec<[f64; 3]> {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for edge_id in edges {
        append_oriented_edge_points(arena, *edge_id, &mut out);
    }
    out
}

fn append_oriented_edge_points(arena: &Arena, oriented_edge_id: u32, out: &mut Vec<[f64; 3]>) {
    let Some(StepEntity::OrientedEdge {
        edge_element,
        orientation,
    }) = arena.get(oriented_edge_id)
    else {
        return;
    };

    let mut edge_points = Vec::new();
    collect_edge_element_chain(arena, *edge_element, &mut edge_points);
    if !orientation {
        edge_points.reverse();
    }
    append_connected_points(out, &edge_points);
}

fn append_connected_points(out: &mut Vec<[f64; 3]>, points: &[[f64; 3]]) {
    for p in points {
        if out.last().is_some_and(|last| points_near(last, p)) {
            continue;
        }
        out.push(*p);
    }
}

pub(crate) fn collect_edge_element_chain(arena: &Arena, edge_id: u32, out: &mut Vec<[f64; 3]>) {
    match arena.get(edge_id) {
        Some(StepEntity::EdgeCurve {
            edge_start,
            edge_end,
            edge_geometry,
            ..
        }) => {
            collect_curve_chain(arena, *edge_start, *edge_end, *edge_geometry, out);
        }
        Some(StepEntity::Line {
            cartesian_point,
            vector,
        }) => {
            if let Some((start, end)) = line_segment(arena, *cartesian_point, *vector) {
                out.push(start);
                if !points_near(&start, &end) {
                    out.push(end);
                }
            }
        }
        Some(StepEntity::Circle { placement, radius }) => {
            out.extend(sample_circle_points(
                arena,
                *placement,
                *radius,
                CURVE_SAMPLES,
            ));
        }
        Some(StepEntity::Ellipse {
            placement,
            semi_axis1,
            semi_axis2,
        }) => {
            out.extend(sample_ellipse_points(
                arena,
                *placement,
                *semi_axis1,
                *semi_axis2,
                CURVE_SAMPLES,
            ));
        }
        Some(StepEntity::VertexPoint { .. }) => {
            if let Some(p) = resolve_vertex_point(arena, edge_id) {
                out.push(p);
            }
        }
        _ => try_collect_from_edge_curve(arena, edge_id, out),
    }
}

fn collect_curve_chain(
    arena: &Arena,
    start_id: u32,
    end_id: u32,
    geometry_id: u32,
    out: &mut Vec<[f64; 3]>,
) {
    let start = resolve_vertex_point(arena, start_id);
    let end = resolve_vertex_point(arena, end_id);

    match arena.get(geometry_id) {
        Some(StepEntity::Line {
            cartesian_point,
            vector,
        }) => {
            if let Some((a, b)) = line_segment(arena, *cartesian_point, *vector) {
                let chain = orient_segment(start, end, a, b);
                out.extend(chain);
            }
        }
        Some(StepEntity::Circle { placement, radius }) => {
            let mut samples = sample_circle_points(arena, *placement, *radius, CURVE_SAMPLES);
            if let (Some(s), Some(e)) = (start, end) {
                samples = orient_closed_curve(&samples, s, e);
            }
            out.extend(samples);
        }
        Some(StepEntity::Ellipse {
            placement,
            semi_axis1,
            semi_axis2,
        }) => {
            let mut samples =
                sample_ellipse_points(arena, *placement, *semi_axis1, *semi_axis2, CURVE_SAMPLES);
            if let (Some(s), Some(e)) = (start, end) {
                samples = orient_closed_curve(&samples, s, e);
            }
            out.extend(samples);
        }
        _ => {
            if let Some(s) = start {
                out.push(s);
            }
            if let Some(e) = end {
                if out.last().is_none_or(|last| !points_near(last, &e)) {
                    out.push(e);
                }
            }
        }
    }
}

fn orient_segment(
    start: Option<[f64; 3]>,
    end: Option<[f64; 3]>,
    a: [f64; 3],
    b: [f64; 3],
) -> Vec<[f64; 3]> {
    match (start, end) {
        (Some(s), Some(e)) => {
            if points_near(&a, &s) || points_near(&b, &e) {
                vec![a, b]
            } else {
                vec![b, a]
            }
        }
        _ => vec![a, b],
    }
}

fn orient_closed_curve(samples: &[[f64; 3]], start: [f64; 3], _end: [f64; 3]) -> Vec<[f64; 3]> {
    if samples.is_empty() {
        return Vec::new();
    }

    let start_idx = samples
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| point_dist(a, &start).total_cmp(&point_dist(b, &start)))
        .map(|(i, _)| i)
        .unwrap_or(0);

    samples
        .iter()
        .cycle()
        .skip(start_idx)
        .take(samples.len())
        .copied()
        .collect()
}

fn point_dist(a: &[f64; 3], b: &[f64; 3]) -> f64 {
    let dx = a[0] - b[0];
    let dy = a[1] - b[1];
    let dz = a[2] - b[2];
    (dx * dx + dy * dy + dz * dz).sqrt()
}

fn try_collect_from_edge_curve(arena: &Arena, edge_id: u32, out: &mut Vec<[f64; 3]>) {
    if let Some(StepEntity::Unknown { refs, .. }) = arena.get(edge_id) {
        for r in refs {
            if let Some(p) = resolve_vertex_point(arena, *r) {
                push_unique_point(out, p);
            } else if let Some(p) = resolve_cartesian_point(arena, *r) {
                push_unique_point(out, p);
            }
        }
    }
}

fn push_unique_point(out: &mut Vec<[f64; 3]>, p: [f64; 3]) {
    if !out.iter().any(|q| points_near(q, &p)) {
        out.push(p);
    }
}

fn points_near(a: &[f64; 3], b: &[f64; 3]) -> bool {
    (a[0] - b[0]).abs() < 1e-9 && (a[1] - b[1]).abs() < 1e-9 && (a[2] - b[2]).abs() < 1e-9
}

pub fn edge_loop_has_circle(arena: &Arena, loop_id: u32) -> bool {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return false;
    };

    edges
        .iter()
        .any(|edge_id| edge_loop_edge_has_curve(arena, *edge_id))
}

/// Collect `CIRCLE` radii from an `EDGE_LOOP` (via `ORIENTED_EDGE` → `EDGE_CURVE`).
pub fn collect_circle_radii_from_edge_loop(arena: &Arena, loop_id: u32) -> Vec<f64> {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return Vec::new();
    };

    let mut radii = Vec::new();
    for edge_id in edges {
        collect_oriented_edge_circle_radii(arena, *edge_id, &mut radii);
    }
    radii
}

fn collect_oriented_edge_circle_radii(arena: &Arena, oriented_edge_id: u32, out: &mut Vec<f64>) {
    let Some(StepEntity::OrientedEdge { edge_element, .. }) = arena.get(oriented_edge_id) else {
        return;
    };
    collect_edge_element_circle_radii(arena, *edge_element, out);
}

fn collect_edge_element_circle_radii(arena: &Arena, edge_id: u32, out: &mut Vec<f64>) {
    match arena.get(edge_id) {
        Some(StepEntity::Circle { radius, .. }) => out.push(*radius),
        Some(StepEntity::EdgeCurve { edge_geometry, .. }) => {
            if let Some(StepEntity::Circle { radius, .. }) = arena.get(*edge_geometry) {
                out.push(*radius);
            }
        }
        _ => {}
    }
}

fn oriented_edge_has_trim_curve(arena: &Arena, oriented_edge_id: u32) -> bool {
    let Some(StepEntity::OrientedEdge { edge_element, .. }) = arena.get(oriented_edge_id) else {
        return false;
    };
    edge_element_has_trim_curve(arena, *edge_element)
}

fn edge_element_has_trim_curve(arena: &Arena, edge_id: u32) -> bool {
    match arena.get(edge_id) {
        Some(StepEntity::EdgeCurve { edge_geometry, .. }) => {
            curve_geometry_is_trim_boundary(arena, *edge_geometry)
        }
        Some(StepEntity::Unknown { type_name, .. }) => {
            type_name.contains("B_SPLINE") || type_name.contains("TRIMMED")
        }
        _ => false,
    }
}

fn curve_geometry_is_trim_boundary(arena: &Arena, geometry_id: u32) -> bool {
    match arena.get(geometry_id) {
        Some(StepEntity::Unknown { type_name, .. }) => {
            type_name.contains("B_SPLINE") || type_name.contains("TRIMMED")
        }
        Some(StepEntity::Ellipse { .. }) => true,
        _ => false,
    }
}

pub fn edge_loop_has_trim_boundary(arena: &Arena, loop_id: u32) -> bool {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return false;
    };
    edges
        .iter()
        .any(|edge_id| oriented_edge_has_trim_curve(arena, *edge_id))
}

fn radii_match(a: f64, b: f64) -> bool {
    let tol = b.abs() * 0.02 + 1e-6;
    (a - b).abs() <= tol
}

/// Ignore rim circles that cannot belong to this bore (e.g. outer hull arcs in the same loop).
fn circle_rim_is_plausible(rim: f64, surface: f64) -> bool {
    let ratio = rim / surface.max(1e-9);
    (0.25..=4.0).contains(&ratio)
}

/// True when a `CYLINDRICAL_SURFACE` is used as a sheet-metal bore face with rim
/// circles matching the surface radius (the canonical STEP hole index chain).
pub fn cylindrical_surface_is_confirmed_bore(arena: &Arena, cyl_id: u32) -> bool {
    let Some(StepEntity::CylindricalSurface { radius, .. }) = arena.get(cyl_id) else {
        return false;
    };
    if *radius <= 0.0 {
        return false;
    }

    let mut has_face = false;
    let mut matching_rim = false;
    let mut mismatched_circle_rim = false;
    let mut trim_loop_without_circle = false;
    let mut spline_or_trim_rim = false;

    for (_, entity) in arena.iter() {
        let StepEntity::AdvancedFace {
            bounds,
            face_geometry,
            ..
        } = entity
        else {
            continue;
        };
        if *face_geometry != cyl_id {
            continue;
        }
        has_face = true;

        for bound_id in bounds {
            let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) else {
                continue;
            };
            let rim_radii = collect_circle_radii_from_edge_loop(arena, *bound);
            if rim_radii.is_empty() {
                let mut points = Vec::new();
                collect_bound_loop_points(arena, *bound, &mut points);
                if points.len() >= 3 {
                    trim_loop_without_circle = true;
                } else if edge_loop_has_trim_boundary(arena, *bound) {
                    spline_or_trim_rim = true;
                }
                continue;
            }

            let plausible: Vec<f64> = rim_radii
                .iter()
                .copied()
                .filter(|rim| circle_rim_is_plausible(*rim, *radius))
                .collect();

            if plausible.is_empty() {
                let mut points = Vec::new();
                collect_bound_loop_points(arena, *bound, &mut points);
                if points.len() >= 3 {
                    trim_loop_without_circle = true;
                } else if edge_loop_has_trim_boundary(arena, *bound) {
                    spline_or_trim_rim = true;
                }
                continue;
            }

            if plausible.iter().any(|rim| radii_match(*rim, *radius)) {
                matching_rim = true;
            } else {
                mismatched_circle_rim = true;
            }
        }
    }

    if !has_face {
        return false;
    }

    matching_rim || spline_or_trim_rim || (trim_loop_without_circle && !mismatched_circle_rim)
}

fn edge_loop_edge_has_curve(arena: &Arena, oriented_edge_id: u32) -> bool {
    let Some(StepEntity::OrientedEdge { edge_element, .. }) = arena.get(oriented_edge_id) else {
        return false;
    };

    match arena.get(*edge_element) {
        Some(StepEntity::Circle { .. }) | Some(StepEntity::Ellipse { .. }) => true,
        Some(StepEntity::EdgeCurve { edge_geometry, .. }) => matches!(
            arena.get(*edge_geometry),
            Some(StepEntity::Circle { .. }) | Some(StepEntity::Ellipse { .. })
        ),
        _ => false,
    }
}

fn add3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

fn scale3(v: [f64; 3], s: f64) -> [f64; 3] {
    [v[0] * s, v[1] * s, v[2] * s]
}

fn cross3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn normalize3(v: [f64; 3]) -> [f64; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len < f64::EPSILON {
        return v;
    }
    scale3(v, 1.0 / len)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::prescan::PrescanResult;
    use crate::parser::{ingest_step, parse_entities};

    #[test]
    fn line_segment_uses_vector_magnitude() {
        let input = b"DATA;
#1=CARTESIAN_POINT('',(0.0,0.0,0.0));
#2=DIRECTION('',(1.0,0.0,0.0));
#3=VECTOR('',#2,5.0);
#4=LINE('',#1,#3);";
        let prescan = PrescanResult {
            entity_count: 4,
            max_id: 4,
            density: 1.0,
        };
        let mut arena = Arena::from_prescan(&prescan);
        parse_entities(input, &mut arena).unwrap();

        let (start, end) = line_segment(&arena, 1, 3).unwrap();
        assert!((start[0] - 0.0).abs() < 1e-9);
        assert!((end[0] - 5.0).abs() < 1e-9);
    }

    #[test]
    fn sample_circle_produces_closed_ring() {
        let input = b"DATA;
#1=CARTESIAN_POINT('',(0.0,0.0,0.0));
#2=DIRECTION('',(0.0,0.0,1.0));
#3=DIRECTION('',(1.0,0.0,0.0));
#4=AXIS2_PLACEMENT_3D('',#1,#2,#3);
#5=CIRCLE('',#4,2.0);";
        let (_, _, prescan, _) = ingest_step(input).unwrap();
        let mut arena = Arena::from_prescan(&prescan);
        parse_entities(input, &mut arena).unwrap();

        let points = sample_circle_points(&arena, 4, 2.0, 8);
        assert_eq!(points.len(), 8);
        assert!((points[0][0] - 2.0).abs() < 1e-6);
    }

    #[test]
    fn confirmed_bore_requires_advanced_face_and_matching_circle_rim() {
        let input = b"DATA;
#1=CARTESIAN_POINT('',(0.0,0.0,0.0));
#2=DIRECTION('',(0.0,0.0,1.0));
#3=DIRECTION('',(1.0,0.0,0.0));
#4=AXIS2_PLACEMENT_3D('',#1,#2,#3);
#5=CYLINDRICAL_SURFACE('',#4,2.0);
#6=CARTESIAN_POINT('',(0.0,0.0,0.0));
#7=AXIS2_PLACEMENT_3D('',#6,#2,#3);
#8=CIRCLE('',#7,2.0);
#9=VERTEX_POINT('',#6);
#10=EDGE_CURVE('',#9,#9,#8,.T.);
#11=ORIENTED_EDGE('',*,*,#10,.T.);
#12=EDGE_LOOP('',(#11));
#13=FACE_OUTER_BOUND('',#12,.T.);
#14=ADVANCED_FACE('',(#13),#5,.F.);
#15=CYLINDRICAL_SURFACE('',#4,3.0);
#16=ADVANCED_FACE('',(#13),#15,.F.);";
        let (_, _, prescan, _) = ingest_step(input).unwrap();
        let mut arena = Arena::from_prescan(&prescan);
        parse_entities(input, &mut arena).unwrap();

        assert!(cylindrical_surface_is_confirmed_bore(&arena, 5));
        assert!(!cylindrical_surface_is_confirmed_bore(&arena, 15));
    }
}
