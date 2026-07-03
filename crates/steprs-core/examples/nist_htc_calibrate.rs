//! Emit suggested `htc.geometry_detection` JSON for manifest.json calibration.
use std::{env, path::PathBuf};

use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

fn main() {
    let path: PathBuf = env::args()
        .nth(1)
        .expect("usage: nist_htc_calibrate <nist_htc.stp>")
        .into();

    let bytes = std::fs::read(&path).expect("read file");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let result = run_pipeline(&bytes, ParseOptions::quoting_only(), &state, gen, None)
        .expect("parse")
        .result;

    let holes = &result.quoting.holes;
    let through = holes.iter().filter(|h| h.kind == "through").count();
    let blind = holes
        .iter()
        .filter(|h| h.kind == "blind_flat" || h.kind == "blind_drill_point")
        .count();

    let mut diameters: Vec<f64> = holes.iter().map(|h| h.diameter_mm).collect();
    diameters.sort_by(|a, b| a.total_cmp(b));
    diameters.dedup_by(|a, b| (*a - *b).abs() < 0.05);

    let total = holes.len();
    let slack = (total / 10).max(1);

    println!(
        r#"    "total_holes_min": {},
    "total_holes_max": {},
    "through_min": {},
    "blind_min": {},
    "unique_diameter_count_min": {}"#,
        total.saturating_sub(slack),
        total + slack,
        through.saturating_sub(1),
        blind.saturating_sub(1),
        diameters.len().max(1),
    );

    eprintln!("Parsed {} holes from {}", total, path.display());
    for h in holes {
        eprintln!(
            "  #{} {} Ø{:.3}mm depth={:?}",
            h.id, h.kind, h.diameter_mm, h.depth_mm
        );
    }
}
