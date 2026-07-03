use std::collections::HashMap;

use crate::arena::Arena;
use crate::entity::StepEntity;
use crate::output::Vec3;
use crate::resolver::{
    collect_bound_loop_points, cylindrical_surface_is_confirmed_bore, edge_loop_has_circle,
    resolve_axis2_placement, resolve_cylindrical_surface, resolve_plane_normal,
};

use super::geometry::{
    cluster_count_weighted, dot, extent_along_axis, normalize, polygon_area_in_plane,
};

const ALUMINUM_DENSITY_G_MM3: f64 = 0.0027;

pub fn scale_vec3(v: &Vec3, scale: f64) -> Vec3 {
    Vec3 {
        x: v.x * scale,
        y: v.y * scale,
        z: v.z * scale,
    }
}

pub fn scale_bounding_box(
    bbox: &crate::output::BoundingBox,
    scale: f64,
) -> crate::output::BoundingBox {
    crate::output::BoundingBox {
        min: scale_vec3(&bbox.min, scale),
        max: scale_vec3(&bbox.max, scale),
        dimensions: scale_vec3(&bbox.dimensions, scale),
    }
}

pub fn estimate_total_surface_area_mm2(
    ctx: &crate::pipeline::ParseContext<'_>,
    scale_to_mm: f64,
    envelope: &crate::output::BoundingBox,
) -> f64 {
    let scale2 = scale_to_mm * scale_to_mm;
    let mut total = 0.0;

    for face in &ctx.topology.faces {
        if face.boundary_points.len() < 3 {
            continue;
        }
        let points = &face.boundary_points;

        let area = match ctx.arena.get(face.geometry_id) {
            Some(StepEntity::Plane { placement }) => {
                if let Some(normal) = resolve_plane_normal(ctx.arena, *placement) {
                    polygon_area_in_plane(points, normal)
                } else {
                    super::geometry::polygon_area_3d(points)
                }
            }
            Some(StepEntity::CylindricalSurface {
                placement, radius, ..
            }) => {
                if let Some((_, axis)) = resolve_axis2_placement(ctx.arena, *placement) {
                    let axis_arr = [axis.x, axis.y, axis.z];
                    let height = extent_along_axis(points, axis_arr);
                    2.0 * std::f64::consts::PI * radius * height.max(radius * 0.1)
                } else {
                    2.0 * std::f64::consts::PI * radius * radius
                }
            }
            Some(StepEntity::ConicalSurface {
                radius, semi_angle, ..
            }) => {
                let slant = radius / semi_angle.max(0.01);
                std::f64::consts::PI * radius * slant
            }
            Some(StepEntity::ToroidalSurface {
                major_radius,
                minor_radius,
                ..
            }) => std::f64::consts::PI * major_radius * minor_radius * 4.0,
            _ => super::geometry::polygon_area_3d(points),
        };

        total += area * scale2;
    }

    let d = &envelope.dimensions;
    let envelope_area = 2.0 * (d.x * d.y + d.y * d.z + d.x * d.z);

    if total <= 0.0 || total > envelope_area * 20.0 {
        fallback_surface_area_mm2(envelope)
    } else {
        total
    }
}

fn fallback_surface_area_mm2(envelope: &crate::output::BoundingBox) -> f64 {
    let d = &envelope.dimensions;
    2.0 * (d.x * d.y + d.y * d.z + d.x * d.z)
}

pub fn estimate_stock_volume_mm3(bbox: &crate::output::BoundingBox) -> f64 {
    bbox.dimensions.x * bbox.dimensions.y * bbox.dimensions.z
}

pub fn estimate_mass_g(volume_mm3: f64) -> f64 {
    volume_mm3 * ALUMINUM_DENSITY_G_MM3
}

