//! Golden manifest loading and hole-metric validation (tests + examples).

use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::output::MachiningHole;
use crate::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[derive(Debug, Deserialize)]
pub struct GoldenManifest {
    pub schema: String,
    pub gates: GoldenGates,
    pub fixtures: Vec<GoldenFixture>,
    #[serde(default)]
    pub htc_ap242: Option<HtcAp242Fixture>,
    #[serde(default)]
    pub known_limitations: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GoldenGates {
    pub strict_precision_min: f64,
    pub strict_recall_min: f64,
    pub parse_budget_ms: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GoldenFixture {
    pub id: String,
    pub path: String,
    pub tier: String,
    #[serde(default)]
    pub holes: Option<HoleGolden>,
    #[serde(default)]
    pub units: Option<UnitsGolden>,
    #[serde(default)]
    pub bbox: Option<BboxGolden>,
    #[serde(default)]
    pub aag: Option<AagGolden>,
    #[serde(default)]
    pub max_extra_holes: Option<usize>,
    #[serde(default)]
    pub parse_budget_ms: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UnitsGolden {
    pub detected_unit: String,
    pub scale_to_mm: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct BboxGolden {
    pub x_mm: f64,
    pub y_mm: f64,
    pub z_mm: f64,
    pub tolerance_mm: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AagGolden {
    pub concave_edge_count_min: usize,
    pub convex_edge_count_min: usize,
    pub manifold_edge_count_min: usize,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HoleGolden {
    pub total: usize,
    #[serde(default)]
    pub total_min: Option<usize>,
    #[serde(default)]
    pub total_max: Option<usize>,
    #[serde(default)]
    pub through: Option<usize>,
    #[serde(default)]
    pub blind_flat: Option<usize>,
    #[serde(default)]
    pub blind_drill_point: Option<usize>,
    #[serde(default)]
    pub countersink: Option<usize>,
    #[serde(default)]
    pub counterbore: Option<usize>,
    #[serde(default)]
    pub unique_diameters_mm: Vec<f64>,
    #[serde(default)]
    pub min_depth_mm: Option<f64>,
    #[serde(default)]
    pub pattern_instances_min: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct HtcAp242Fixture {
    pub path: String,
    pub status: String,
    #[serde(default)]
    pub geometry_detection: Option<HtcGeometryGolden>,
}

#[derive(Debug, Deserialize)]
pub struct HtcGeometryGolden {
    pub total_holes_min: usize,
    pub total_holes_max: usize,
    pub through_min: usize,
    pub blind_min: usize,
    pub unique_diameter_count_min: usize,
}

#[derive(Debug, Clone)]
pub struct HoleMetrics {
    pub total: usize,
    pub through: usize,
    pub blind_flat: usize,
    pub blind_drill_point: usize,
    pub countersink: usize,
    pub counterbore: usize,
    pub unknown: usize,
    pub diameters: Vec<f64>,
    pub max_pattern_instances: u32,
}

/// Per-hole identity match for Gate 1 scorecard.
#[derive(Debug, Clone, Copy, Default)]
pub struct HoleIdentityScore {
    pub true_positives: usize,
    pub false_positives: usize,
    pub false_negatives: usize,
}

pub fn manifest_from_str(raw: &str) -> GoldenManifest {
    serde_json::from_str(raw).expect("parse golden manifest.json")
}

pub fn default_manifest() -> GoldenManifest {
    manifest_from_str(include_str!("../tests/fixtures/golden/manifest.json"))
}

pub fn resolve_fixture_path(manifest_dir: &Path, rel: &str) -> PathBuf {
    let p = Path::new(rel);
    if p.is_absolute() {
        return p.to_path_buf();
    }
    manifest_dir.join(rel)
}

pub fn parse_fixture_path(path: &Path) -> crate::output::ParseResult {
    let bytes = std::fs::read(path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let state = PipelineState::new();
    let gen = state.begin_parse();
    run_pipeline(&bytes, ParseOptions::quoting_only(), &state, gen, None)
        .unwrap_or_else(|e| panic!("parse {}: {e}", path.display()))
        .result
}

pub fn hole_metrics(holes: &[MachiningHole]) -> HoleMetrics {
    let mut diameters: Vec<f64> = holes.iter().map(|h| h.diameter_mm).collect();
    diameters.sort_by(|a, b| a.total_cmp(b));
    diameters.dedup_by(|a, b| (*a - *b).abs() < 0.05);

    let max_pattern_instances = holes
        .iter()
        .filter_map(|h| h.instance_count)
        .max()
        .unwrap_or(1);

    HoleMetrics {
        total: holes.len(),
        through: holes.iter().filter(|h| h.kind == "through").count(),
        blind_flat: holes.iter().filter(|h| h.kind == "blind_flat").count(),
        blind_drill_point: holes
            .iter()
            .filter(|h| h.kind == "blind_drill_point")
            .count(),
        countersink: holes.iter().filter(|h| h.kind == "countersink").count(),
        counterbore: holes.iter().filter(|h| h.kind == "counterbore").count(),
        unknown: holes.iter().filter(|h| h.kind == "unknown").count(),
        diameters,
        max_pattern_instances,
    }
}

/// Match live holes to expected snapshot holes by diameter, kind, and axis alignment.
pub fn score_hole_identity(
    expected: &[MachiningHole],
    actual: &[MachiningHole],
) -> HoleIdentityScore {
    let mut used = vec![false; actual.len()];
    let mut tp = 0usize;

    for exp in expected {
        let mut matched = false;
        for (i, act) in actual.iter().enumerate() {
            if !used[i] && holes_match_identity(exp, act) {
                used[i] = true;
                tp += 1;
                matched = true;
                break;
            }
        }
        let _ = matched;
    }

    let fp = actual.len().saturating_sub(tp);
    let fn_ = expected.len().saturating_sub(tp);

    HoleIdentityScore {
        true_positives: tp,
        false_positives: fp,
        false_negatives: fn_,
    }
}

fn holes_match_identity(expected: &MachiningHole, actual: &MachiningHole) -> bool {
    if expected.kind != actual.kind {
        return false;
    }
    if (expected.diameter_mm - actual.diameter_mm).abs() > 0.05 {
        return false;
    }
    let dot = expected.axis.x * actual.axis.x
        + expected.axis.y * actual.axis.y
        + expected.axis.z * actual.axis.z;
    dot >= 0.99
}

pub fn validate_fixture(
    fixture: &GoldenFixture,
    _path: &Path,
    result: &crate::output::ParseResult,
) -> Result<(), String> {
    let holes = &result.quoting.holes;
    let m = hole_metrics(holes);

    if let Some(budget) = fixture.parse_budget_ms {
        if result.stats.parse_duration_ms > budget {
            return Err(format!(
                "{} parse {}ms exceeds budget {}ms",
                fixture.id, result.stats.parse_duration_ms, budget
            ));
        }
    }

    if let Some(units) = &fixture.units {
        validate_units(&fixture.id, units, &result.quoting.units)?;
    }

    if let Some(bbox) = &fixture.bbox {
        validate_bbox(
            &fixture.id,
            bbox,
            &result.quoting.part_envelope_mm.dimensions,
        )?;
    }

    if let Some(aag) = &fixture.aag {
        validate_aag(&fixture.id, aag, &result.aag)?;
    }

    let Some(golden) = &fixture.holes else {
        return Ok(());
    };

    match fixture.tier.as_str() {
        "strict" => validate_strict(fixture, golden, holes, &m),
        "smoke" => validate_smoke(fixture, golden, &m),
        "skip" => Ok(()),
        other => Err(format!("{} unknown tier {other}", fixture.id)),
    }
}

fn validate_units(
    id: &str,
    golden: &UnitsGolden,
    actual: &crate::output::UnitMetadata,
) -> Result<(), String> {
    if actual.detected_unit != golden.detected_unit {
        return Err(format!(
            "{id} unit {} != {}",
            actual.detected_unit, golden.detected_unit
        ));
    }
    if (actual.scale_to_mm - golden.scale_to_mm).abs() > f64::EPSILON {
        return Err(format!(
            "{id} scale_to_mm {} != {}",
            actual.scale_to_mm, golden.scale_to_mm
        ));
    }
    Ok(())
}

fn validate_bbox(
    id: &str,
    golden: &BboxGolden,
    actual: &crate::output::Vec3,
) -> Result<(), String> {
    let tol = golden.tolerance_mm;
    for (label, exp, got) in [
        ("x", golden.x_mm, actual.x),
        ("y", golden.y_mm, actual.y),
        ("z", golden.z_mm, actual.z),
    ] {
        if (exp - got).abs() > tol {
            return Err(format!(
                "{id} bbox {label} {got:.2}mm != {exp:.2}mm (tol {tol})"
            ));
        }
    }
    Ok(())
}

fn validate_aag(
    id: &str,
    golden: &AagGolden,
    actual: &crate::output::AagReport,
) -> Result<(), String> {
    if actual.concave_edge_count < golden.concave_edge_count_min {
        return Err(format!(
            "{id} concave edges {} < min {}",
            actual.concave_edge_count, golden.concave_edge_count_min
        ));
    }
    if actual.convex_edge_count < golden.convex_edge_count_min {
        return Err(format!(
            "{id} convex edges {} < min {}",
            actual.convex_edge_count, golden.convex_edge_count_min
        ));
    }
    if actual.manifold_edge_count < golden.manifold_edge_count_min {
        return Err(format!(
            "{id} manifold edges {} < min {}",
            actual.manifold_edge_count, golden.manifold_edge_count_min
        ));
    }
    Ok(())
}

fn validate_strict(
    fixture: &GoldenFixture,
    golden: &HoleGolden,
    holes: &[MachiningHole],
    m: &HoleMetrics,
) -> Result<(), String> {
    let max_extra = fixture.max_extra_holes.unwrap_or(0);
    if m.total > golden.total + max_extra {
        return Err(format!(
            "{} hole count {} > {} + max_extra {}",
            fixture.id, m.total, golden.total, max_extra
        ));
    }
    if m.total < golden.total {
        return Err(format!(
            "{} hole count {} < {}",
            fixture.id, m.total, golden.total
        ));
    }

    assert_kind(&fixture.id, "through", golden.through, m.through)?;
    assert_kind(&fixture.id, "blind_flat", golden.blind_flat, m.blind_flat)?;
    assert_kind(
        &fixture.id,
        "blind_drill_point",
        golden.blind_drill_point,
        m.blind_drill_point,
    )?;
    assert_kind(
        &fixture.id,
        "countersink",
        golden.countersink,
        m.countersink,
    )?;
    assert_kind(
        &fixture.id,
        "counterbore",
        golden.counterbore,
        m.counterbore,
    )?;

    for expected in &golden.unique_diameters_mm {
        if !m.diameters.iter().any(|d| (d - expected).abs() < 0.05) {
            return Err(format!(
                "{} missing diameter {expected} mm in {:?}",
                fixture.id, m.diameters
            ));
        }
    }

    if let Some(min_depth) = golden.min_depth_mm {
        for hole in holes {
            if !matches!(
                hole.kind.as_str(),
                "through" | "blind_flat" | "blind_drill_point"
            ) {
                continue;
            }
            if !hole.depth_mm.is_some_and(|d| d >= min_depth) {
                return Err(format!("{} hole #{} missing depth_mm", fixture.id, hole.id));
            }
            if hole.face_ids.is_empty() {
                return Err(format!("{} hole #{} missing face_ids", fixture.id, hole.id));
            }
        }
    }

    if let Some(min_inst) = golden.pattern_instances_min {
        if m.max_pattern_instances < min_inst {
            return Err(format!(
                "{} pattern instances {} < {min_inst}",
                fixture.id, m.max_pattern_instances
            ));
        }
    }

    Ok(())
}

fn validate_smoke(
    fixture: &GoldenFixture,
    golden: &HoleGolden,
    m: &HoleMetrics,
) -> Result<(), String> {
    let min = golden.total_min.unwrap_or(golden.total);
    let max = golden.total_max.unwrap_or(golden.total);
    let max_extra = fixture.max_extra_holes.unwrap_or(0);
    let upper = max + max_extra;
    if m.total < min || m.total > upper {
        return Err(format!(
            "{} hole count {} outside [{min}, {upper}]",
            fixture.id, m.total
        ));
    }
    Ok(())
}

fn assert_kind(id: &str, name: &str, expected: Option<usize>, actual: usize) -> Result<(), String> {
    if let Some(exp) = expected {
        if actual != exp {
            return Err(format!("{id} {name} {actual} != {exp}"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::output::Vec3;

    fn sample_hole(id: u32, kind: &str, dia: f64) -> MachiningHole {
        MachiningHole {
            id,
            kind: kind.into(),
            radius_mm: dia / 2.0,
            diameter_mm: dia,
            origin: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
            axis: Vec3 {
                x: 0.0,
                y: 0.0,
                z: 1.0,
            },
            depth_mm: Some(5.0),
            face_ids: vec![1],
            counterbore_diameter_mm: None,
            instance_count: None,
            detection_source: "geometry".into(),
        }
    }

    #[test]
    fn hole_identity_exact_match() {
        let expected = vec![
            sample_hole(1, "through", 3.2),
            sample_hole(2, "blind_flat", 6.0),
        ];
        let actual = expected.clone();
        let score = score_hole_identity(&expected, &actual);
        assert_eq!(score.true_positives, 2);
        assert_eq!(score.false_positives, 0);
        assert_eq!(score.false_negatives, 0);
    }

    #[test]
    fn hole_identity_counts_false_positive() {
        let expected = vec![sample_hole(1, "through", 3.2)];
        let mut actual = expected.clone();
        actual.push(sample_hole(2, "through", 8.0));
        let score = score_hole_identity(&expected, &actual);
        assert_eq!(score.true_positives, 1);
        assert_eq!(score.false_positives, 1);
        assert_eq!(score.false_negatives, 0);
    }
}
