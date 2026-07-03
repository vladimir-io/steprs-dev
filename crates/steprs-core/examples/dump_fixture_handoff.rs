//! Emit Steprs API handoff JSON for bundled web fixtures (no mesh).
//!
//! ```bash
//! cargo run --example dump_fixture_handoff --manifest-path crates/steprs-core/Cargo.toml
//! ```

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[derive(Serialize)]
struct FixtureHandoffFile {
    api_version: &'static str,
    fixture_id: String,
    file_name: String,
    label: String,
    generated_at: String,
    parse: SlimParse,
}

#[derive(Serialize)]
struct SlimParse {
    engine_version: String,
    stats: steprs_core::output::ParseStats,
    quoting: steprs_core::output::QuotingReport,
    aag: steprs_core::output::AagReport,
}

fn main() {
    let out_dir =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/data/api/v1/fixtures");
    fs::create_dir_all(&out_dir).expect("create output dir");

    let fixtures = [
        (
            "hole-plate",
            "hole-plate.stp",
            "NIST Hole Plate",
            "apps/web/public/fixtures/hole-plate.stp",
        ),
        (
            "mounting-plate",
            "mounting-plate.step",
            "Machined Mounting Plate",
            "apps/web/public/fixtures/mounting-plate.step",
        ),
        (
            "machined-bracket",
            "machined-bracket.step",
            "3-Axis Mounting Bracket",
            "apps/web/public/fixtures/machined-bracket.step",
        ),
    ];

    for (id, file_name, label, rel_path) in fixtures {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join(rel_path);
        let bytes = fs::read(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        let state = PipelineState::new();
        let gen = state.begin_parse();
        let output = run_pipeline(
            &bytes,
            ParseOptions {
                include_mesh: false,
                include_labels: false,
            },
            &state,
            gen,
            None,
        )
        .unwrap_or_else(|e| panic!("parse {id}: {e}"));

        let file = FixtureHandoffFile {
            api_version: "1",
            fixture_id: id.into(),
            file_name: file_name.into(),
            label: label.into(),
            generated_at: chrono_lite_now(),
            parse: SlimParse {
                engine_version: output.result.engine_version.clone(),
                stats: output.result.stats.clone(),
                quoting: output.result.quoting.clone(),
                aag: output.result.aag.clone(),
            },
        };

        let out_path = out_dir.join(format!("{id}.json"));
        let json = serde_json::to_string_pretty(&file).expect("serialize");
        fs::write(&out_path, json).expect("write");
        eprintln!(
            "wrote {} — {} faces, {} holes, graph {} nodes",
            out_path.display(),
            file.parse.aag.face_count,
            file.parse.quoting.holes.len(),
            file.parse.aag.graph.len()
        );
    }
}

fn chrono_lite_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}
