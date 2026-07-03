use std::{env, path::PathBuf};

use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

fn main() {
    let path: PathBuf = env::args()
        .nth(1)
        .expect("usage: parse_step <file.step>")
        .into();

    let bytes = std::fs::read(&path).expect("read file");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let output = run_pipeline(&bytes, ParseOptions::full(), &state, gen, None).expect("parse");
    let q = &output.result.quoting;

    println!("File: {}", path.display());
    println!("Engine: {}", output.result.engine_version);
    println!(
        "Parsed entities: {} / max_id #{}",
        output.result.stats.entity_count, output.result.stats.max_id
    );
    println!(
        "Stages: {}",
        output.result.stats.stages_completed.join(" → ")
    );
    println!(
        "Units: {} (scale_to_mm={}, confidence={:.0}%)",
        q.units.detected_unit,
        q.units.scale_to_mm,
        q.units.confidence * 100.0
    );
    println!(
        "BBox (mm): {:.2} x {:.2} x {:.2}",
        q.bounding_box_mm.dimensions.x,
        q.bounding_box_mm.dimensions.y,
        q.bounding_box_mm.dimensions.z
    );
    println!("Surface area: {:.1} mm²", q.total_surface_area_mm2);
    println!("Stock volume: {:.1} mm³", q.stock_volume_mm3);
    println!("Est. mass (Al): {:.1} g", q.estimated_mass_g);
    println!("Setups: {}", q.setup_count);
    println!("Holes: {}", q.holes.len());
    for h in q.holes.iter().take(8) {
        println!("  #{} {:?} Ø{:.2}mm", h.id, h.kind, h.diameter_mm);
    }
    println!("Fillets: {}", q.fillets.len());
    if let Some(min_tool) = q.min_internal_tool_diameter_mm {
        println!("Min internal tool: Ø{:.2}mm", min_tool);
    }
    println!("Pockets: {}", q.pockets.len());
    println!("Slots: {}", q.slots.len());
    println!(
        "AAG: {} faces, {} adjacency edges, {} manifold ({} concave / {} convex)",
        output.result.aag.face_count,
        output.result.aag.adjacency_edge_count,
        output.result.aag.manifold_edge_count,
        output.result.aag.concave_edge_count,
        output.result.aag.convex_edge_count,
    );
    println!(
        "AAG graph: {} nodes{}",
        output.result.aag.graph.len(),
        if output.result.aag.graph_truncated {
            format!(
                " (truncated from {})",
                output.result.aag.graph_total_faces.unwrap_or(0)
            )
        } else {
            String::new()
        }
    );
    if let Some(mesh) = &output.result.mesh {
        println!(
            "Mesh: {} triangles{}",
            mesh.triangle_count,
            if mesh.truncated { " (truncated)" } else { "" }
        );
    }
    println!(
        "Undercuts: {} (5-axis: {})",
        q.undercuts.len(),
        q.requires_5_axis
    );
}