pub fn count_setup_orientations(
    ctx: &crate::pipeline::ParseContext<'_>,
    scale_to_mm: f64,
    envelope: &crate::output::BoundingBox,
) -> usize {
    let scale2 = scale_to_mm * scale_to_mm;
    let mut by_plane: HashMap<u32, ([f64; 3], f64)> = HashMap::new();

    for face in &ctx.topology.faces {
        if !face.is_planar {
            continue;
        }
        let Some(normal) = face.normal else {
            continue;
        };
        if face.boundary_points.len() < 3 {
            continue;
        }
        let area = polygon_area_in_plane(&face.boundary_points, normal);
        if area <= 0.0 {
            continue;
        }
        let entry = by_plane.entry(face.geometry_id).or_insert((normal, 0.0));
        entry.1 += area;
    }

    let weighted: Vec<([f64; 3], f64)> = by_plane
        .into_values()
        .map(|(n, a)| (n, a * scale2))
        .collect();

    if weighted.is_empty() {
        return 1;
    }

    let mut count = cluster_count_weighted(&weighted, 0.85, 0.05).max(1);

    let d = &envelope.dimensions;
    let max_dim = d.x.max(d.y).max(d.z);
    let min_dim = d.x.min(d.y).min(d.z);
    let aspect = max_dim / min_dim.max(1e-6);
    if aspect < 5.0 {
        count = count.min(2);
    }

    count
}

pub fn detect_undercut_faces(arena: &Arena, scale_to_mm: f64) -> Vec<crate::output::UndercutFace> {
    let mut undercuts = Vec::new();
    let z_up = [0.0, 0.0, 1.0];

    for (face_id, entity) in arena.iter() {
        let StepEntity::AdvancedFace {
            bounds,
            face_geometry,
            ..
        } = entity
        else {
            continue;
        };

        let normal = match arena.get(*face_geometry) {
            Some(StepEntity::Plane { placement }) => resolve_plane_normal(arena, *placement),
            Some(StepEntity::CylindricalSurface { placement, .. }) => {
                resolve_axis2_placement(arena, *placement).map(|(_, axis)| {
                    let a = [axis.x, axis.y, axis.z];
                    normalize(a)
                })
            }
            _ => None,
        };

        let Some(normal) = normal else { continue };
        if dot(normal, z_up) > -0.15 {
            continue;
        }

        let mut points = Vec::new();
        for bound_id in bounds {
            if let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) {
                collect_bound_loop_points(arena, *bound, &mut points);
            }
        }

        if points.is_empty() {
            continue;
        }

        undercuts.push(crate::output::UndercutFace {
            id: face_id,
            normal: Vec3 {
                x: normal[0],
                y: normal[1],
                z: normal[2],
            },
            reason: "Face normal opposes +Z tool approach".into(),
        });
    }

    let _ = scale_to_mm;
    undercuts
}

pub fn detect_fillets(arena: &Arena, scale_to_mm: f64) -> Vec<crate::output::DetectedFillet> {
    let mut fillets = Vec::new();
    for (id, entity) in arena.iter() {
        match entity {
            StepEntity::ToroidalSurface {
                major_radius,
                minor_radius,
                ..
            } => {
                fillets.push(crate::output::DetectedFillet {
                    id,
                    minor_radius_mm: minor_radius * scale_to_mm,
                    major_radius_mm: major_radius * scale_to_mm,
                    min_tool_diameter_mm: minor_radius * 2.0 * scale_to_mm,
                    kind: "toroidal".into(),
                });
            }
            StepEntity::CylindricalSurface { radius, .. } if *radius * scale_to_mm <= 3.0 => {
                fillets.push(crate::output::DetectedFillet {
                    id,
                    minor_radius_mm: radius * scale_to_mm,
                    major_radius_mm: radius * scale_to_mm,
                    min_tool_diameter_mm: radius * 2.0 * scale_to_mm,
                    kind: "small_cylinder_blend".into(),
                });
            }
            _ => {}
        }
    }
    fillets.sort_by(|a, b| a.min_tool_diameter_mm.total_cmp(&b.min_tool_diameter_mm));
    fillets
}

pub fn classify_cylindrical_features(
    arena: &Arena,
    scale_to_mm: f64,
) -> Vec<crate::output::MachiningHole> {
    let mut holes = Vec::new();
    let model_has_conical = arena_has_conical_surface(arena);

    for (cyl_id, entity) in arena.iter() {
        if !matches!(entity, StepEntity::CylindricalSurface { .. }) {
            continue;
        }

        let Some(resolved) = resolve_cylindrical_surface(arena, cyl_id) else {
            continue;
        };

        if resolved.radius <= 0.0 {
            continue;
        }

        if !cylindrical_surface_is_confirmed_bore(arena, cyl_id) {
            continue;
        }

        let (bound_count, has_conical_cap) =
            cylindrical_face_topology(arena, cyl_id, model_has_conical);
        let kind = if bound_count >= 2 {
            "through".to_string()
        } else if has_conical_cap {
            "blind_drill_point".to_string()
        } else if bound_count == 1 {
            "blind_flat".to_string()
        } else {
            "unknown".to_string()
        };

        holes.push(crate::output::MachiningHole {
            id: cyl_id,
            kind,
            radius_mm: resolved.radius * scale_to_mm,
            diameter_mm: resolved.radius * 2.0 * scale_to_mm,
            origin: scale_vec3(&resolved.origin, scale_to_mm),
            axis: resolved.axis,
            depth_mm: None,
            face_ids: Vec::new(),
            counterbore_diameter_mm: None,
            instance_count: None,
            detection_source: "geometry".into(),
        });
    }

    holes.sort_by_key(|h| h.id);
    holes
}

