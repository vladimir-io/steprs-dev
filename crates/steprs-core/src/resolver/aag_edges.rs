//! Joshi–Chang AAG edge resolution: manifold edge pairs, tangents, and face normals.

use std::collections::HashMap;

use crate::arena::Arena;
use crate::entity::StepEntity;

use super::{
    collect_edge_element_chain, resolve_axis2_placement, resolve_cylindrical_surface,
    resolve_plane_normal,
};

/// Canonical shared-edge key — matches topology edge indexing (OrientedEdge → edge_element id).
pub fn edge_curve_key(arena: &Arena, edge_element_id: u32) -> Option<u32> {
    let entity = arena.get(edge_element_id)?;
    match entity {
        StepEntity::EdgeCurve { .. } => Some(edge_element_id),
        StepEntity::Line { .. } | StepEntity::Circle { .. } | StepEntity::Ellipse { .. } => {
            Some(edge_element_id)
        }
        StepEntity::Unknown { type_name, .. } => {
            let upper = type_name.to_ascii_uppercase();
            if upper.contains("CURVE") || upper.contains("TRIMMED") || upper.contains("B_SPLINE") {
                Some(edge_element_id)
            } else {
                None
            }
        }
        _ => {
            // Any edge element we can sample for convexity classification.
            let mut points = Vec::new();
            collect_edge_element_chain(arena, edge_element_id, &mut points);
            if points.len() >= 2 {
                Some(edge_element_id)
            } else {
                None
            }
        }
    }
}

/// Map each manifold shared edge to the two `ADVANCED_FACE` ids that touch it.
pub fn build_manifold_edge_face_pairs(arena: &Arena) -> HashMap<u32, [u32; 2]> {
    let mut edge_to_faces: HashMap<u32, Vec<u32>> = HashMap::new();

    for (face_id, entity) in arena.iter() {
        let StepEntity::AdvancedFace { bounds, .. } = entity else {
            continue;
        };
        for bound_id in bounds {
            let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) else {
                continue;
            };
            collect_loop_edge_keys(arena, *bound, face_id, &mut edge_to_faces);
        }
    }

    edge_to_faces
        .into_iter()
        .filter_map(|(edge_id, mut faces)| {
            faces.sort_unstable();
            faces.dedup();
            if faces.len() == 2 {
                Some((edge_id, [faces[0], faces[1]]))
            } else {
                None
            }
        })
        .collect()
}

fn collect_loop_edge_keys(
    arena: &Arena,
    loop_id: u32,
    face_id: u32,
    out: &mut HashMap<u32, Vec<u32>>,
) {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return;
    };
    for oriented_edge_id in edges {
        let Some(StepEntity::OrientedEdge { edge_element, .. }) = arena.get(*oriented_edge_id)
        else {
            continue;
        };
        if let Some(key) = edge_curve_key(arena, *edge_element) {
            out.entry(key).or_default().push(face_id);
        }
    }
}

/// Surface type label for LLM serialization.
pub fn surface_type_label(arena: &Arena, geometry_id: u32) -> &'static str {
    match arena.get(geometry_id) {
        Some(StepEntity::Plane { .. }) => "PLANE",
        Some(StepEntity::CylindricalSurface { .. }) => "CYLINDRICAL_SURFACE",
        Some(StepEntity::ConicalSurface { .. }) => "CONICAL_SURFACE",
        Some(StepEntity::ToroidalSurface { .. }) => "TOROIDAL_SURFACE",
        _ => "UNKNOWN",
    }
}

/// Midpoint and unit tangent along an edge element (sampled polyline).
pub fn edge_midpoint_and_tangent(
    arena: &Arena,
    edge_element_id: u32,
) -> Option<([f64; 3], [f64; 3])> {
    let mut points = Vec::new();
    collect_edge_element_chain(arena, edge_element_id, &mut points);
    if points.len() < 2 {
        return None;
    }

    let mid_idx = points.len() / 2;
    let mid = points[mid_idx];
    let prev = points[mid_idx.saturating_sub(1)];
    let next = points[(mid_idx + 1).min(points.len() - 1)];
    let mut tangent = normalize3(sub3(next, prev));
    if tangent.iter().all(|c| c.abs() < 1e-12) {
        tangent = normalize3(sub3(points[points.len() - 1], points[0]));
    }
    if tangent.iter().all(|c| c.abs() < 1e-12) {
        return None;
    }
    Some((mid, tangent))
}

