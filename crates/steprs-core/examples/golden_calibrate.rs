//! Print manifest JSON entry for a fixture (calibration).
use std::{env, path::PathBuf};

use steprs_core::golden::{hole_metrics, parse_fixture_path};

fn main() {
    let id = env::args()
        .nth(1)
        .expect("usage: golden_calibrate <id> <path.stp>");
    let path: PathBuf = env::args()
        .nth(2)
        .expect("usage: golden_calibrate <id> <path.stp>")
        .into();
    let result = parse_fixture_path(&path);
    let m = hole_metrics(&result.quoting.holes);

    println!("  {{");
    println!("    \"id\": \"{id}\",");
    println!("    \"path\": \"{}\",", path.display());
    println!("    \"tier\": \"strict\",");
    println!(
        "    \"parse_budget_ms\": {:.0},",
        result.stats.parse_duration_ms.ceil() * 2.0
    );
    println!("    \"holes\": {{");
    println!("      \"total\": {},", m.total);
    if m.through > 0 {
        println!("      \"through\": {},", m.through);
    }
    if m.blind_flat > 0 {
        println!("      \"blind_flat\": {},", m.blind_flat);
    }
    if m.blind_drill_point > 0 {
        println!("      \"blind_drill_point\": {},", m.blind_drill_point);
    }
    if m.countersink > 0 {
        println!("      \"countersink\": {},", m.countersink);
    }
    if m.counterbore > 0 {
        println!("      \"counterbore\": {},", m.counterbore);
    }
    if !m.diameters.is_empty() {
        let ds: Vec<String> = m.diameters.iter().map(|d| format!("{d:.2}")).collect();
        println!("      \"unique_diameters_mm\": [{}],", ds.join(", "));
    }
    if m.max_pattern_instances > 1 {
        println!(
            "      \"pattern_instances_min\": {},",
            m.max_pattern_instances
        );
    }
    println!("      \"min_depth_mm\": 0.1");
    println!("    }}");
    println!("  }}");
}