pub fn is_disc_like_envelope(bbox: &crate::output::BoundingBox) -> bool {
    let d = &bbox.dimensions;
    let mn = d.x.min(d.y).min(d.z);
    let mx = d.x.max(d.y).max(d.z);
    mn / mx.max(1e-6) < 0.35
}

pub fn refine_hole_kinds(
    arena: &Arena,
    holes: &mut [crate::output::MachiningHole],
    bbox: &crate::output::BoundingBox,
) {
    let model_has_conical = arena_has_conical_surface(arena);
    for hole in holes.iter_mut() {
        hole.kind = classify_hole_kind(arena, hole, bbox, model_has_conical);
    }
}

/// Attach axial depth and AdvancedFace ids for each machining hole.
pub fn enrich_hole_metadata(arena: &Arena, holes: &mut [crate::output::MachiningHole]) {
    for hole in holes.iter_mut() {
        hole.face_ids = face_ids_for_cylinder(arena, hole.id);
        if let Some((t_min, t_max)) =
            cylinder_boundary_axial_range(arena, hole.id, &hole.origin, &hole.axis)
        {
            let depth = (t_max - t_min).abs();
            if depth > 1e-6 {
                hole.depth_mm = Some(depth);
            }
        }
    }
}

fn face_ids_for_cylinder(arena: &Arena, cyl_id: u32) -> Vec<u32> {
    let mut ids = Vec::new();
    for (face_id, entity) in arena.iter() {
        let StepEntity::AdvancedFace { face_geometry, .. } = entity else {
            continue;
        };
        if *face_geometry == cyl_id {
            ids.push(face_id);
        }
    }
    ids.sort_unstable();
    ids
}

pub fn part_envelope_bbox(arena: &Arena, scale_to_mm: f64) -> crate::output::BoundingBox {
    robust_part_bbox(arena, scale_to_mm)
}

/// Drop cosmetic / tooth-root cylinders on disc-like parts; keep real drill bores.
pub fn filter_machining_holes(
    holes: Vec<crate::output::MachiningHole>,
    bbox: &crate::output::BoundingBox,
) -> Vec<crate::output::MachiningHole> {
    if holes.is_empty() {
        return holes;
    }

    let min_dim = bbox
        .dimensions
        .x
        .min(bbox.dimensions.y)
        .min(bbox.dimensions.z);
    let max_dim = bbox
        .dimensions
        .x
        .max(bbox.dimensions.y)
        .max(bbox.dimensions.z);
    let max_hole_diameter = if is_disc_like_envelope(bbox) && max_dim < min_dim * 5.0 {
        (min_dim * 0.95).min(max_dim * 0.55)
    } else {
        (min_dim * 0.5).min(60.0)
    };

    let center = [
        (bbox.min.x + bbox.max.x) * 0.5,
        (bbox.min.y + bbox.max.y) * 0.5,
        (bbox.min.z + bbox.max.z) * 0.5,
    ];
    let center_tol = (max_dim * 0.08).max(0.35);

    let mut holes: Vec<_> = holes
        .into_iter()
        .filter(|h| {
            let limit = match h.kind.as_str() {
                "through" => (max_dim * 0.85).max(40.0),
                "blind_flat" | "blind_drill_point" | "countersink" => (max_dim * 0.65).max(30.0),
                _ => max_hole_diameter,
            };
            if h.diameter_mm > limit || h.diameter_mm > 150.0 {
                return false;
            }
            match h.kind.as_str() {
                "unknown" => false,
                "blind_drill_point" => h.diameter_mm >= 1.25,
                _ => h.diameter_mm >= 0.75,
            }
        })
        .collect();

    let through_count = holes.iter().filter(|h| h.kind == "through").count();
    let blind_drill_count = holes
        .iter()
        .filter(|h| h.kind == "blind_drill_point")
        .count();
    if through_count >= 4 && blind_drill_count > through_count * 3 {
        holes.retain(|h| h.kind == "through" || h.kind == "blind_flat");
    }

    let through: Vec<_> = holes
        .iter()
        .filter(|h| h.kind == "through")
        .cloned()
        .collect();
    let mut blind: Vec<_> = holes.into_iter().filter(|h| h.kind != "through").collect();

    // Gear tooth roots: many coaxial blind cylinders on a thin disc, no through bores.
    if through.is_empty() && is_disc_like_envelope(bbox) && blind.len() >= 6 {
        let mut by_diameter: std::collections::HashMap<i64, usize> =
            ::std::collections::HashMap::new();
        for h in &blind {
            let key = (h.diameter_mm * 100.0).round() as i64;
            *by_diameter.entry(key).or_insert(0) += 1;
        }
        let repeating = by_diameter.values().any(|count| *count >= 4);
        if repeating {
            blind.retain(|h| axis_passes_near_point(&h.origin, &h.axis, center, center_tol));
        }
    }

    let mut combined = through;
    combined.extend(blind);
    cluster_coaxial_holes(combined)
}

