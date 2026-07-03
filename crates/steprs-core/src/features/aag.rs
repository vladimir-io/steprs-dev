use std::collections::HashMap;

use petgraph::graph::NodeIndex;

use crate::entity::StepEntity;
use crate::output::{AagAdjacentFace, AagFaceNode, AagReport, DetectedPocket, DetectedSlot};
use crate::pipeline::ParseContext;
use crate::resolver::aag_edges::{
    build_manifold_edge_face_pairs, classify_edge_convexity, convexity_label, surface_type_label,
    EdgeConvexity,
};
use crate::topology::{bbox_dims, FaceRecord};

use super::geometry::{dot, polygon_area_in_plane};

/// Max faces in the serialized LLM graph (WASM memory + context-window guard).
pub const MAX_AAG_GRAPH_FACES: usize = 512;

pub struct AagAnalysis {
    pub report: AagReport,
    pub pockets: Vec<DetectedPocket>,
    pub slots: Vec<DetectedSlot>,
}

pub fn analyze_aag(ctx: &ParseContext<'_>, scale_to_mm: f64) -> AagAnalysis {
    let topology = &ctx.topology;
    let adjacency_edge_count = topology.graph.raw_edges().len();

    let manifold_pairs = build_manifold_edge_face_pairs(ctx.arena);
    let edge_attrs = classify_manifold_edges(ctx.arena, &manifold_pairs);

    let (graph, graph_truncated, graph_total_faces) =
        build_serialized_graph(ctx.arena, &topology.faces, &manifold_pairs, &edge_attrs);

    let concave_edge_count = edge_attrs
        .values()
        .filter(|c| **c == EdgeConvexity::Concave)
        .count();
    let convex_edge_count = edge_attrs
        .values()
        .filter(|c| **c == EdgeConvexity::Convex)
        .count();
    let smooth_edge_count = edge_attrs
        .values()
        .filter(|c| **c == EdgeConvexity::Smooth)
        .count();

    let mut pockets = detect_pockets(ctx, scale_to_mm);
    let slots = detect_slots(ctx, scale_to_mm, &topology.faces);

    if pockets.is_empty() {
        pockets = detect_pockets_heuristic(ctx, scale_to_mm);
    }

    AagAnalysis {
        report: AagReport {
            face_count: topology.faces.len(),
            adjacency_edge_count,
            storage_mode: match ctx.arena.mode() {
                crate::arena::StorageMode::Dense => "dense".into(),
                crate::arena::StorageMode::Sparse => "sparse".into(),
            },
            manifold_edge_count: manifold_pairs.len(),
            concave_edge_count,
            convex_edge_count,
            smooth_edge_count,
            graph,
            graph_truncated,
            graph_total_faces,
        },
        pockets,
        slots,
    }
}

type EdgeAttrMap = HashMap<u32, EdgeConvexity>;

fn classify_manifold_edges(
    arena: &crate::arena::Arena,
    pairs: &HashMap<u32, [u32; 2]>,
) -> EdgeAttrMap {
    let mut out = HashMap::with_capacity(pairs.len());
    for (edge_key, [fa, fb]) in pairs {
        if let Some(c) = classify_edge_convexity(arena, *fa, *fb, *edge_key) {
            out.insert(*edge_key, c);
        }
    }
    out
}

