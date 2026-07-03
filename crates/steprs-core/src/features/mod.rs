mod aag;
mod geometry;
mod labels;
mod mesh;
mod pmi;
mod quoting;
mod units;

use std::collections::HashMap;

pub use labels::classify_face_labels;
pub use mesh::tessellate_mesh;
pub use quoting::{
    classify_cylindrical_features, count_setup_orientations, detect_fillets, detect_undercut_faces,
    enrich_hole_metadata, estimate_mass_g, estimate_stock_volume_mm3,
    estimate_total_surface_area_mm2, filter_disc_machining_features, filter_disc_undercuts,
    filter_machining_fillets, filter_machining_holes, is_disc_like_envelope, part_envelope_bbox,
    planar_faces, promote_countersink_kinds, refine_hole_kinds, scale_bounding_box,
};
pub use units::detect_units;

use crate::arena::Arena;
use crate::entity::StepEntity;
use crate::output::{BoundingBox, EntityTypeCount, ParsedEntity, QuotingReport, Vec3};
use crate::pipeline::ParseContext;

pub fn extract_bounding_box(arena: &Arena) -> Option<BoundingBox> {
    let mut min = [f64::INFINITY; 3];
    let mut max = [f64::NEG_INFINITY; 3];
    let mut found = false;

    for (_, entity) in arena.iter() {
        if let StepEntity::CartesianPoint { x, y, z } = entity {
            found = true;
            min[0] = min[0].min(*x);
            min[1] = min[1].min(*y);
            min[2] = min[2].min(*z);
            max[0] = max[0].max(*x);
            max[1] = max[1].max(*y);
            max[2] = max[2].max(*z);
        }
    }

    if !found {
        return None;
    }

    Some(BoundingBox {
        min: Vec3 {
            x: min[0],
            y: min[1],
            z: min[2],
        },
        max: Vec3 {
            x: max[0],
            y: max[1],
            z: max[2],
        },
        dimensions: Vec3 {
            x: max[0] - min[0],
            y: max[1] - min[1],
            z: max[2] - min[2],
        },
    })
}

pub fn extract_quoting_report(ctx: &ParseContext<'_>) -> (QuotingReport, crate::output::AagReport) {
    let raw_bbox = &ctx.raw_bbox;
    let raw_max = raw_bbox
        .dimensions
        .x
        .max(raw_bbox.dimensions.y)
        .max(raw_bbox.dimensions.z);

    let units = detect_units(ctx.raw_bytes, raw_max);
    let scale = units.scale_to_mm;
    let bbox_mm = scale_bounding_box(raw_bbox, scale);
    let part_envelope_mm = part_envelope_bbox(ctx.arena, scale);

    let total_surface_area_mm2 = estimate_total_surface_area_mm2(ctx, scale, &part_envelope_mm);
    let stock_volume_mm3 = estimate_stock_volume_mm3(&part_envelope_mm);
    let estimated_mass_g = estimate_mass_g(stock_volume_mm3);
    let setup_count = count_setup_orientations(ctx, scale, &part_envelope_mm);
    let mut holes = classify_cylindrical_features(ctx.arena, scale);
    let mut unknown_holes: Vec<_> = holes
        .iter()
        .filter(|h| h.kind == "unknown")
        .cloned()
        .collect();
    if !unknown_holes.is_empty() {
        refine_hole_kinds(ctx.arena, &mut unknown_holes, &part_envelope_mm);
        for refined in unknown_holes {
            if let Some(h) = holes.iter_mut().find(|h| h.id == refined.id) {
                h.kind = refined.kind;
            }
        }
    }
    let mut holes = filter_machining_holes(holes, &part_envelope_mm);
    refine_hole_kinds(ctx.arena, &mut holes, &part_envelope_mm);
    enrich_hole_metadata(ctx.arena, &mut holes);
    quoting::promote_countersink_kinds(ctx.arena, &mut holes);
    let pmi_hole_entity_count = pmi::count_semantic_hole_entities(ctx.arena);
    let mut detection_notes = pmi::detection_notes(ctx.arena, &holes);
    if holes.iter().any(|h| h.kind == "unknown") {
        detection_notes.push(
            "Some cylindrical features could not be classified. Review unknown holes.".into(),
        );
    }
    let planar = planar_faces(ctx, scale);
    let fillets = filter_machining_fillets(detect_fillets(ctx.arena, scale), &part_envelope_mm);
    let aag = aag::analyze_aag(ctx, scale);
    let (pockets, slots) =
        filter_disc_machining_features(&part_envelope_mm, aag.pockets, aag.slots);
    let undercuts = filter_disc_undercuts(
        &part_envelope_mm,
        detect_undercut_faces(ctx.arena, scale),
        ctx.topology.faces.len(),
    );
    let requires_5_axis = !undercuts.is_empty();
    let min_internal_tool_diameter_mm = fillets.first().map(|f| f.min_tool_diameter_mm);

    (
        QuotingReport {
            units,
            bounding_box_mm: bbox_mm,
            part_envelope_mm,
            total_surface_area_mm2,
            stock_volume_mm3,
            estimated_mass_g,
            setup_count,
            holes,
            planar_faces: planar,
            fillets,
            pockets,
            slots,
            undercuts,
            requires_5_axis,
            min_internal_tool_diameter_mm,
            pmi_hole_entity_count,
            detection_notes,
        },
        aag.report,
    )
}

pub fn compute_type_breakdown(entities: &[ParsedEntity]) -> Vec<EntityTypeCount> {
    let mut counts: HashMap<String, usize> = HashMap::new();

    for parsed in entities {
        *counts
            .entry(parsed.entity.type_name().to_string())
            .or_insert(0) += 1;
    }

    let mut breakdown: Vec<EntityTypeCount> = counts
        .into_iter()
        .map(|(type_name, count)| EntityTypeCount { type_name, count })
        .collect();

    breakdown.sort_by_key(|b| std::cmp::Reverse(b.count));
    breakdown
}
