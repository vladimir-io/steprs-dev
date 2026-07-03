//! Gate 1 scorecard — per-hole identity precision/recall on strict tier.
use std::path::Path;

use steprs_core::golden::{
    default_manifest, hole_metrics, parse_fixture_path, resolve_fixture_path, score_hole_identity,
};
use steprs_core::output::MachiningHole;

fn load_snapshot_holes(base: &Path, id: &str) -> Vec<MachiningHole> {
    let path = base.join(format!("tests/fixtures/golden/snapshots/{id}.holes.json"));
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read snapshot {}: {e}", path.display()));
    serde_json::from_str(&raw).expect("parse hole snapshot")
}

fn main() {
    let manifest = default_manifest();
    let base = Path::new(env!("CARGO_MANIFEST_DIR"));
    let strict: Vec<_> = manifest
        .fixtures
        .iter()
        .filter(|f| f.tier == "strict")
        .collect();

    let mut tp = 0usize;
    let mut fp = 0usize;
    let mut fn_ = 0usize;
    let mut parse_ms = Vec::new();

    println!("steprs golden scorecard (strict tier, n={})", strict.len());
    println!("{:-<80}", "");
    println!(
        "{:<22} {:>6} {:>6} {:>6} {:>6} {:>10}",
        "fixture", "exp", "act", "tp", "fp/fn", "parse_ms"
    );

    for fixture in &strict {
        let path = resolve_fixture_path(base, &fixture.path);
        let result = parse_fixture_path(&path);
        let actual = &result.quoting.holes;
        let m = hole_metrics(actual);
        let exp_total = fixture.holes.as_ref().map(|h| h.total).unwrap_or(0);

        let snap_path = base.join(format!(
            "tests/fixtures/golden/snapshots/{}.holes.json",
            fixture.id
        ));
        let (line_tp, line_fp, line_fn) = if snap_path.is_file() {
            let expected = load_snapshot_holes(base, &fixture.id);
            let score = score_hole_identity(&expected, actual);
            tp += score.true_positives;
            fp += score.false_positives;
            fn_ += score.false_negatives;
            (
                score.true_positives,
                score.false_positives,
                score.false_negatives,
            )
        } else {
            println!(
                "  warning: no snapshot for {}, skipping identity",
                fixture.id
            );
            (0, 0, 0)
        };

        parse_ms.push(result.stats.parse_duration_ms);
        println!(
            "{:<22} {:>6} {:>6} {:>6} {:>3}/{:<2} {:>10.0}",
            fixture.id,
            exp_total,
            m.total,
            line_tp,
            line_fp,
            line_fn,
            result.stats.parse_duration_ms
        );
    }

    let precision = tp as f64 / (tp + fp).max(1) as f64;
    let recall = tp as f64 / (tp + fn_).max(1) as f64;
    parse_ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p50 = parse_ms[parse_ms.len() / 2];
    let p95_idx =
        ((parse_ms.len() as f64 * 0.95).floor() as usize).min(parse_ms.len().saturating_sub(1));
    let p95 = parse_ms[p95_idx];

    println!("{:-<80}", "");
    println!(
        "hole_identity precision: {precision:.3} (gate >= {})",
        manifest.gates.strict_precision_min
    );
    println!(
        "hole_identity recall:    {recall:.3} (gate >= {})",
        manifest.gates.strict_recall_min
    );
    println!("parse_ms p50: {p50:.0}  p95: {p95:.0}");

    if precision < manifest.gates.strict_precision_min || recall < manifest.gates.strict_recall_min
    {
        std::process::exit(1);
    }
}
