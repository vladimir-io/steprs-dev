//! Shared engine constants — single source of truth.

pub const DENSITY_THRESHOLD: f64 = 0.5;
pub const MAX_MESH_TRIANGLES: usize = 48_000;
pub const POINT_QUANTIZE_SCALE: f64 = 1_000_000.0;
pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const STAGE_PRESCAN: &str = "L0 prescan";
pub const STAGE_PARSE: &str = "L1 parse";
pub const STAGE_TOPOLOGY: &str = "L3 topology";
pub const STAGE_QUOTING: &str = "L4 part metrics";
pub const STAGE_AAG: &str = "L6 aag";
pub const STAGE_MESH: &str = "L7 mesh";
pub const STAGE_LABELS: &str = "L8 labels";