pub fn promote_countersink_kinds(arena: &Arena, holes: &mut [crate::output::MachiningHole]) {
    let model_has_conical = arena_has_conical_surface(arena);
    for hole in holes.iter_mut() {
        if hole.kind != "blind_drill_point" {
            continue;
        }
        let (_, has_conical) = cylindrical_face_topology(arena, hole.id, model_has_conical);
        if has_conical {
            hole.kind = "countersink".into();
        }
    }
}

fn classify_hole_kind(
    arena: &Arena,
    hole: &crate::output::MachiningHole,
    bbox: &crate::output::BoundingBox,
    model_has_conical: bool,
) -> String {
    let (bound_count, has_conical_cap) =
        cylindrical_face_topology(arena, hole.id, model_has_conical);
    let Some((t_min, t_max)) =
        cylinder_boundary_axial_range(arena, hole.id, &hole.origin, &hole.axis)
    else {
        return hole.kind.clone();
    };

    let ax = normalize_axis(&hole.axis);
    let shell_tol = shell_tolerance_mm(bbox);
    let p_min = [
        hole.origin.x + t_min * ax[0],
        hole.origin.y + t_min * ax[1],
        hole.origin.z + t_min * ax[2],
    ];
    let p_max = [
        hole.origin.x + t_max * ax[0],
        hole.origin.y + t_max * ax[1],
        hole.origin.z + t_max * ax[2],
    ];

    let open_min = endpoint_touches_shell(p_min, bbox, shell_tol);
    let open_max = endpoint_touches_shell(p_max, bbox, shell_tol);

    if penetrates_opposite_shell_faces(p_min, p_max, bbox, shell_tol) {
        return "through".to_string();
    }
    if open_min ^ open_max {
        let axial_len = (t_max - t_min).abs();
        if bound_count >= 2 && axial_len > hole.diameter_mm {
            return "through".to_string();
        }
        if has_conical_cap {
            return "blind_drill_point".to_string();
        }
        return "blind_flat".to_string();
    }
    if open_min && open_max {
        let axial_len = (t_max - t_min).abs();
        if bound_count >= 2 && axial_len > hole.diameter_mm {
            return "through".to_string();
        }
        return "blind_flat".to_string();
    }

    // Angled or partially trimmed bores: fall back to face topology.
    if bound_count >= 2 {
        let axial_len = (t_max - t_min).abs();
        if axial_len <= hole.diameter_mm * 0.55 {
            return "blind_flat".to_string();
        }
        return "through".to_string();
    }
    if has_conical_cap {
        return "blind_drill_point".to_string();
    }

    hole.kind.clone()
}

fn cylinder_boundary_axial_range(
    arena: &Arena,
    cyl_id: u32,
    origin: &Vec3,
    axis: &Vec3,
) -> Option<(f64, f64)> {
    let ax = normalize_axis(axis);
    let mut t_min = f64::INFINITY;
    let mut t_max = f64::NEG_INFINITY;
    let mut found = false;

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

        for bound_id in bounds {
            if let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) {
                let mut points = Vec::new();
                collect_bound_loop_points(arena, *bound, &mut points);
                for p in points {
                    let t = (p[0] - origin.x) * ax[0]
                        + (p[1] - origin.y) * ax[1]
                        + (p[2] - origin.z) * ax[2];
                    t_min = t_min.min(t);
                    t_max = t_max.max(t);
                    found = true;
                }
            }
        }
    }

    if found {
        Some((t_min, t_max))
    } else {
        None
    }
}

