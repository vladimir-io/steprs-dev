//! Geometry kernel abstraction — parse-only in the public open-core repository.
//! B-rep edit operations live in the proprietary editor crate (private repo).

mod step_faces;

pub use step_faces::{edge_curve_endpoints, shell_face_entity_refs};

use serde::Serialize;

/// Active geometry backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KernelEngine {
    Disabled,
}

/// Runtime kernel capabilities exposed to WASM / agents.
#[derive(Debug, Clone, Serialize)]
pub struct KernelInfo {
    pub engine: KernelEngine,
    pub version: &'static str,
    pub supports_offset_faces: bool,
    pub supports_fillet: bool,
    pub supports_boolean: bool,
}

#[derive(Debug)]
pub enum KernelError {
    InvalidInput(String),
    Unavailable(String),
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "{msg}"),
            Self::Unavailable(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<String> for KernelError {
    fn from(value: String) -> Self {
        Self::InvalidInput(value)
    }
}

pub fn kernel_info() -> KernelInfo {
    KernelInfo {
        engine: KernelEngine::Disabled,
        version: "none",
        supports_offset_faces: false,
        supports_fillet: false,
        supports_boolean: false,
    }
}

pub fn offset_faces_step(
    step_text: &str,
    selected_face_ids: &[u32],
    distance_native: f64,
) -> Result<String, KernelError> {
    let _ = (step_text, selected_face_ids, distance_native);
    Err(KernelError::Unavailable(
        "geometry kernel not available in open-core build".into(),
    ))
}

pub fn fillet_edges_step(
    step_text: &str,
    edge_ids: &[u32],
    radius_native: f64,
) -> Result<String, KernelError> {
    let _ = (step_text, edge_ids, radius_native);
    Err(KernelError::Unavailable(
        "geometry kernel not available in open-core build".into(),
    ))
}

pub fn chamfer_edges_step(
    step_text: &str,
    edge_ids: &[u32],
    distance_native: f64,
) -> Result<String, KernelError> {
    let _ = (step_text, edge_ids, distance_native);
    Err(KernelError::Unavailable(
        "geometry kernel not available in open-core build".into(),
    ))
}

pub fn boolean_step(
    step_text: &str,
    other_step_text: &str,
    operation: &str,
) -> Result<String, KernelError> {
    let _ = (step_text, other_step_text, operation);
    Err(KernelError::Unavailable(
        "geometry kernel not available in open-core build".into(),
    ))
}

pub fn tessellate_step_preview(
    step_text: &str,
    scale_to_mm: f64,
) -> Result<crate::output::TessellatedMesh, KernelError> {
    let _ = (step_text, scale_to_mm);
    Err(KernelError::Unavailable(
        "geometry kernel not available in open-core build".into(),
    ))
}
