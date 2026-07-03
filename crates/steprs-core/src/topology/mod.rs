//! Topology IR — face records and edge-indexed adjacency (built once per parse).

use std::collections::HashMap;

use petgraph::graph::{Graph, NodeIndex};
use petgraph::Undirected;

use crate::arena::Arena;
use crate::core::POINT_QUANTIZE_SCALE;
use crate::entity::StepEntity;
use crate::resolver::{collect_bound_loop_points, resolve_plane_normal};

#[derive(Debug, Clone)]
pub struct FaceRecord {
    pub id: u32,
    pub geometry_id: u32,
    pub is_planar: bool,
    pub normal: Option<[f64; 3]>,
    pub boundary_points: Vec<[f64; 3]>,
    pub edge_keys: Vec<u64>,
}

pub struct TopologyIndex {
    pub faces: Vec<FaceRecord>,
    pub graph: Graph<(), (), Undirected>,
    pub face_node: HashMap<u32, NodeIndex>,
}

impl TopologyIndex {
    pub fn build(arena: &Arena) -> Self {
        let faces = collect_face_records(arena);
        let (graph, face_node) = build_edge_adjacency_graph(&faces);
        Self {
            faces,
            graph,
            face_node,
        }
    }

    pub fn adjacency_degree(&self, face_id: u32) -> usize {
        self.face_node
            .get(&face_id)
            .map(|n| self.graph.neighbors(*n).count())
            .unwrap_or(0)
    }

    pub fn neighbors<'a>(&'a self, face_id: u32) -> impl Iterator<Item = &'a FaceRecord> + 'a {
        let idx = self.face_node.get(&face_id).copied();
        idx.into_iter().flat_map(move |node| {
            self.graph
                .neighbors(node)
                .filter_map(|n| self.faces.get(n.index()))
        })
    }
}

pub fn collect_face_records(arena: &Arena) -> Vec<FaceRecord> {
    let mut faces = Vec::new();

    for (id, entity) in arena.iter() {
        let StepEntity::AdvancedFace {
            bounds,
            face_geometry,
            ..
        } = entity
        else {
            continue;
        };

        let mut boundary_points = Vec::new();
        let mut edge_keys = Vec::new();

        for bound_id in bounds {
            if let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) {
                collect_bound_loop_points(arena, *bound, &mut boundary_points);
                collect_face_edge_keys(arena, *bound, &mut edge_keys);
            }
        }

        if boundary_points.len() < 3 {
            continue;
        }

        let (is_planar, normal) = match arena.get(*face_geometry) {
            Some(StepEntity::Plane { placement }) => {
                (true, resolve_plane_normal(arena, *placement))
            }
            Some(StepEntity::CylindricalSurface { placement, .. })
            | Some(StepEntity::ConicalSurface { placement, .. })
            | Some(StepEntity::ToroidalSurface { placement, .. }) => {
                (false, resolve_plane_normal(arena, *placement))
            }
            _ => (false, None),
        };

        edge_keys.sort_unstable();
        edge_keys.dedup();

        faces.push(FaceRecord {
            id,
            geometry_id: *face_geometry,
            is_planar,
            normal,
            boundary_points,
            edge_keys,
        });
    }

    faces
}

fn collect_face_edge_keys(arena: &Arena, loop_id: u32, out: &mut Vec<u64>) {
    let Some(StepEntity::EdgeLoop { edges }) = arena.get(loop_id) else {
        return;
    };

    for oriented_edge_id in edges {
        if let Some(StepEntity::OrientedEdge { edge_element, .. }) = arena.get(*oriented_edge_id) {
            out.push(edge_key(*edge_element));
        }
    }
}

fn edge_key(edge_element_id: u32) -> u64 {
    edge_element_id as u64
}

fn build_edge_adjacency_graph(
    faces: &[FaceRecord],
) -> (Graph<(), (), Undirected>, HashMap<u32, NodeIndex>) {
    let mut graph: Graph<(), (), Undirected> =
        Graph::with_capacity(faces.len(), faces.len().saturating_mul(3));
    let mut face_node: HashMap<u32, NodeIndex> = HashMap::new();

    for face in faces {
        face_node.insert(face.id, graph.add_node(()));
    }

    let mut edge_to_faces: HashMap<u64, Vec<u32>> = HashMap::new();
    for face in faces {
        for key in &face.edge_keys {
            edge_to_faces.entry(*key).or_default().push(face.id);
        }
    }

    for face_ids in edge_to_faces.values() {
        if face_ids.len() < 2 {
            continue;
        }
        for i in 0..face_ids.len() {
            for j in (i + 1)..face_ids.len() {
                if let (Some(a), Some(b)) =
                    (face_node.get(&face_ids[i]), face_node.get(&face_ids[j]))
                {
                    graph.add_edge(*a, *b, ());
                }
            }
        }
    }

    (graph, face_node)
}

pub fn quantize_point(p: [f64; 3]) -> (i64, i64, i64) {
    (
        (p[0] * POINT_QUANTIZE_SCALE).round() as i64,
        (p[1] * POINT_QUANTIZE_SCALE).round() as i64,
        (p[2] * POINT_QUANTIZE_SCALE).round() as i64,
    )
}

pub fn bbox_dims(points: &[[f64; 3]]) -> [f64; 3] {
    let mut min = [f64::INFINITY; 3];
    let mut max = [f64::NEG_INFINITY; 3];
    for p in points {
        for i in 0..3 {
            min[i] = min[i].min(p[i]);
            max[i] = max[i].max(p[i]);
        }
    }
    [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edge_adjacency_links_shared_curve() {
        let faces = vec![
            FaceRecord {
                id: 1,
                geometry_id: 10,
                is_planar: true,
                normal: Some([0.0, 0.0, 1.0]),
                boundary_points: vec![],
                edge_keys: vec![42],
            },
            FaceRecord {
                id: 2,
                geometry_id: 11,
                is_planar: true,
                normal: Some([0.0, 0.0, 1.0]),
                boundary_points: vec![],
                edge_keys: vec![42],
            },
        ];
        let (graph, _) = build_edge_adjacency_graph(&faces);
        assert_eq!(graph.raw_edges().len(), 1);
    }
}
