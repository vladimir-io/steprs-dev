//! Diagnostic: which Benchy cylinders fail rim confirmation (run with --ignored).
use steprs_core::arena::Arena;
use steprs_core::entity::StepEntity;
use steprs_core::parser::{ingest_step, parse_entities};
use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};
use steprs_core::resolver::{
    collect_bound_loop_points, collect_circle_radii_from_edge_loop,
    cylindrical_surface_is_confirmed_bore,
};

#[test]
#[ignore]
fn benchy_bore_confirmation_audit() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../apps/web/public/fixtures/benchy.stp"
    );
    let bytes = std::fs::read(path).expect("read benchy");
    let (_, _, prescan, _) = ingest_step(&bytes).unwrap();
    let mut arena = Arena::from_prescan(&prescan);
    parse_entities(&bytes, &mut arena).unwrap();

    let state = PipelineState::new();
    let gen = state.begin_parse();
    let result = run_pipeline(&bytes, ParseOptions::quoting_only(), &state, gen, None)
        .unwrap()
        .result;
    println!("final holes: {}", result.quoting.holes.len());

    for (id, entity) in arena.iter() {
        let StepEntity::CylindricalSurface { radius, .. } = entity else {
            continue;
        };
        let has_face = arena.iter().any(|(_, e)| {
            matches!(e, StepEntity::AdvancedFace { face_geometry, .. } if *face_geometry == id)
        });
        if !has_face {
            continue;
        }
        let confirmed = cylindrical_surface_is_confirmed_bore(&arena, id);
        if confirmed {
            continue;
        }
        println!("\n#{} surface_r={:.4} NOT confirmed", id, radius);
        for (_, e) in arena.iter() {
            let StepEntity::AdvancedFace {
                bounds,
                face_geometry,
                ..
            } = e
            else {
                continue;
            };
            if *face_geometry != id {
                continue;
            }
            for bound_id in bounds {
                let Some(StepEntity::FaceBound { bound, .. }) = arena.get(*bound_id) else {
                    continue;
                };
                let rims = collect_circle_radii_from_edge_loop(&arena, *bound);
                let mut pts = Vec::new();
                collect_bound_loop_points(&arena, *bound, &mut pts);
                println!(
                    "  bound #{bound_id} circle_rims={rims:?} loop_pts={}",
                    pts.len()
                );
            }
        }
    }
}