/// Outward-pointing face normal at a point on the face (respects `same_sense`).
pub fn face_normal_at_point(arena: &Arena, face_id: u32, point: [f64; 3]) -> Option<[f64; 3]> {
    let entity = arena.get(face_id)?;
    let StepEntity::AdvancedFace {
        face_geometry,
        same_sense,
        ..
    } = entity
    else {
        return None;
    };

    let mut normal = match arena.get(*face_geometry)? {
        StepEntity::Plane { placement } => resolve_plane_normal(arena, *placement)?,
        StepEntity::CylindricalSurface { .. } => {
            let cyl = resolve_cylindrical_surface(arena, *face_geometry)?;
            let op = [
                point[0] - cyl.origin.x,
                point[1] - cyl.origin.y,
                point[2] - cyl.origin.z,
            ];
            let axis = [cyl.axis.x, cyl.axis.y, cyl.axis.z];
            let axis_n = normalize3(axis);
            let axial = dot3(op, axis_n);
            let radial = [
                op[0] - axis_n[0] * axial,
                op[1] - axis_n[1] * axial,
                op[2] - axis_n[2] * axial,
            ];
            normalize3(radial)
        }
        StepEntity::ConicalSurface { placement, .. }
        | StepEntity::ToroidalSurface { placement, .. } => {
            let (_, axis) = resolve_axis2_placement(arena, *placement)?;
            normalize3([axis.x, axis.y, axis.z])
        }
        _ => return None,
    };

    if !same_sense {
        normal = [-normal[0], -normal[1], -normal[2]];
    }
    Some(normal)
}

/// Tangent along this face's boundary loop at the shared edge (loop direction).
pub fn face_edge_loop_tangent(arena: &Arena, face_id: u32, edge_key: u32) -> Option<[f64; 3]> {
    let StepEntity::AdvancedFace { bounds, .. } = arena.get(face_id)? else {
        return None;
    };

    for bound_id in bounds {
        let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) else {
            continue;
        };
        if let Some(t) = loop_tangent_at_edge(arena, *bound, edge_key) {
            return Some(t);
        }
    }
    edge_midpoint_and_tangent(arena, edge_key).map(|(_, t)| t)
}

fn loop_tangent_at_edge(arena: &Arena, loop_id: u32, edge_key: u32) -> Option<[f64; 3]> {
    let StepEntity::EdgeLoop { edges } = arena.get(loop_id)? else {
        return None;
    };

    for oriented_edge_id in edges {
        let StepEntity::OrientedEdge {
            edge_element,
            orientation,
        } = arena.get(*oriented_edge_id)?
        else {
            continue;
        };
        if edge_curve_key(arena, *edge_element)? != edge_key {
            continue;
        }

        let mut points = Vec::new();
        collect_edge_element_chain(arena, *edge_element, &mut points);
        if !orientation {
            points.reverse();
        }
        if points.len() < 2 {
            return None;
        }
        let tangent = normalize3(sub3(points[1], points[0]));
        if tangent.iter().any(|c| c.abs() > 1e-12) {
            return Some(tangent);
        }
    }
    None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeConvexity {
    Convex,
    Concave,
    /// Tangent-continuous split face (≈180° dihedral) — not a machining feature edge.
    Smooth,
}

const SMOOTH_DOT_THRESHOLD: f64 = 0.9995;
const TANGENT_ALIGN_EPS: f64 = 0.08;

/// Joshi–Chang dihedral attribute: convex (stock boundary) vs concave (material removal).
pub fn classify_edge_convexity(
    arena: &Arena,
    face_a: u32,
    face_b: u32,
    edge_key: u32,
) -> Option<EdgeConvexity> {
    let (mid, _) = edge_midpoint_and_tangent(arena, edge_key)?;
    let n1 = face_normal_at_point(arena, face_a, mid)?;
    let n2 = face_normal_at_point(arena, face_b, mid)?;

    if dot3(n1, n2).abs() > SMOOTH_DOT_THRESHOLD {
        return Some(EdgeConvexity::Smooth);
    }

    let tangent = face_edge_loop_tangent(arena, face_a, edge_key)
        .or_else(|| edge_midpoint_and_tangent(arena, edge_key).map(|(_, t)| t))?;

    let cross_n = cross3(n1, n2);
    let cross_len =
        (cross_n[0] * cross_n[0] + cross_n[1] * cross_n[1] + cross_n[2] * cross_n[2]).sqrt();
    if cross_len < 1e-10 {
        return Some(EdgeConvexity::Smooth);
    }
    let cross_unit = [
        cross_n[0] / cross_len,
        cross_n[1] / cross_len,
        cross_n[2] / cross_len,
    ];

    let alignment = dot3(cross_unit, tangent);
    if alignment.abs() < TANGENT_ALIGN_EPS {
        let offset = 1e-4;
        let p1 = [
            mid[0] + n1[0] * offset,
            mid[1] + n1[1] * offset,
            mid[2] + n1[2] * offset,
        ];
        let to_p1 = sub3(p1, mid);
        if dot3(to_p1, n2) < 0.0 {
            return Some(EdgeConvexity::Concave);
        }
        return Some(EdgeConvexity::Convex);
    }

    if alignment > 0.0 {
        Some(EdgeConvexity::Convex)
    } else {
        Some(EdgeConvexity::Concave)
    }
}

pub fn convexity_label(c: EdgeConvexity) -> &'static str {
    match c {
        EdgeConvexity::Convex => "CONVEX",
        EdgeConvexity::Concave => "CONCAVE",
        EdgeConvexity::Smooth => "SMOOTH",
    }
}