fn shell_tolerance_mm(bbox: &crate::output::BoundingBox) -> f64 {
    let max_dim = bbox
        .dimensions
        .x
        .max(bbox.dimensions.y)
        .max(bbox.dimensions.z);
    (max_dim * 0.035).clamp(0.6, 3.5)
}

fn endpoint_touches_shell(point: [f64; 3], bbox: &crate::output::BoundingBox, tol: f64) -> bool {
    point[0] <= bbox.min.x + tol
        || point[0] >= bbox.max.x - tol
        || point[1] <= bbox.min.y + tol
        || point[1] >= bbox.max.y - tol
        || point[2] <= bbox.min.z + tol
        || point[2] >= bbox.max.z - tol
}

fn shell_face_flags(point: [f64; 3], bbox: &crate::output::BoundingBox, tol: f64) -> [bool; 6] {
    [
        point[0] <= bbox.min.x + tol,
        point[0] >= bbox.max.x - tol,
        point[1] <= bbox.min.y + tol,
        point[1] >= bbox.max.y - tol,
        point[2] <= bbox.min.z + tol,
        point[2] >= bbox.max.z - tol,
    ]
}

fn penetrates_opposite_shell_faces(
    p_min: [f64; 3],
    p_max: [f64; 3],
    bbox: &crate::output::BoundingBox,
    tol: f64,
) -> bool {
    let a = shell_face_flags(p_min, bbox, tol);
    let b = shell_face_flags(p_max, bbox, tol);
    (a[0] && b[1])
        || (a[1] && b[0])
        || (a[2] && b[3])
        || (a[3] && b[2])
        || (a[4] && b[5])
        || (a[5] && b[4])
}

fn robust_part_bbox(arena: &Arena, scale_to_mm: f64) -> crate::output::BoundingBox {
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let mut zs = Vec::new();

    for (_, entity) in arena.iter() {
        if let StepEntity::CartesianPoint { x, y, z } = entity {
            xs.push(x * scale_to_mm);
            ys.push(y * scale_to_mm);
            zs.push(z * scale_to_mm);
        }
    }

    if xs.is_empty() {
        return crate::output::BoundingBox {
            min: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            max: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            dimensions: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
        };
    }

    xs.sort_by(|a, b| a.total_cmp(b));
    ys.sort_by(|a, b| a.total_cmp(b));
    zs.sort_by(|a, b| a.total_cmp(b));

    let min_x = axis_percentile(&xs, 0.01);
    let max_x = axis_percentile(&xs, 0.99);
    let min_y = axis_percentile(&ys, 0.01);
    let max_y = axis_percentile(&ys, 0.99);
    let min_z = axis_percentile(&zs, 0.01);
    let max_z = axis_percentile(&zs, 0.99);

    crate::output::BoundingBox {
        min: Vec3 {
            x: min_x,
            y: min_y,
            z: min_z,
        },
        max: Vec3 {
            x: max_x,
            y: max_y,
            z: max_z,
        },
        dimensions: Vec3 {
            x: max_x - min_x,
            y: max_y - min_y,
            z: max_z - min_z,
        },
    }
}

fn axis_percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = ((sorted.len() - 1) as f64 * p).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

/// Tooth-root blends duplicate per tooth; keep representative radii only.
pub fn filter_machining_fillets(
    fillets: Vec<crate::output::DetectedFillet>,
    bbox: &crate::output::BoundingBox,
) -> Vec<crate::output::DetectedFillet> {
    if fillets.len() < 6 || !is_disc_like_envelope(bbox) {
        return fillets;
    }

    let toroidal: Vec<_> = fillets
        .iter()
        .filter(|f| f.kind == "toroidal")
        .cloned()
        .collect();
    if !toroidal.is_empty() {
        return dedupe_fillets_by_diameter(toroidal);
    }

    let blends: Vec<_> = fillets
        .iter()
        .filter(|f| f.kind == "small_cylinder_blend")
        .cloned()
        .collect();
    if blends.len() >= 6 {
        return dedupe_fillets_by_diameter(blends)
            .into_iter()
            .take(2)
            .collect();
    }

    fillets
}

