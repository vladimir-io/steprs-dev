use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[test]
fn benchy_reports_six_machining_holes() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/web/public/fixtures/benchy.stp"
    );
    let bytes = std::fs::read(path).expect("read benchy");
    let state = PipelineState::new();
    let gen = state.begin_parse();
    let result = run_pipeline(&bytes, ParseOptions::quoting_only(), &state, gen, None)
        .expect("parse benchy")
        .result;

    let holes = &result.quoting.holes;
    let through = holes.iter().filter(|h| h.kind == "through").count();
    let blind = holes
        .iter()
        .filter(|h| h.kind == "blind_flat" || h.kind == "blind_drill_point")
        .count();

    assert_eq!(
        holes.len(),
        6,
        "Benchy should report 6 machining holes, got {:?}",
        holes
            .iter()
            .map(|h| (h.id, h.kind.as_str(), h.diameter_mm))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        through,
        3,
        "Benchy should report 3 through holes, got {through}: {:?}",
        holes
            .iter()
            .filter(|h| h.kind == "through")
            .map(|h| (h.id, h.diameter_mm))
            .collect::<Vec<_>>()
    );
    assert_eq!(
        blind,
        3,
        "Benchy should report 3 blind holes, got {blind}: {:?}",
        holes
            .iter()
            .filter(|h| h.kind != "through")
            .map(|h| (h.id, h.kind.as_str(), h.diameter_mm))
            .collect::<Vec<_>>()
    );

    for hole in holes {
        assert!(
            hole.depth_mm.is_some_and(|d| d > 0.0),
            "hole #{} should have depth_mm",
            hole.id
        );
        assert!(
            !hole.face_ids.is_empty(),
            "hole #{} should map to AdvancedFace ids",
            hole.id
        );
    }

    let q = &result.quoting;
    let env = &q.part_envelope_mm.dimensions;
    assert!(
        env.x >= 55.0
            && env.x <= 65.0
            && env.y >= 28.0
            && env.y <= 38.0
            && env.z >= 35.0
            && env.z <= 52.0,
        "Benchy envelope {:?} mm — expected ~60×32×48",
        env
    );
    assert_eq!(
        q.setup_count, 2,
        "Benchy 3-axis setup estimate should be 2 (flip), got {}",
        q.setup_count
    );
    assert!(
        q.total_surface_area_mm2 < 50_000.0,
        "surface area should be envelope-scale, got {}",
        q.total_surface_area_mm2
    );
}
