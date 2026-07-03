//! Print manifest extension fields for a fixture (units, bbox, aag).
use std::env;

use steprs_core::golden::{default_manifest, parse_fixture_path, resolve_fixture_path};

fn main() {
    let id = env::args()
        .nth(1)
        .expect("usage: golden_inspect <fixture_id>");
    let manifest = default_manifest();
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let fixture = manifest
        .fixtures
        .iter()
        .find(|f| f.id == id)
        .unwrap_or_else(|| panic!("unknown fixture {id}"));
    let path = resolve_fixture_path(base, &fixture.path);
    let result = parse_fixture_path(&path);
    let q = &result.quoting;
    let aag = &result.aag;
    let d = &q.part_envelope_mm.dimensions;

    println!("\"units\": {{");
    println!("  \"detected_unit\": \"{}\",", q.units.detected_unit);
    println!("  \"scale_to_mm\": {}", q.units.scale_to_mm);
    println!("}},");
    println!("\"bbox\": {{");
    println!("  \"x_mm\": {:.2},", d.x);
    println!("  \"y_mm\": {:.2},", d.y);
    println!("  \"z_mm\": {:.2},", d.z);
    println!("  \"tolerance_mm\": 2.0");
    println!("}},");
    println!("\"aag\": {{");
    println!("  \"concave_edge_count_min\": {},", aag.concave_edge_count);
    println!("  \"convex_edge_count_min\": {},", aag.convex_edge_count);
    println!("  \"manifold_edge_count_min\": {}", aag.manifold_edge_count);
    println!("}}");
}