/// Per-face adjacency list for LLM ingestion (Joshi–Chang attributed graph).
fn build_serialized_graph(
    arena: &crate::arena::Arena,
    topology_faces: &[FaceRecord],
    manifold_pairs: &HashMap<u32, [u32; 2]>,
    edge_attrs: &EdgeAttrMap,
) -> (Vec<AagFaceNode>, bool, Option<usize>) {
    let mut face_ids: Vec<u32> = arena
        .iter()
        .filter_map(|(id, e)| matches!(e, StepEntity::AdvancedFace { .. }).then_some(id))
        .collect();
    face_ids.sort_unstable();

    let total = face_ids.len();
    let truncated = total > MAX_AAG_GRAPH_FACES;
    let cap = total.min(MAX_AAG_GRAPH_FACES);
    let included: std::collections::HashSet<u32> = face_ids.iter().take(cap).copied().collect();

    let geometry_by_face: HashMap<u32, u32> = face_ids
        .iter()
        .filter_map(|&id| {
            let StepEntity::AdvancedFace { face_geometry, .. } = arena.get(id)? else {
                return None;
            };
            Some((id, *face_geometry))
        })
        .collect();

    let mut face_adj: HashMap<u32, Vec<AagAdjacentFace>> = HashMap::new();

    for (edge_key, convexity) in edge_attrs {
        if *convexity == EdgeConvexity::Smooth {
            continue;
        }
        let Some([fa, fb]) = manifold_pairs.get(edge_key) else {
            continue;
        };
        if !included.contains(fa) || !included.contains(fb) {
            continue;
        }
        let label = convexity_label(*convexity).to_string();
        face_adj.entry(*fa).or_default().push(AagAdjacentFace {
            face_id: *fb,
            edge_curve_id: *edge_key,
            edge_type: label.clone(),
        });
        face_adj.entry(*fb).or_default().push(AagAdjacentFace {
            face_id: *fa,
            edge_curve_id: *edge_key,
            edge_type: label,
        });
    }

    let mut graph: Vec<AagFaceNode> = face_ids
        .iter()
        .take(cap)
        .map(|&face_id| {
            let geometry_id = geometry_by_face.get(&face_id).copied().unwrap_or(0);
            let surface_type = surface_type_label(arena, geometry_id).to_string();
            let mut adjacent_faces = face_adj.remove(&face_id).unwrap_or_default();
            adjacent_faces.sort_by_key(|a| (a.face_id, a.edge_curve_id));
            AagFaceNode {
                face_id,
                surface_type,
                adjacent_faces,
            }
        })
        .collect();

    graph.sort_by_key(|n| n.face_id);

    let _ = topology_faces;
    (graph, truncated, if truncated { Some(total) } else { None })
}

fn max_z(arena: &crate::arena::Arena) -> f64 {
    let mut max_z = f64::NEG_INFINITY;
    for (_, entity) in arena.iter() {
        if let StepEntity::CartesianPoint { z, .. } = entity {
            max_z = max_z.max(*z);
        }
    }
    max_z
}

fn detect_pockets(ctx: &ParseContext<'_>, scale_to_mm: f64) -> Vec<DetectedPocket> {
    let scale = scale_to_mm;
    let max_z = max_z(ctx.arena);
    let mut pockets = Vec::new();

    for face in &ctx.topology.faces {
        if !face.is_planar {
            continue;
        }
        let Some(normal) = face.normal else { continue };
        if dot(normal, [0.0, 0.0, 1.0]).abs() < 0.85 {
            continue;
        }

        let avg_z = face.boundary_points.iter().map(|p| p[2]).sum::<f64>()
            / face.boundary_points.len() as f64;
        let depth_mm = (max_z - avg_z) * scale;
        if depth_mm < 0.5 {
            continue;
        }

        let neighbors: Vec<&FaceRecord> = ctx.topology.neighbors(face.id).collect();
        if neighbors.is_empty() {
            continue;
        }

        let wall_count = neighbors
            .iter()
            .filter(|n| {
                n.normal
                    .map(|wall_n| dot(wall_n, normal).abs() < 0.25)
                    .unwrap_or(false)
            })
            .count();

        if wall_count < 2 {
            continue;
        }

        let area_mm2 = polygon_area_in_plane(&face.boundary_points, normal) * scale * scale;

        pockets.push(DetectedPocket {
            id: face.id,
            area_mm2,
            depth_mm,
            volume_mm3: area_mm2 * depth_mm,
            detection_method: "aag".into(),
        });
    }

    pockets.sort_by(|a, b| b.volume_mm3.total_cmp(&a.volume_mm3));
    pockets
}

