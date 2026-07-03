//! Topology-based face classification from geometry type and AAG adjacency.

use crate::arena::Arena;
use crate::entity::StepEntity;
use crate::output::{BoundingBox, DetectedPocket, FaceClassification, FaceLabelReport};
use crate::pipeline::ParseContext;

use super::quoting::is_disc_like_envelope;

pub fn classify_face_labels(
    ctx: &ParseContext<'_>,
    slots: &[crate::output::DetectedSlot],
    pockets: &[DetectedPocket],
    bbox: &BoundingBox,
) -> FaceLabelReport {
    let disc_like = is_disc_like_envelope(bbox);
    let mut face_classifications = Vec::new();

    for face in &ctx.topology.faces {
        let degree = ctx.topology.adjacency_degree(face.id);
        let label = classify_face_label(
            ctx.arena,
            face.geometry_id,
            degree,
            slots,
            pockets,
            disc_like,
            face.id,
        );
        let confidence = label_confidence(degree, &label);

        face_classifications.push(FaceClassification {
            face_id: face.id,
            label,
            confidence,
            adjacency_degree: degree,
        });
    }

    face_classifications.sort_by_key(|c| c.face_id);

    FaceLabelReport {
        engine: "topology-v2".into(),
        face_classifications,
        notes:
            "Labels from surface geometry, adjacency, and quoting context (pockets/disc envelope)."
                .into(),
    }
}

fn classify_face_label(
    arena: &Arena,
    geometry_id: u32,
    degree: usize,
    slots: &[crate::output::DetectedSlot],
    pockets: &[DetectedPocket],
    disc_like: bool,
    face_id: u32,
) -> String {
    if slots.iter().any(|s| s.id == face_id) {
        return "slot".into();
    }

    if pockets.iter().any(|p| p.id == face_id) {
        return "pocket_floor".into();
    }

    match arena.get(geometry_id) {
        Some(StepEntity::Plane { .. }) if degree >= 3 && !pockets.is_empty() && !disc_like => {
            "pocket_wall".into()
        }
        Some(StepEntity::Plane { .. }) => "planar".into(),
        Some(StepEntity::CylindricalSurface { .. }) if disc_like => "curved_face".into(),
        Some(StepEntity::CylindricalSurface { .. }) => "cylindrical".into(),
        Some(StepEntity::ToroidalSurface { .. }) if disc_like => "tooth_fillet".into(),
        Some(StepEntity::ToroidalSurface { .. }) => "fillet".into(),
        Some(StepEntity::ConicalSurface { .. }) => "conical".into(),
        Some(StepEntity::Ellipse { .. }) => "elliptical".into(),
        _ => "unknown".into(),
    }
}

fn label_confidence(degree: usize, label: &str) -> f64 {
    let base = match label {
        "planar" | "cylindrical" | "elliptical" | "curved_face" => 0.82,
        "fillet" | "conical" | "tooth_fillet" => 0.78,
        "pocket_wall" | "pocket_floor" | "slot" => 0.72,
        _ => 0.45,
    };
    (base + (degree.min(6) as f64 * 0.02)).min(0.95)
}