fn dot3(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

fn sub3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

fn normalize3(v: [f64; 3]) -> [f64; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len < f64::EPSILON {
        return v;
    }
    [v[0] / len, v[1] / len, v[2] / len]
}

fn cross3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::{ingest_step, parse_entities};

    #[test]
    fn manifold_edge_pairs_two_faces_one_curve() {
        let input = b"DATA;
#1=CARTESIAN_POINT('',(0.,0.,0.));
#2=CARTESIAN_POINT('',(10.,0.,0.));
#3=VERTEX_POINT('',#1);
#4=VERTEX_POINT('',#2);
#5=DIRECTION('',(1.,0.,0.));
#6=VECTOR('',#5,10.);
#7=LINE('',#1,#6);
#8=EDGE_CURVE('',#3,#4,#7,.T.);
#9=ORIENTED_EDGE('',*,*,#8,.T.);
#10=EDGE_LOOP('',(#9));
#11=FACE_OUTER_BOUND('',#10,.T.);
#12=DIRECTION('',(0.,0.,1.));
#13=DIRECTION('',(1.,0.,0.));
#14=AXIS2_PLACEMENT_3D('',#1,#12,#13);
#15=PLANE('',#14);
#16=ADVANCED_FACE('',(#11),#15,.T.);
#17=ADVANCED_FACE('',(#11),#15,.T.);";
        let (_, _, prescan, _) = ingest_step(input).unwrap();
        let mut arena = Arena::from_prescan(&prescan);
        parse_entities(input, &mut arena).unwrap();

        let pairs = build_manifold_edge_face_pairs(&arena);
        assert_eq!(pairs.len(), 1);
        assert!(pairs.contains_key(&8));
        let faces = pairs[&8];
        assert!(faces.contains(&16));
        assert!(faces.contains(&17));
    }

    #[test]
    fn perpendicular_planes_classify_as_convex_or_concave() {
        let input = b"DATA;
#1=CARTESIAN_POINT('',(0.,0.,0.));
#2=CARTESIAN_POINT('',(5.,0.,0.));
#3=VERTEX_POINT('',#1);
#4=VERTEX_POINT('',#2);
#5=DIRECTION('',(1.,0.,0.));
#6=VECTOR('',#5,5.);
#7=LINE('',#1,#6);
#8=EDGE_CURVE('',#3,#4,#7,.T.);
#9=ORIENTED_EDGE('',*,*,#8,.T.);
#10=EDGE_LOOP('',(#9));
#11=FACE_OUTER_BOUND('',#10,.T.);
#12=DIRECTION('',(0.,0.,1.));
#13=DIRECTION('',(1.,0.,0.));
#14=AXIS2_PLACEMENT_3D('',#1,#12,#13);
#15=PLANE('',#14);
#16=DIRECTION('',(0.,1.,0.));
#17=AXIS2_PLACEMENT_3D('',#1,#16,#13);
#18=PLANE('',#17);
#19=ADVANCED_FACE('',(#11),#15,.T.);
#20=ADVANCED_FACE('',(#11),#18,.T.);";
        let (_, _, prescan, _) = ingest_step(input).unwrap();
        let mut arena = Arena::from_prescan(&prescan);
        parse_entities(input, &mut arena).unwrap();

        let pairs = build_manifold_edge_face_pairs(&arena);
        let edge_key = *pairs.keys().next().expect("edge");
        let [fa, fb] = pairs[&edge_key];
        let c = classify_edge_convexity(&arena, fa, fb, edge_key).expect("classify");
        assert!(matches!(c, EdgeConvexity::Convex | EdgeConvexity::Concave));
    }
}