fn detect_pockets_heuristic(ctx: &ParseContext<'_>, scale_to_mm: f64) -> Vec<DetectedPocket> {
    let scale = scale_to_mm;
    let max_z = max_z(ctx.arena);
    let mut pockets = Vec::new();

    for face in &ctx.topology.faces {
        if !face.is_planar {
            continue;
        }
        let Some(normal) = face.normal else { continue };
        if dot(normal, [0.0, 0.0, 1.0]).abs() < 0.85 {
            continue;
        }

        let avg_z = face.boundary_points.iter().map(|p| p[2]).sum::<f64>()
            / face.boundary_points.len() as f64;
        let depth_mm = (max_z - avg_z) * scale;
        if depth_mm < 0.5 {
            continue;
        }

        let area_mm2 = polygon_area_in_plane(&face.boundary_points, normal) * scale * scale;

        pockets.push(DetectedPocket {
            id: face.id,
            area_mm2,
            depth_mm,
            volume_mm3: area_mm2 * depth_mm,
            detection_method: "aag".into(),
        });
    }

    pockets.sort_by(|a, b| b.volume_mm3.total_cmp(&a.volume_mm3));
    pockets
}

fn detect_slots(
    ctx: &ParseContext<'_>,
    scale_to_mm: f64,
    faces: &[FaceRecord],
) -> Vec<DetectedSlot> {
    let scale = scale_to_mm;
    let mut slots = Vec::new();
    let mut node_map: HashMap<u32, NodeIndex> = HashMap::new();
    for (idx, face) in faces.iter().enumerate() {
        node_map.insert(face.id, NodeIndex::new(idx));
    }

    for face in faces {
        if !face.is_planar {
            continue;
        }
        let Some(normal) = face.normal else { continue };

        let neighbors: Vec<&FaceRecord> = ctx.topology.neighbors(face.id).collect();
        if neighbors.len() < 2 {
            continue;
        }

        let vertical_walls: Vec<&&FaceRecord> = neighbors
            .iter()
            .filter(|n| {
                n.normal
                    .map(|w| dot(w, [0.0, 0.0, 1.0]).abs() < 0.25)
                    .unwrap_or(false)
            })
            .collect();

        if vertical_walls.len() < 2 {
            continue;
        }

        let mut parallel_pair = false;
        for i in 0..vertical_walls.len() {
            for j in (i + 1)..vertical_walls.len() {
                if let (Some(a), Some(b)) = (vertical_walls[i].normal, vertical_walls[j].normal) {
                    if dot(a, b).abs() > 0.85 {
                        parallel_pair = true;
                    }
                }
            }
        }

        if !parallel_pair {
            continue;
        }

        let area_mm2 = polygon_area_in_plane(&face.boundary_points, normal) * scale * scale;
        let dims = bbox_dims(&face.boundary_points);

        slots.push(DetectedSlot {
            id: face.id,
            width_mm: dims[0].min(dims[1]) * scale,
            length_mm: dims[0].max(dims[1]) * scale,
            depth_mm: dims[2] * scale,
            volume_mm3: area_mm2 * dims[2] * scale,
        });
    }

    slots.sort_by(|a, b| b.volume_mm3.total_cmp(&a.volume_mm3));
    slots
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arena::Arena;
    use crate::features::extract_bounding_box;
    use crate::parser::{ingest_step, parse_entities};
    use crate::pipeline::ParseContext;
    use crate::topology::TopologyIndex;

    #[test]
    fn serialized_graph_has_concave_or_convex_edges() {
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
        let raw_bbox = extract_bounding_box(&arena).expect("bbox");
        let topology = TopologyIndex::build(&arena);
        let ctx = ParseContext {
            arena: &arena,
            prescan,
            raw_bytes: input,
            raw_bbox,
            scale_to_mm: 1.0,
            topology,
        };
        let analysis = analyze_aag(&ctx, 1.0);
        assert!(analysis.report.manifold_edge_count >= 1);
        assert!(analysis.report.concave_edge_count + analysis.report.convex_edge_count >= 1);
        assert!(!analysis.report.graph.is_empty());
    }
}
