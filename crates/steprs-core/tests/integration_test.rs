use steprs_core::arena::Arena;
use steprs_core::parser::{ingest_step, prescan_ids};
use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[test]
fn parses_simple_cube_fixture() {
    let bytes = include_bytes!("fixtures/simple_cube.step");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let output = run_pipeline(bytes, ParseOptions::full(), &state, gen, None).unwrap();

    assert!(output.result.stats.entity_count > 0);
    assert!(output.result.quoting.stock_volume_mm3 >= 0.0);
    assert!(!output.result.stats.stages_completed.is_empty());
}

#[test]
fn sparse_fixture_uses_sparse_storage() {
    let input = b"DATA;\n#1=FOO();\n#500000=BAR();";
    let prescan = prescan_ids(input).unwrap();
    let arena = Arena::from_prescan(&prescan);
    assert_eq!(prescan.storage_mode_label(), "sparse");
    assert_eq!(arena.mode(), steprs_core::arena::StorageMode::Sparse);
}

#[test]
fn single_pass_ingest_matches_prescan() {
    let bytes = include_bytes!("fixtures/simple_cube.step");
    let (_, _, prescan, _) = ingest_step(bytes).unwrap();
    let prescan_only = prescan_ids(bytes).unwrap();
    assert_eq!(prescan.entity_count, prescan_only.entity_count);
    assert_eq!(prescan.max_id, prescan_only.max_id);
}

fn parse_fixture(name: &str) -> steprs_core::output::ParseResult {
    let path = format!("tests/fixtures/prismatic/{name}");
    let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("read {name}: {e}"));
    let state = PipelineState::new();
    let gen = state.begin_parse();
    run_pipeline(&bytes, ParseOptions::full(), &state, gen, None)
        .unwrap_or_else(|e| panic!("parse {name}: {e}"))
        .result
}

#[test]
fn prismatic_part_00130561() {
    let result = parse_fixture("00130561_aff03b1e1a83b6df44d92a27_step_001.step");
    let q = &result.quoting;
    assert!(result.stats.entity_count > 100);
    assert!(q.bounding_box_mm.dimensions.x > 0.0);
    assert!(q.total_surface_area_mm2 > 0.0);
    assert!(q.stock_volume_mm3 > 0.0);
    assert!(result.mesh.is_some());
    assert!(!result.labels.face_classifications.is_empty());
}

#[test]
fn prismatic_part_00134379() {
    let result = parse_fixture("00134379_5714d79fe4b038a63195ab5e_step_003.step");
    let q = &result.quoting;
    assert!(result.stats.entity_count > 500);
    assert!(!q.holes.is_empty());
    assert_eq!(q.units.detected_unit, "metre");
    assert!((q.units.scale_to_mm - 1000.0).abs() < f64::EPSILON);
    assert!(result.aag.face_count > 0);
}

#[test]
fn prismatic_part_00256166() {
    let q = &parse_fixture("00256166_93b6ae2b148e2061c296529a_step_000.step").quoting;
    assert!(q.bounding_box_mm.dimensions.z > 0.0);
    assert!(q.setup_count >= 1);
}

#[test]
fn all_prismatic_fixtures_parse() {
    let entries = std::fs::read_dir("tests/fixtures/prismatic")
        .expect("prismatic fixtures dir")
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "step")
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    assert_eq!(entries.len(), 13, "expected 13 prismatic STEP fixtures");

    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        let result = parse_fixture(&name);
        assert!(result.stats.entity_count > 0, "{name}: no entities parsed");
        assert!(
            result.quoting.bounding_box_mm.dimensions.x > 0.0
                || result.quoting.bounding_box_mm.dimensions.y > 0.0
                || result.quoting.bounding_box_mm.dimensions.z > 0.0,
            "{name}: zero bbox"
        );
    }
}

#[test]
fn golden_00134379_core_metrics() {
    let result = parse_fixture("00134379_5714d79fe4b038a63195ab5e_step_003.step");
    let q = &result.quoting;

    assert_eq!(result.engine_version, env!("CARGO_PKG_VERSION"));
    assert_eq!(q.holes.len(), 26, "expected 26 holes on prismatic 00134379");
    assert!(q.fillets.len() >= 10);
    assert!(q.pockets.len() >= 1);
    assert!(result.aag.adjacency_edge_count > 0);
    assert!(result.stats.stages_completed.len() >= 6);
}

#[test]
fn spur_gear_filters_tooth_root_holes() {
    let path = "tests/fixtures/spur-M0.5-T10-steel.step";
    let bytes = std::fs::read(path).expect("read spur gear fixture");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let result = run_pipeline(&bytes, ParseOptions::full(), &state, gen, None)
        .expect("parse spur gear")
        .result;
    let q = &result.quoting;

    assert_eq!(
        q.holes.len(),
        1,
        "tooth-root cylinders should collapse to bore"
    );
    let mn = q
        .part_envelope_mm
        .dimensions
        .x
        .min(q.part_envelope_mm.dimensions.y)
        .min(q.part_envelope_mm.dimensions.z);
    let mx = q
        .part_envelope_mm
        .dimensions
        .x
        .max(q.part_envelope_mm.dimensions.y)
        .max(q.part_envelope_mm.dimensions.z);
    assert!(
        mn / mx < 0.55,
        "spur gear fixture should be disc-like for filter heuristics (ratio {:.2})",
        mn / mx
    );
}

#[test]
fn nist_ctc_01_fixture_has_aag_edges_and_bores() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/nist/ftc/nist_ctc_01_asme1_rd.stp"
    );
    let bytes = std::fs::read(path).expect("read hole-plate.stp");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let output = run_pipeline(&bytes, ParseOptions::full(), &state, gen, None).expect("parse");
    let aag = &output.result.aag;
    let q = &output.result.quoting;

    assert_eq!(aag.face_count, 139, "expected NIST hole plate face count");
    assert!(
        aag.manifold_edge_count >= 100,
        "hole plate should have rich manifold edges, got {}",
        aag.manifold_edge_count
    );
    assert!(
        aag.concave_edge_count + aag.convex_edge_count >= 50,
        "expected classified concave/convex edges"
    );
    assert_eq!(aag.graph.len(), 139);
    assert_eq!(q.holes.len(), 10, "NIST hole plate has 10 standard bores");
    for hole in &q.holes {
        assert!(
            !hole.face_ids.is_empty(),
            "hole #{} should map to AdvancedFace ids",
            hole.id
        );
    }
}
