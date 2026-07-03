/**
 * Shared types for worker ↔ WASM messages.
 * Schema: packages/ts-types/parse-result.schema.json (from `yarn schema:generate`).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vec3;
  max: Vec3;
  dimensions: Vec3;
}

export interface UnitMetadata {
  detected_unit: string;
  confidence: number;
  scale_to_mm: number;
  source: string;
}

export interface MachiningHole {
  id: number;
  kind: string;
  radius_mm: number;
  diameter_mm: number;
  origin: Vec3;
  axis: Vec3;
  /** Axial bore length from face bounds; omitted when topology is incomplete. */
  depth_mm?: number;
  /** AdvancedFace ids for this cylindrical surface (picking/highlight). */
  face_ids?: number[];
  /** Larger coaxial cylinder when kind is counterbore. */
  counterbore_diameter_mm?: number;
  /** Collapsed pattern instance count from geometry clustering. */
  instance_count?: number;
  /** geometry (B-rep) or pmi (AP242 semantic). */
  detection_source?: string;
}

export interface PlanarFace {
  id: number;
  normal: Vec3;
  area_mm2: number;
}

export interface DetectedFillet {
  id: number;
  kind: string;
  minor_radius_mm: number;
  major_radius_mm: number;
  min_tool_diameter_mm: number;
}

export interface DetectedPocket {
  id: number;
  area_mm2: number;
  depth_mm: number;
  volume_mm3: number;
  detection_method: string;
}

export interface DetectedSlot {
  id: number;
  width_mm: number;
  length_mm: number;
  depth_mm: number;
  volume_mm3: number;
}

export interface AagAdjacentFace {
  face_id: number;
  edge_curve_id: number;
  edge_type: "CONCAVE" | "CONVEX" | "SMOOTH" | string;
}

export interface AagFaceNode {
  face_id: number;
  surface_type: string;
  adjacent_faces: AagAdjacentFace[];
}

export interface AagReport {
  face_count: number;
  adjacency_edge_count: number;
  storage_mode: string;
  manifold_edge_count: number;
  concave_edge_count: number;
  convex_edge_count: number;
  smooth_edge_count: number;
  graph?: AagFaceNode[];
  graph_truncated?: boolean;
  graph_total_faces?: number;
}

export interface FaceMeshRange {
  face_id: number;
  index_start: number;
  index_count: number;
}

export interface TessellatedMesh {
  positions: ArrayLike<number>;
  normals: ArrayLike<number>;
  indices: ArrayLike<number>;
  triangle_count: number;
  truncated: boolean;
  face_ranges?: FaceMeshRange[];
  edge_positions?: ArrayLike<number>;
  edge_segment_count?: number;
  /** Mesh backend: `brepkit`, `fan`, or `occt`. */
  mesh_engine?: string;
}

export interface FaceClassification {
  face_id: number;
  label: string;
  confidence: number;
  adjacency_degree: number;
}

export interface FaceLabelReport {
  engine: string;
  face_classifications: FaceClassification[];
  notes: string;
}

export interface UndercutFace {
  id: number;
  normal: Vec3;
  reason: string;
}

export interface QuotingReport {
  units: UnitMetadata;
  bounding_box_mm: BoundingBox;
  /** Trimmed part envelope for stock sizing (robust to stray STEP points). */
  part_envelope_mm: BoundingBox;
  total_surface_area_mm2: number;
  stock_volume_mm3: number;
  estimated_mass_g: number;
  setup_count: number;
  holes: MachiningHole[];
  planar_faces: PlanarFace[];
  fillets: DetectedFillet[];
  pockets: DetectedPocket[];
  slots: DetectedSlot[];
  undercuts: UndercutFace[];
  requires_5_axis: boolean;
  min_internal_tool_diameter_mm?: number;
  pmi_hole_entity_count?: number;
  detection_notes?: string[];
}

export interface EntityTypeCount {
  type_name: string;
  count: number;
}

export interface ParseStats {
  entity_count: number;
  max_id: number;
  density: number;
  storage_mode: "dense" | "sparse";
  parse_duration_ms: number;
  type_breakdown: EntityTypeCount[];
  stages_completed: string[];
  entities_skipped?: number;
  warnings?: string[];
}

export interface ParseOptions {
  include_mesh: boolean;
  include_labels: boolean;
}

export interface ParseResult {
  success: boolean;
  error?: string;
  engine_version: string;
  stats: ParseStats;
  bounding_box?: BoundingBox;
  quoting: QuotingReport;
  aag: AagReport;
  mesh?: TessellatedMesh;
  labels: FaceLabelReport;
}

export type WorkerInboundMessage =
  | { type: "parse"; id: string; bytes: ArrayBuffer; options?: ParseOptions; openEditor?: boolean; fileName?: string }
  | { type: "cancel" }
  | { type: "init" }
  | { type: "editor_snapshot"; id: string }
  | { type: "editor_apply"; id: string; ops: EditOp[]; verify?: VerifySpec }
  | { type: "editor_undo"; id: string }
  | { type: "editor_redo"; id: string }
  | { type: "editor_export"; id: string }
  | { type: "editor_close"; id: string };