pub fn filter_disc_machining_features(
    bbox: &crate::output::BoundingBox,
    pockets: Vec<crate::output::DetectedPocket>,
    slots: Vec<crate::output::DetectedSlot>,
) -> (
    Vec<crate::output::DetectedPocket>,
    Vec<crate::output::DetectedSlot>,
) {
    if !is_disc_like_envelope(bbox) {
        return (pockets, slots);
    }

    let thickness = bbox
        .dimensions
        .x
        .min(bbox.dimensions.y)
        .min(bbox.dimensions.z);
    let max_dim = bbox
        .dimensions
        .x
        .max(bbox.dimensions.y)
        .max(bbox.dimensions.z);
    let disc_area = std::f64::consts::PI * (max_dim * 0.5).powi(2);

    let pockets: Vec<_> = pockets
        .into_iter()
        .filter(|p| p.depth_mm >= thickness * 0.92 && p.area_mm2 >= disc_area * 0.18)
        .collect();
    let slots: Vec<_> = slots
        .into_iter()
        .filter(|s| s.depth_mm >= thickness * 0.5 && s.length_mm > s.width_mm * 1.4)
        .collect();
    (pockets, slots)
}

/// Curved tooth flanks on thin discs register as undercuts — not real 5-axis work.
pub fn filter_disc_undercuts(
    bbox: &crate::output::BoundingBox,
    undercuts: Vec<crate::output::UndercutFace>,
    face_count: usize,
) -> Vec<crate::output::UndercutFace> {
    if !is_disc_like_envelope(bbox) || face_count == 0 || undercuts.len() < 8 {
        return undercuts;
    }

    let ratio = undercuts.len() as f64 / face_count as f64;
    if ratio > 0.3 {
        return Vec::new();
    }

    undercuts
}

fn dedupe_fillets_by_diameter(
    mut fillets: Vec<crate::output::DetectedFillet>,
) -> Vec<crate::output::DetectedFillet> {
    fillets.sort_by(|a, b| {
        a.min_tool_diameter_mm
            .total_cmp(&b.min_tool_diameter_mm)
            .then_with(|| a.id.cmp(&b.id))
    });

    let mut kept: Vec<crate::output::DetectedFillet> = Vec::new();
    for fillet in fillets {
        if kept
            .iter()
            .any(|k| (k.min_tool_diameter_mm - fillet.min_tool_diameter_mm).abs() < 0.08)
        {
            continue;
        }
        kept.push(fillet);
    }
    kept
}

fn axis_passes_near_point(
    origin: &crate::output::Vec3,
    axis: &crate::output::Vec3,
    point: [f64; 3],
    tol_mm: f64,
) -> bool {
    let ax = normalize_axis(axis);
    let px = point[0] - origin.x;
    let py = point[1] - origin.y;
    let pz = point[2] - origin.z;
    let t = px * ax[0] + py * ax[1] + pz * ax[2];
    let cx = px - t * ax[0];
    let cy = py - t * ax[1];
    let cz = pz - t * ax[2];
    (cx * cx + cy * cy + cz * cz).sqrt() <= tol_mm
}

fn normalize_axis(axis: &crate::output::Vec3) -> [f64; 3] {
    let len = (axis.x * axis.x + axis.y * axis.y + axis.z * axis.z).sqrt();
    if len <= 1e-12 {
        return [0.0, 0.0, 1.0];
    }
    [axis.x / len, axis.y / len, axis.z / len]
}

fn cluster_coaxial_holes(
    mut holes: Vec<crate::output::MachiningHole>,
) -> Vec<crate::output::MachiningHole> {
    if holes.len() <= 1 {
        return holes;
    }

    holes.sort_by(|a, b| {
        kind_rank(&b.kind)
            .cmp(&kind_rank(&a.kind))
            .then(b.diameter_mm.total_cmp(&a.diameter_mm))
            .then_with(|| a.id.cmp(&b.id))
    });

    let mut kept: Vec<crate::output::MachiningHole> = Vec::new();
    'next: for hole in holes {
        for rep in &mut kept {
            if !holes_share_feature(&hole, rep) {
                continue;
            }
            rep.instance_count = Some(rep.instance_count.unwrap_or(1) + 1);
            continue 'next;
        }
        let mut h = hole;
        h.instance_count = Some(1);
        kept.push(h);
    }
    kept.sort_by_key(|h| h.id);
    kept
}

