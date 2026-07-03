//! Unified golden validation suite (Gates 1–3).

use std::path::Path;

use steprs_core::golden::{
    default_manifest, hole_metrics, parse_fixture_path, resolve_fixture_path, validate_fixture,
};

fn manifest_dir() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn golden_suite_strict_and_smoke() {
    let manifest = default_manifest();
    assert_eq!(manifest.schema, "steprs.golden/v1");

    let strict: Vec<_> = manifest
        .fixtures
        .iter()
        .filter(|f| f.tier == "strict")
        .collect();
    assert!(
        strict.len() >= 10,
        "expected >=10 strict goldens, got {}",
        strict.len()
    );

    let mut failures = Vec::new();
    for fixture in &manifest.fixtures {
        if fixture.tier == "skip" {
            continue;
        }
        let path = resolve_fixture_path(manifest_dir(), &fixture.path);
        if !path.is_file() {
            failures.push(format!("{} missing fixture {}", fixture.id, path.display()));
            continue;
        }
        let result = parse_fixture_path(&path);
        if let Err(err) = validate_fixture(fixture, &path, &result) {
            failures.push(err);
        }
    }

    if let Some(htc) = &manifest.htc_ap242 {
        let path = resolve_fixture_path(manifest_dir(), &htc.path);
        if htc.status == "required" && !path.is_file() {
            failures.push(format!(
                "required HTC geometry missing at {} — run scripts/build-htc-geometry.sh",
                path.display()
            ));
        } else if path.is_file() {
            if let Some(golden) = &htc.geometry_detection {
                let result = parse_fixture_path(&path);
                let m = hole_metrics(&result.quoting.holes);
                if m.total < golden.total_holes_min || m.total > golden.total_holes_max {
                    failures.push(format!(
                        "htc_ap242 holes {} outside [{}, {}]",
                        m.total, golden.total_holes_min, golden.total_holes_max
                    ));
                }
                let blindish = m.blind_flat + m.blind_drill_point + m.countersink + m.counterbore;
                if blindish < golden.blind_min {
                    failures.push(format!(
                        "htc blind/countersink features {blindish} < {}",
                        golden.blind_min
                    ));
                }
            } else if htc.status == "required" {
                failures.push("htc_ap242 geometry_detection missing — run golden_calibrate".into());
            }
        }
    }

    assert!(
        failures.is_empty(),
        "golden failures:\n{}",
        failures.join("\n")
    );
}

#[test]
fn golden_suite_parse_budget_gate() {
    let manifest = default_manifest();
    for fixture in &manifest.fixtures {
        if fixture.tier == "skip" {
            continue;
        }
        let path = resolve_fixture_path(manifest_dir(), &fixture.path);
        if !path.is_file() {
            continue;
        }
        let result = parse_fixture_path(&path);
        let budget = fixture
            .parse_budget_ms
            .unwrap_or(manifest.gates.parse_budget_ms);
        assert!(
            result.stats.parse_duration_ms <= budget,
            "{} parse {:.0}ms > budget {:.0}ms",
            fixture.id,
            result.stats.parse_duration_ms,
            budget
        );
    }
}

#[test]
fn golden_suite_known_limitations_documented() {
    let manifest = default_manifest();
    assert!(
        !manifest.known_limitations.is_empty(),
        "document known hole-detection limits for prod honesty (Gate 4)"
    );
}

#[test]
fn golden_parity_snapshots_match_native() {
    let manifest = default_manifest();
    let snap_dir = manifest_dir().join("tests/fixtures/golden/snapshots");
    for fixture in &manifest.fixtures {
        if fixture.tier != "strict" {
            continue;
        }
        let path = resolve_fixture_path(manifest_dir(), &fixture.path);
        if !path.is_file() {
            continue;
        }
        let result = parse_fixture_path(&path);
        let snap_path = snap_dir.join(format!("{}.holes.json", fixture.id));
        let live = serde_json::to_string_pretty(&result.quoting.holes).expect("serialize holes");

        if std::env::var("UPDATE_GOLDEN_SNAPSHOTS").is_ok() {
            std::fs::create_dir_all(&snap_dir).expect("snapshots dir");
            std::fs::write(&snap_path, &live).expect("write snapshot");
            continue;
        }

        let expected = std::fs::read_to_string(&snap_path).unwrap_or_else(|_| {
            panic!(
                "missing snapshot {} — run UPDATE_GOLDEN_SNAPSHOTS=1 cargo test golden_parity",
                snap_path.display()
            )
        });
        assert_eq!(
            live, expected,
            "hole snapshot drift for {} (WASM uses same Rust code path)",
            fixture.id
        );
    }
}