export type WorkerOutboundMessage =
  | { type: "ready" }
  | { type: "progress"; id: string; stage: string }
  | { type: "result"; id: string; result: ParseResult; snapshot?: ModelSnapshot }
  | { type: "error"; id: string; message: string }
  | { type: "editor_snapshot"; id: string; snapshot: ModelSnapshot; parseResult: ParseResult }
  | { type: "editor_edit"; id: string; editResult: EditResult; parseResult: ParseResult }
  | { type: "editor_export"; id: string; bytes: ArrayBuffer; fileName: string }
  | { type: "editor_undo"; id: string; snapshot: ModelSnapshot; parseResult: ParseResult; canUndo: boolean; canRedo: boolean }
  | { type: "editor_redo"; id: string; snapshot: ModelSnapshot; parseResult: ParseResult; canUndo: boolean; canRedo: boolean };

// --- AI STEP Editor ---

export interface SnapshotFace {
  id: number;
  geometry_id: number;
  is_planar: boolean;
  normal?: Vec3;
  label?: string;
  adjacency_degree: number;
  area_mm2?: number;
}

export interface SnapshotEdge {
  id: number;
}

export interface ModelSnapshot {
  entity_count: number;
  face_count: number;
  solid_ids: number[];
  faces: SnapshotFace[];
  edges?: SnapshotEdge[];
  holes: MachiningHole[];
  bounding_box_mm: BoundingBox;
  scale_to_mm: number;
  engine_version: string;
}

export type EditOp =
  | { op: "set_hole_diameter"; surface_id: number; diameter_mm: number }
  | { op: "set_hole_radius"; surface_id: number; radius_mm: number }
  | { op: "offset_planar_faces"; face_ids: number[]; distance_mm: number }
  | { op: "offset_faces"; face_ids: number[]; distance_mm: number }
  | { op: "fillet_edges"; edge_ids: number[]; radius_mm: number }
  | { op: "chamfer_edges"; edge_ids: number[]; distance_mm: number }
  | { op: "boolean_solid"; operation: "union" | "cut" | "intersect"; other_step: string }
  | { op: "translate_solid"; delta_mm: [number, number, number] }
  | { op: "scale_uniform"; factor: number }
  | { op: "latent_edit_intent"; instruction: string; face_ids: number[] };

export interface GeometryMetrics {
  bounding_box_mm: BoundingBox;
  stock_volume_mm3: number;
  entity_count: number;
  face_count: number;
  hole_count: number;
}

export interface BboxDeltaSpec {
  axis: string;
  min_mm: number;
  max_mm: number;
}

export interface VerifySpec {
  bbox_delta_mm?: BboxDeltaSpec;
  volume_delta_pct?: [number, number];
  must_remain_manifold?: boolean;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
}

export interface EditResult {
  success: boolean;
  error?: string;
  ops_applied: EditOp[];
  metrics_before: GeometryMetrics;
  metrics_after: GeometryMetrics;
  verification: VerificationResult;
  snapshot: ModelSnapshot;
  can_undo: boolean;
  can_redo: boolean;
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentProposal {
  plan: string;
  ops: EditOp[];
  verify?: VerifySpec;
  toolCalls?: AgentToolCall[];
  /** Human-readable impact lines (optional, from server) */
  impact?: string[];
}

export interface SuggestedEdit {
  id: string;
  label: string;
  instruction: string;
  reason: string;
}

export interface ClarifyOption {
  id: string;
  label: string;
  instruction: string;
}

export interface ClarifyPrompt {
  question: string;
  options: ClarifyOption[];
}

export interface PartProfileSummary {
  kind: string;
  title: string;
  summary: string;
  hints: string[];
  /** 0–1 classification confidence */
  confidence?: number;
  /** One-line detection rationale */
  insight?: string;
  /** Detected machining features */
  features?: string[];
  /** Edits that work well on this part */
  capabilities?: string[];
}

export interface EditorPreferences {
  units: "mm" | "in";
  defaultOffsetMm: number;
  defaultFilletMm: number;
  defaultHoleDiameterMm: number;
  /** When true, ambiguous hole resize targets all holes */
  preferBatchHoles: boolean;
}

export interface ToolResultSummary {
  name: string;
  summary: string;
}

export interface AgentTurnResponse {
  reply: string;
  proposal: AgentProposal | null;
  profile?: PartProfileSummary;
  suggestions?: SuggestedEdit[];
  clarify?: ClarifyPrompt | null;
  toolResults?: ToolResultSummary[];
  preferences?: EditorPreferences;
  mode?: "ollama" | "openai" | "rules";
  model?: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: AgentProposal;
  clarify?: ClarifyPrompt | null;
  toolResults?: ToolResultSummary[];
}

export interface KernelInfo {
  engine: "brepkit" | "planar_fallback" | "disabled";
  version: string;
  supports_offset_faces: boolean;
  supports_fillet: boolean;
  supports_boolean: boolean;
}

/** @deprecated Use in-WASM brepkit kernel via applyEdits; kept for compatibility */
export interface KernelOffsetResult {
  success: boolean;
  error?: string;
  bytes?: ArrayBuffer;
  engine: "brepkit" | "planar-fallback";
  metrics?: GeometryMetrics;
}

/** @deprecated Renamed to KernelOffsetResult */
export type OcctOffsetResult = KernelOffsetResult;