fn kind_rank(kind: &str) -> u8 {
    match kind {
        "through" | "counterbore" => 4,
        "countersink" => 3,
        "blind_flat" => 2,
        "blind_drill_point" => 1,
        _ => 0,
    }
}

fn holes_share_feature(a: &crate::output::MachiningHole, b: &crate::output::MachiningHole) -> bool {
    if axes_coaxial(a, b, 4.5) {
        return true;
    }

    let dx = b.origin.x - a.origin.x;
    let dy = b.origin.y - a.origin.y;
    let dz = b.origin.z - a.origin.z;
    let dist = (dx * dx + dy * dy + dz * dz).sqrt();
    if dist > 2.5 {
        return false;
    }

    let diam_ratio = a.diameter_mm / b.diameter_mm.max(1e-6);
    (0.85..=1.15).contains(&diam_ratio)
}

fn axes_coaxial(
    a: &crate::output::MachiningHole,
    b: &crate::output::MachiningHole,
    axis_line_tol_mm: f64,
) -> bool {
    let ax = normalize_axis(&a.axis);
    let bx = normalize_axis(&b.axis);
    let dot = (ax[0] * bx[0] + ax[1] * bx[1] + ax[2] * bx[2]).abs();
    if dot < 0.985 {
        return false;
    }

    let dx = b.origin.x - a.origin.x;
    let dy = b.origin.y - a.origin.y;
    let dz = b.origin.z - a.origin.z;
    let along = dx * ax[0] + dy * ax[1] + dz * ax[2];
    let px = dx - along * ax[0];
    let py = dy - along * ax[1];
    let pz = dz - along * ax[2];
    let perp = (px * px + py * py + pz * pz).sqrt();

    perp <= axis_line_tol_mm && along.abs() <= axis_line_tol_mm
}

fn arena_has_conical_surface(arena: &Arena) -> bool {
    arena
        .iter()
        .any(|(_, e)| matches!(e, StepEntity::ConicalSurface { .. }))
}

fn cylindrical_face_topology(arena: &Arena, cyl_id: u32, model_has_conical: bool) -> (usize, bool) {
    let mut bound_count = 0usize;
    let mut has_conical = model_has_conical;

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

        bound_count += bounds.len();

        if !has_conical {
            for bound_id in bounds {
                if let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) {
                    if edge_loop_has_circle(arena, *bound) {
                        has_conical = true;
                        break;
                    }
                }
            }
        }
    }

    (bound_count, has_conical)
}

