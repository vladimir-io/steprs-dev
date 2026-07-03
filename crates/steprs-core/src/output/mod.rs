use serde::{Deserialize, Serialize};

use crate::entity::StepEntity;

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct BoundingBox {
    pub min: Vec3,
    pub max: Vec3,
    pub dimensions: Vec3,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct UnitMetadata {
    pub detected_unit: String,
    pub confidence: f64,
    pub scale_to_mm: f64,
    pub source: String,
}

#[allow(dead_code)]
fn default_detection_source() -> String {
    "geometry".into()
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct MachiningHole {
    pub id: u32,
    pub kind: String,
    pub radius_mm: f64,
    pub diameter_mm: f64,
    pub origin: Vec3,
    pub axis: Vec3,
    /// Axial bore length from face bounds; absent when topology is incomplete.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth_mm: Option<f64>,
    /// AdvancedFace ids bound to this cylindrical surface (for picking/highlight).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub face_ids: Vec<u32>,
    /// Larger coaxial cylinder diameter when `kind` is `counterbore`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterbore_diameter_mm: Option<f64>,
    /// Collapsed linear/circular pattern count (geometry clustering).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance_count: Option<u32>,
    /// `geometry` (B-rep) or `pmi` (AP242 semantic, when present).
    #[serde(default = "default_detection_source")]
    pub detection_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PlanarFace {
    pub id: u32,
    pub normal: Vec3,
    pub area_mm2: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DetectedFillet {
    pub id: u32,
    pub kind: String,
    pub minor_radius_mm: f64,
    pub major_radius_mm: f64,
    pub min_tool_diameter_mm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DetectedPocket {
    pub id: u32,
    pub area_mm2: f64,
    pub depth_mm: f64,
    pub volume_mm3: f64,
    pub detection_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DetectedSlot {
    pub id: u32,
    pub width_mm: f64,
    pub length_mm: f64,
    pub depth_mm: f64,
    pub volume_mm3: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AagAdjacentFace {
    pub face_id: u32,
    pub edge_curve_id: u32,
    pub edge_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AagFaceNode {
    pub face_id: u32,
    pub surface_type: String,
    pub adjacent_faces: Vec<AagAdjacentFace>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AagReport {
    pub face_count: usize,
    pub adjacency_edge_count: usize,
    pub storage_mode: String,
    pub manifold_edge_count: usize,
    pub concave_edge_count: usize,
    pub convex_edge_count: usize,
    pub smooth_edge_count: usize,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub graph: Vec<AagFaceNode>,
    #[serde(default)]
    pub graph_truncated: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub graph_total_faces: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct FaceMeshRange {
    pub face_id: u32,
    pub index_start: u32,
    pub index_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TessellatedMesh {
    pub positions: Vec<f32>,
    pub normals: Vec<f32>,
    pub indices: Vec<u32>,
    pub triangle_count: usize,
    pub truncated: bool,
    /// Triangle index ranges per STEP face id (for raycast picking).
    #[serde(default)]
    pub face_ranges: Vec<FaceMeshRange>,
    /// Line segment endpoints (xyz pairs) for edge overlay.
    #[serde(default)]
    pub edge_positions: Vec<f32>,
    #[serde(default)]
    pub edge_segment_count: usize,
    /// Mesh backend: `brepkit`, `fan`, or `occt`.
    #[serde(default = "default_mesh_engine")]
    pub mesh_engine: String,
}

#[allow(dead_code)]
fn default_mesh_engine() -> String {
    "fan".into()
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct FaceClassification {
    pub face_id: u32,
    pub label: String,
    pub confidence: f64,
    pub adjacency_degree: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct FaceLabelReport {
    pub engine: String,
    pub face_classifications: Vec<FaceClassification>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct UndercutFace {
    pub id: u32,
    pub normal: Vec3,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct QuotingReport {
    pub units: UnitMetadata,
    pub bounding_box_mm: BoundingBox,
    /// Trimmed part envelope (1st–99th percentile) for stock sizing without stray points.
    pub part_envelope_mm: BoundingBox,
    pub total_surface_area_mm2: f64,
    pub stock_volume_mm3: f64,
    pub estimated_mass_g: f64,
    pub setup_count: usize,
    pub holes: Vec<MachiningHole>,
    pub planar_faces: Vec<PlanarFace>,
    pub fillets: Vec<DetectedFillet>,
    pub pockets: Vec<DetectedPocket>,
    pub slots: Vec<DetectedSlot>,
    pub undercuts: Vec<UndercutFace>,
    pub requires_5_axis: bool,
    pub min_internal_tool_diameter_mm: Option<f64>,
    /// Count of STEP entities whose type name suggests semantic hole PMI (AP242).
    #[serde(default)]
    pub pmi_hole_entity_count: usize,
    /// Non-fatal detection caveats surfaced to the UI.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub detection_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct EntityTypeCount {
    pub type_name: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ParseStats {
    pub entity_count: usize,
    pub max_id: u32,
    pub density: f64,
    pub storage_mode: String,
    pub parse_duration_ms: f64,
    pub type_breakdown: Vec<EntityTypeCount>,
    pub stages_completed: Vec<String>,
    #[serde(default)]
    pub entities_skipped: usize,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ParseResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub engine_version: String,
    pub stats: ParseStats,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<BoundingBox>,
    pub quoting: QuotingReport,
    pub aag: AagReport,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mesh: Option<TessellatedMesh>,
    pub labels: FaceLabelReport,
}

#[derive(Debug, Clone, Serialize)]
pub struct GeometryMetrics {
    pub bounding_box_mm: BoundingBox,
    pub stock_volume_mm3: f64,
    pub entity_count: usize,
    pub face_count: usize,
    pub hole_count: usize,
}

#[derive(Debug, Clone)]
pub struct ParsedEntity {
    pub id: u32,
    pub entity: StepEntity,
}
