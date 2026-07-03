//! Emit JSON Schema for the stable ParseResult contract.
use std::io::Write;

use schemars::schema_for;
use steprs_core::output::{MachiningHole, ParseResult, ParseStats, QuotingReport};

fn main() {
    let schema = schema_for!(ParseResult);
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/ts-types/parse-result.schema.json");
    let json = serde_json::to_string_pretty(&schema).expect("serialize schema");
    let mut file = std::fs::File::create(&path).expect("create schema file");
    file.write_all(json.as_bytes()).expect("write schema");
    println!("Wrote {}", path.display());

    // Spot-check nested types used in CI drift detection.
    let _ = schema_for!(ParseStats);
    let _ = schema_for!(MachiningHole);
    let _ = schema_for!(QuotingReport);
}
