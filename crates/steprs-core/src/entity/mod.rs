#[derive(Debug, Clone, PartialEq)]
pub enum StepEntity {
    CartesianPoint {
        x: f64,
        y: f64,
        z: f64,
    },
    Direction {
        x: f64,
        y: f64,
        z: f64,
    },
    Axis2Placement3d {
        location: u32,
        axis: u32,
        ref_direction: u32,
    },
    Plane {
        placement: u32,
    },
    CylindricalSurface {
        name: Option<String>,
        placement: u32,
        radius: f64,
    },
    ConicalSurface {
        placement: u32,
        radius: f64,
        semi_angle: f64,
    },
    ToroidalSurface {
        placement: u32,
        major_radius: f64,
        minor_radius: f64,
    },
    AdvancedFace {
        bounds: Vec<u32>,
        face_geometry: u32,
        same_sense: bool,
    },
    FaceBound {
        bound: u32,
        orientation: bool,
    },
    EdgeLoop {
        edges: Vec<u32>,
    },
    OrientedEdge {
        edge_element: u32,
        orientation: bool,
    },
    VertexPoint {
        vertex_geometry: u32,
    },
    Circle {
        placement: u32,
        radius: f64,
    },
    Ellipse {
        placement: u32,
        semi_axis1: f64,
        semi_axis2: f64,
    },
    Vector {
        direction: u32,
        magnitude: f64,
    },
    EdgeCurve {
        edge_start: u32,
        edge_end: u32,
        edge_geometry: u32,
        same_sense: bool,
    },
    ClosedShell {
        faces: Vec<u32>,
    },
    ManifoldSolidBrep {
        outer: u32,
    },
    Line {
        cartesian_point: u32,
        vector: u32,
    },
    Unknown {
        type_name: String,
        refs: Vec<u32>,
        numbers: Vec<f64>,
        /// Original STEP record text for lossless round-trip.
        raw_line: Option<String>,
    },
}

impl StepEntity {
    pub fn type_name(&self) -> &str {
        match self {
            StepEntity::CartesianPoint { .. } => "CARTESIAN_POINT",
            StepEntity::Direction { .. } => "DIRECTION",
            StepEntity::Axis2Placement3d { .. } => "AXIS2_PLACEMENT_3D",
            StepEntity::Plane { .. } => "PLANE",
            StepEntity::CylindricalSurface { .. } => "CYLINDRICAL_SURFACE",
            StepEntity::ConicalSurface { .. } => "CONICAL_SURFACE",
            StepEntity::ToroidalSurface { .. } => "TOROIDAL_SURFACE",
            StepEntity::AdvancedFace { .. } => "ADVANCED_FACE",
            StepEntity::FaceBound { .. } => "FACE_BOUND",
            StepEntity::EdgeLoop { .. } => "EDGE_LOOP",
            StepEntity::OrientedEdge { .. } => "ORIENTED_EDGE",
            StepEntity::VertexPoint { .. } => "VERTEX_POINT",
            StepEntity::Circle { .. } => "CIRCLE",
            StepEntity::Ellipse { .. } => "ELLIPSE",
            StepEntity::Vector { .. } => "VECTOR",
            StepEntity::EdgeCurve { .. } => "EDGE_CURVE",
            StepEntity::ClosedShell { .. } => "CLOSED_SHELL",
            StepEntity::ManifoldSolidBrep { .. } => "MANIFOLD_SOLID_BREP",
            StepEntity::Line { .. } => "LINE",
            StepEntity::Unknown { type_name, .. } => type_name,
        }
    }
}
