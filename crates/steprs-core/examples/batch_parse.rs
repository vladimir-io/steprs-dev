use std::{env, path::PathBuf, time::Instant};

use steprs_core::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[derive(Default)]
struct BatchSummary {
    ok: usize,
    failed: usize,
}

fn main() {
    let dir: PathBuf = env::args()
        .nth(1)
        .expect("usage: batch_parse <directory>")
        .into();

    let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("read dir {}: {e}", dir.display()))
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("step") || e.eq_ignore_ascii_case("stp"))
                .unwrap_or(false)
        })
        .collect();

    files.sort();

    if files.is_empty() {
        eprintln!("No .step/.stp files in {}", dir.display());
        std::process::exit(1);
    }

    println!(
        "steprs batch parse · {} files · engine v{}\n",
        files.len(),
        env!("CARGO_PKG_VERSION")
    );
    println!(
        "{:<52} {:>8} {:>8} {:>6} {:>6} {:>7} {:>6} {:>5}",
        "file", "entities", "max_id", "holes", "pocket", "faces", "ms", "ok"
    );
    println!("{}", "-".repeat(110));

    let mut summary = BatchSummary::default();
    let state = PipelineState::new();

    for path in files {
        let name = path.file_name().unwrap().to_string_lossy();
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(_e) => {
                println!(
                    "{name:<52} {:>8} {:>8} {:>6} {:>6} {:>7} {:>6} {:>5}",
                    "-", "-", "-", "-", "-", "-", "READ"
                );
                summary.failed += 1;
                continue;
            }
        };

        let gen = state.begin_parse();
        let start = Instant::now();
        let outcome = run_pipeline(&bytes, ParseOptions::full(), &state, gen, None);
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;

        match outcome {
            Ok(output) => {
                let r = &output.result;
                let q = &r.quoting;
                let bbox = &q.bounding_box_mm.dimensions;
                let zero_bbox =
                    bbox.x <= 0.0 && bbox.y <= 0.0 && bbox.z <= 0.0 && r.stats.entity_count > 0;

                let status = if zero_bbox { "BBOX?" } else { "OK" };
                if zero_bbox {
                    summary.failed += 1;
                } else {
                    summary.ok += 1;
                }

                println!(
                    "{name:<52} {:>8} {:>8} {:>6} {:>6} {:>7} {:>6.0} {:>5}",
                    r.stats.entity_count,
                    r.stats.max_id,
                    q.holes.len(),
                    q.pockets.len(),
                    r.aag.face_count,
                    r.stats.parse_duration_ms.max(elapsed),
                    status
                );
            }
            Err(e) => {
                println!(
                    "{name:<52} {:>8} {:>8} {:>6} {:>6} {:>7} {:>6.0} {:>5}",
                    "-", "-", "-", "-", "-", elapsed, "FAIL"
                );
                eprintln!("  error: {e}");
                summary.failed += 1;
            }
        }
    }

    println!("{}", "-".repeat(110));
    println!("passed: {} · failed: {}", summary.ok, summary.failed);

    if summary.failed > 0 {
        std::process::exit(1);
    }
}