pub fn planar_faces(
    ctx: &crate::pipeline::ParseContext<'_>,
    scale_to_mm: f64,
) -> Vec<crate::output::PlanarFace> {
    let scale2 = scale_to_mm * scale_to_mm;
    let mut by_plane: HashMap<u32, ([f64; 3], f64)> = HashMap::new();

    for face in &ctx.topology.faces {
        if !face.is_planar {
            continue;
        }
        let Some(normal) = face.normal else {
            continue;
        };
        if face.boundary_points.len() < 3 {
            continue;
        }
        let area = polygon_area_in_plane(&face.boundary_points, normal);
        if area <= 0.0 {
            continue;
        }
        let entry = by_plane.entry(face.geometry_id).or_insert((normal, 0.0));
        entry.1 += area;
    }

    let mut faces: Vec<crate::output::PlanarFace> = by_plane
        .into_iter()
        .map(|(id, (normal, area_raw))| crate::output::PlanarFace {
            id,
            normal: Vec3 {
                x: normal[0],
                y: normal[1],
                z: normal[2],
            },
            area_mm2: area_raw * scale2,
        })
        .collect();
    faces.sort_by(|a, b| b.area_mm2.total_cmp(&a.area_mm2));
    faces
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arena::Arena;
    use crate::entity::StepEntity;
    use crate::output::{BoundingBox, DetectedPocket, DetectedSlot, MachiningHole, Vec3};

    fn bbox_dims(x: f64, y: f64, z: f64) -> BoundingBox {
        BoundingBox {
            min: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            max: Vec3 { x, y, z },
            dimensions: Vec3 { x, y, z },
        }
    }

    fn hole(
        id: u32,
        kind: &str,
        diameter_mm: f64,
        origin: [f64; 3],
        axis: [f64; 3],
    ) -> MachiningHole {
        MachiningHole {
            id,
            kind: kind.into(),
            radius_mm: diameter_mm * 0.5,
            diameter_mm,
            origin: Vec3 {
                x: origin[0],
                y: origin[1],
                z: origin[2],
            },
            axis: Vec3 {
                x: axis[0],
                y: axis[1],
                z: axis[2],
            },
            depth_mm: None,
            face_ids: vec![],
            counterbore_diameter_mm: None,
            instance_count: None,
            detection_source: "geometry".into(),
        }
    }

    #[test]
    fn is_disc_like_envelope_detects_thin_discs() {
        assert!(is_disc_like_envelope(&bbox_dims(80.0, 80.0, 8.0)));
        assert!(!is_disc_like_envelope(&bbox_dims(40.0, 40.0, 35.0)));
    }

    #[test]
    fn filter_machining_holes_drops_oversized_false_positives() {
        let bbox = bbox_dims(50.0, 50.0, 10.0);
        let holes = vec![
            hole(1, "through", 6.0, [25.0, 25.0, 5.0], [0.0, 0.0, 1.0]),
            hole(2, "through", 120.0, [25.0, 25.0, 5.0], [0.0, 0.0, 1.0]),
            hole(3, "unknown", 4.0, [10.0, 10.0, 5.0], [0.0, 0.0, 1.0]),
        ];
        let kept = filter_machining_holes(holes, &bbox);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].id, 1);
    }

    #[test]
    fn filter_machining_holes_gear_tooth_roots_on_disc() {
        let bbox = bbox_dims(100.0, 100.0, 6.0);
        let mut holes: Vec<MachiningHole> = (0..8)
            .map(|i| {
                let angle = i as f64 * std::f64::consts::PI / 4.0;
                let r = 38.0;
                hole(
                    i + 1,
                    "blind_drill_point",
                    3.2,
                    [50.0 + r * angle.cos(), 50.0 + r * angle.sin(), 3.0],
                    [0.0, 0.0, 1.0],
                )
            })
            .collect();
        holes.push(hole(
            99,
            "blind_drill_point",
            3.2,
            [50.0, 50.0, 3.0],
            [0.0, 0.0, 1.0],
        ));
        let kept = filter_machining_holes(holes, &bbox);
        assert!(
            kept.len() <= 2,
            "tooth-root repeats should collapse to hub bore(s), got {}",
            kept.len()
        );
        assert!(kept.iter().any(|h| h.id == 99));
    }

    #[test]
    fn promote_countersink_kinds_when_model_has_conical_surface() {
        let mut arena = Arena::new();
        arena.insert(
            1,
            StepEntity::ConicalSurface {
                placement: 0,
                radius: 5.0,
                semi_angle: 0.5,
            },
        );
        let mut holes = vec![hole(
            10,
            "blind_drill_point",
            8.0,
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0],
        )];
        promote_countersink_kinds(&arena, &mut holes);
        assert_eq!(holes[0].kind, "countersink");
    }

    #[test]
    fn cluster_coaxial_holes_merges_counterbore_stack() {
        let holes = vec![
            hole(1, "counterbore", 12.0, [0.0, 0.0, 0.0], [0.0, 0.0, 1.0]),
            hole(2, "blind_flat", 6.0, [0.0, 0.0, 0.0], [0.0, 0.0, 1.0]),
        ];
        let clustered = cluster_coaxial_holes(holes);
        assert_eq!(clustered.len(), 1);
        assert_eq!(clustered[0].kind, "counterbore");
        assert_eq!(clustered[0].instance_count, Some(2));
    }

    #[test]
    fn filter_disc_machining_features_drops_shallow_pockets() {
        let bbox = bbox_dims(100.0, 100.0, 5.0);
        let pockets = vec![
            DetectedPocket {
                id: 1,
                area_mm2: 2000.0,
                depth_mm: 2.0,
                volume_mm3: 4000.0,
                detection_method: "aag".into(),
            },
            DetectedPocket {
                id: 2,
                area_mm2: 2500.0,
                depth_mm: 4.8,
                volume_mm3: 12000.0,
                detection_method: "aag".into(),
            },
        ];
        let slots = vec![DetectedSlot {
            id: 3,
            width_mm: 4.0,
            length_mm: 5.0,
            depth_mm: 3.0,
            volume_mm3: 60.0,
        }];
        let (pockets, slots) = filter_disc_machining_features(&bbox, pockets, slots);
        assert_eq!(pockets.len(), 1);
        assert_eq!(pockets[0].id, 2);
        assert!(slots.is_empty());
    }
}
