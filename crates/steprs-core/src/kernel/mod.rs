//! Geometry kernel abstraction — Path B uses brepkit inside steprs-core.

#[cfg(feature = "brepkit-kernel")]
mod mesh;

mod step_faces;

#[cfg(feature = "brepkit-kernel")]
mod brepkit;

use serde::Serialize;

pub use step_faces::{edge_curve_endpoints, shell_face_entity_refs};

#[cfg(feature = "brepkit-kernel")]
pub use brepkit::BooleanOpKind;

/// Active geometry backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KernelEngine {
    Brepkit,
    PlanarFallback,
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
    #[cfg(feature = "brepkit-kernel")]
    Io(brepkit_io::IoError),
    #[cfg(feature = "brepkit-kernel")]
    Offset(brepkit_offset::OffsetError),
    #[cfg(feature = "brepkit-kernel")]
    Operations(brepkit_operations::OperationsError),
    Unavailable(String),
}

impl std::fmt::Display for KernelError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "{msg}"),
            #[cfg(feature = "brepkit-kernel")]
            Self::Io(err) => write!(f, "brepkit io: {err}"),
            #[cfg(feature = "brepkit-kernel")]
            Self::Offset(err) => write!(f, "brepkit offset: {err}"),
            #[cfg(feature = "brepkit-kernel")]
            Self::Operations(err) => write!(f, "brepkit operations: {err}"),
            Self::Unavailable(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<String> for KernelError {
    fn from(value: String) -> Self {
        Self::InvalidInput(value)
    }
}

#[cfg(feature = "brepkit-kernel")]
impl From<brepkit_io::IoError> for KernelError {
    fn from(value: brepkit_io::IoError) -> Self {
        Self::Io(value)
    }
}

#[cfg(feature = "brepkit-kernel")]
impl From<brepkit_offset::OffsetError> for KernelError {
    fn from(value: brepkit_offset::OffsetError) -> Self {
        Self::Offset(value)
    }
}

#[cfg(feature = "brepkit-kernel")]
impl From<brepkit_operations::OperationsError> for KernelError {
    fn from(value: brepkit_operations::OperationsError) -> Self {
        Self::Operations(value)
    }
}

pub fn kernel_info() -> KernelInfo {
    #[cfg(feature = "brepkit-kernel")]
    {
        KernelInfo {
            engine: KernelEngine::Brepkit,
            version: "brepkit-git",
            supports_offset_faces: true,
            supports_fillet: true,
            supports_boolean: true,
        }
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        KernelInfo {
            engine: KernelEngine::Disabled,
            version: "none",
            supports_offset_faces: false,
            supports_fillet: false,
            supports_boolean: false,
        }
    }
}

pub fn offset_faces_step(
    step_text: &str,
    selected_face_ids: &[u32],
    distance_native: f64,
) -> Result<String, KernelError> {
    #[cfg(feature = "brepkit-kernel")]
    {
        brepkit::offset_faces(step_text, selected_face_ids, distance_native)
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        let _ = (step_text, selected_face_ids, distance_native);
        Err(KernelError::Unavailable(
            "brepkit-kernel feature disabled".into(),
        ))
    }
}

pub fn fillet_edges_step(
    step_text: &str,
    edge_ids: &[u32],
    radius_native: f64,
) -> Result<String, KernelError> {
    #[cfg(feature = "brepkit-kernel")]
    {
        brepkit::fillet_edges(step_text, edge_ids, radius_native)
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        let _ = (step_text, edge_ids, radius_native);
        Err(KernelError::Unavailable(
            "brepkit-kernel feature disabled".into(),
        ))
    }
}

pub fn chamfer_edges_step(
    step_text: &str,
    edge_ids: &[u32],
    distance_native: f64,
) -> Result<String, KernelError> {
    #[cfg(feature = "brepkit-kernel")]
    {
        brepkit::chamfer_edges(step_text, edge_ids, distance_native)
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        let _ = (step_text, edge_ids, distance_native);
        Err(KernelError::Unavailable(
            "brepkit-kernel feature disabled".into(),
        ))
    }
}

pub fn boolean_step(
    step_text: &str,
    other_step_text: &str,
    operation: &str,
) -> Result<String, KernelError> {
    #[cfg(feature = "brepkit-kernel")]
    {
        use brepkit::BooleanOpKind;
        let op = match operation {
            "union" => BooleanOpKind::Union,
            "cut" => BooleanOpKind::Cut,
            "intersect" => BooleanOpKind::Intersect,
            other => {
                return Err(KernelError::InvalidInput(format!(
                    "unknown boolean operation: {other}"
                )));
            }
        };
        brepkit::boolean_with_step(step_text, other_step_text, op)
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        let _ = (step_text, other_step_text, operation);
        Err(KernelError::Unavailable(
            "brepkit-kernel feature disabled".into(),
        ))
    }
}

/// Tessellate STEP text for preview using brepkit (NURBS + analytic).
pub fn tessellate_step_preview(
    step_text: &str,
    scale_to_mm: f64,
) -> Result<crate::output::TessellatedMesh, KernelError> {
    #[cfg(feature = "brepkit-kernel")]
    {
        mesh::tessellate_step_preview(step_text, scale_to_mm)
    }
    #[cfg(not(feature = "brepkit-kernel"))]
    {
        let _ = (step_text, scale_to_mm);
        Err(KernelError::Unavailable(
            "brepkit-kernel feature disabled".into(),
        ))
    }
}
