//! Batch validation — runs the full pipeline on every fixture (mirrors ~/Downloads set).

use std::path::Path;

use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

fn fixture_dir() -> &'static Path {
    Path::new("tests/fixtures/prismatic")
}

#[test]
fn batch_all_prismatic_fixtures() {
    let entries: Vec<_> = std::fs::read_dir(fixture_dir())
        .expect("prismatic dir")
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "step")
                .unwrap_or(false)
        })
        .collect();

    assert_eq!(entries.len(), 13);

    let state = PipelineState::new();
    let mut failures = Vec::new();

    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        let bytes = std::fs::read(entry.path()).unwrap();
        let gen = state.begin_parse();
        let output = run_pipeline(&bytes, ParseOptions::full(), &state, gen, None);

        match output {
            Ok(out) => {
                let r = &out.result;
                let q = &r.quoting;
                let d = &q.bounding_box_mm.dimensions;
                if r.stats.entity_count == 0 {
                    failures.push(format!("{name}: zero entities"));
                } else if d.x <= 0.0 && d.y <= 0.0 && d.z <= 0.0 {
                    failures.push(format!("{name}: zero bbox"));
                } else if r.aag.face_count == 0 {
                    failures.push(format!("{name}: zero AAG faces"));
                } else if r.stats.stages_completed.len() < 6 {
                    failures.push(format!("{name}: incomplete pipeline stages"));
                }
            }
            Err(e) => failures.push(format!("{name}: {e}")),
        }
    }

    assert!(
        failures.is_empty(),
        "batch failures:\n{}",
        failures.join("\n")
    );
}

/// Set `STEPRS_DOWNLOADS_DIR=~/Downloads` locally to re-run against live Downloads copies.
#[test]
fn batch_downloads_dir_when_configured() {
    let Some(dir) = std::env::var_os("STEPRS_DOWNLOADS_DIR") else {
        return;
    };

    let path = Path::new(&dir);
    if !path.is_dir() {
        return;
    }

    let state = PipelineState::new();
    let mut count = 0usize;

    for entry in std::fs::read_dir(path).unwrap().flatten() {
        let p = entry.path();
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case("step") && !ext.eq_ignore_ascii_case("stp") {
            continue;
        }

        count += 1;
        let bytes = std::fs::read(&p).unwrap();
        let gen = state.begin_parse();
        run_pipeline(&bytes, ParseOptions::full(), &state, gen, None)
            .unwrap_or_else(|e| panic!("{}: {e}", p.display()));
    }

    assert!(
        count >= 13,
        "expected at least 13 STEP files in {dir:?}, found {count}"
    );
}
