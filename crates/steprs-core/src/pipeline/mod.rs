use std::cell::Cell;

use crate::arena::Arena;
use crate::core::{
    ENGINE_VERSION, STAGE_AAG, STAGE_LABELS, STAGE_MESH, STAGE_PARSE, STAGE_PRESCAN, STAGE_QUOTING,
    STAGE_TOPOLOGY,
};
use crate::error::ParseError;
use crate::features::{classify_face_labels, tessellate_mesh};
use crate::features::{compute_type_breakdown, extract_bounding_box, extract_quoting_report};
use crate::output::{BoundingBox, ParseResult, ParseStats, Vec3};
use crate::parser::{ingest_step, prescan_ids, PrescanResult};
use crate::topology::TopologyIndex;

#[derive(Debug, Clone, Copy, Default)]
pub struct ParseOptions {
    pub include_mesh: bool,
    pub include_labels: bool,
}

impl ParseOptions {
    pub fn full() -> Self {
        Self {
            include_mesh: true,
            include_labels: true,
        }
    }

    pub fn quoting_only() -> Self {
        Self {
            include_mesh: false,
            include_labels: false,
        }
    }

    /// Single-pass parse: metrics + fan mesh, skip ML labels.
    pub fn preview() -> Self {
        Self {
            include_mesh: true,
            include_labels: false,
        }
    }
}

pub struct ParseContext<'a> {
    pub arena: &'a Arena,
    pub prescan: PrescanResult,
    pub raw_bytes: &'a [u8],
    pub raw_bbox: BoundingBox,
    pub scale_to_mm: f64,
    pub topology: TopologyIndex,
}

pub struct PipelineState {
    generation: Cell<u64>,
}

impl PipelineState {
    pub fn new() -> Self {
        Self {
            generation: Cell::new(0),
        }
    }

    pub fn begin_parse(&self) -> u64 {
        let gen = self.generation.get().wrapping_add(1);
        self.generation.set(gen);
        gen
    }

    pub fn cancel(&self) {
        self.begin_parse();
    }

    pub fn is_cancelled(&self, parse_generation: u64) -> bool {
        self.generation.get() != parse_generation
    }

    fn check_cancel(&self, generation: u64) -> Result<(), String> {
        if self.is_cancelled(generation) {
            Err(ParseError::Cancelled.into_message())
        } else {
            Ok(())
        }
    }
}

impl Default for PipelineState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct PipelineOutput {
    pub arena: Arena,
    pub result: ParseResult,
}

pub fn run_pipeline(
    raw_bytes: &[u8],
    options: ParseOptions,
    state: &PipelineState,
    generation: u64,
    mut on_stage: Option<&mut dyn FnMut(&str)>,
) -> Result<PipelineOutput, String> {
    let start = now_ms();
    let mut stages_completed: Vec<String> = Vec::new();

    let emit = |stage: &str, stages: &mut Vec<String>, cb: &mut Option<&mut dyn FnMut(&str)>| {
        stages.push(stage.to_string());
        if let Some(f) = cb.as_mut() {
            f(stage);
        }
    };

    state.check_cancel(generation)?;

    let (arena, entities, prescan, entities_skipped) = ingest_step(raw_bytes)?;
    emit(STAGE_PRESCAN, &mut stages_completed, &mut on_stage);
    emit(STAGE_PARSE, &mut stages_completed, &mut on_stage);

    state.check_cancel(generation)?;

    let raw_bbox = extract_bounding_box(&arena).unwrap_or_else(empty_bbox);
    let topology = TopologyIndex::build(&arena);
    emit(STAGE_TOPOLOGY, &mut stages_completed, &mut on_stage);

    state.check_cancel(generation)?;

    let mut ctx = ParseContext {
        arena: &arena,
        prescan: prescan.clone(),
        raw_bytes,
        raw_bbox: raw_bbox.clone(),
        scale_to_mm: 1.0,
        topology,
    };

    let (quoting, aag) = extract_quoting_report(&ctx);
    ctx.scale_to_mm = quoting.units.scale_to_mm;
    emit(STAGE_QUOTING, &mut stages_completed, &mut on_stage);
    emit(STAGE_AAG, &mut stages_completed, &mut on_stage);

    state.check_cancel(generation)?;

    let mesh = if options.include_mesh {
        emit(STAGE_MESH, &mut stages_completed, &mut on_stage);
        tessellate_mesh(&ctx)
    } else {
        None
    };

    state.check_cancel(generation)?;

    let labels = if options.include_labels {
        emit(STAGE_LABELS, &mut stages_completed, &mut on_stage);
        classify_face_labels(
            &ctx,
            &quoting.slots,
            &quoting.pockets,
            &quoting.bounding_box_mm,
        )
    } else {
        crate::output::FaceLabelReport {
            engine: "skipped".into(),
            face_classifications: vec![],
            notes: "Labels stage skipped via ParseOptions".into(),
        }
    };

    let parse_duration_ms = now_ms() - start;
    let type_breakdown = compute_type_breakdown(&entities);
    let mut warnings = Vec::new();
    if entities_skipped > 0 {
        warnings.push(format!(
            "{entities_skipped} STEP entity record(s) skipped during ingest (malformed nom parse)"
        ));
    }

    let result = ParseResult {
        success: true,
        error: None,
        engine_version: ENGINE_VERSION.to_string(),
        stats: ParseStats {
            entity_count: prescan.entity_count,
            max_id: prescan.max_id,
            density: prescan.density,
            storage_mode: prescan.storage_mode_label().to_string(),
            parse_duration_ms,
            type_breakdown,
            stages_completed,
            entities_skipped,
            warnings,
        },
        bounding_box: Some(raw_bbox),
        quoting,
        aag,
        mesh,
        labels,
    };

    Ok(PipelineOutput { arena, result })
}

/// Re-analyze an existing arena without re-parsing STEP bytes.
pub fn analyze_arena(
    arena: &Arena,
    prescan: PrescanResult,
    raw_bytes: &[u8],
    options: ParseOptions,
    ingest_quality: Option<(usize, Vec<String>)>,
) -> Result<ParseResult, String> {
    let start = now_ms();
    let mut stages_completed: Vec<String> = Vec::new();

    let raw_bbox = extract_bounding_box(arena).unwrap_or_else(empty_bbox);
    let topology = TopologyIndex::build(arena);
    stages_completed.push(STAGE_TOPOLOGY.to_string());

    let mut ctx = ParseContext {
        arena,
        prescan: prescan.clone(),
        raw_bytes,
        raw_bbox: raw_bbox.clone(),
        scale_to_mm: 1.0,
        topology,
    };

    let (quoting, aag) = extract_quoting_report(&ctx);
    ctx.scale_to_mm = quoting.units.scale_to_mm;
    stages_completed.push(STAGE_QUOTING.to_string());
    stages_completed.push(STAGE_AAG.to_string());

    let mesh = if options.include_mesh {
        stages_completed.push(STAGE_MESH.to_string());
        tessellate_mesh(&ctx)
    } else {
        None
    };

    let labels = if options.include_labels {
        stages_completed.push(STAGE_LABELS.to_string());
        classify_face_labels(
            &ctx,
            &quoting.slots,
            &quoting.pockets,
            &quoting.bounding_box_mm,
        )
    } else {
        crate::output::FaceLabelReport {
            engine: "skipped".into(),
            face_classifications: vec![],
            notes: "Labels stage skipped via ParseOptions".into(),
        }
    };

    let type_breakdown = compute_type_breakdown_from_arena(arena);
    let (entities_skipped, warnings) =
        ingest_quality.unwrap_or((0, Vec::new()));

    Ok(ParseResult {
        success: true,
        error: None,
        engine_version: ENGINE_VERSION.to_string(),
        stats: ParseStats {
            entity_count: prescan.entity_count,
            max_id: prescan.max_id,
            density: prescan.density,
            storage_mode: prescan.storage_mode_label().to_string(),
            parse_duration_ms: now_ms() - start,
            type_breakdown,
            stages_completed,
            entities_skipped,
            warnings,
        },
        bounding_box: Some(raw_bbox),
        quoting,
        aag,
        mesh,
        labels,
    })
}

fn compute_type_breakdown_from_arena(arena: &Arena) -> Vec<crate::output::EntityTypeCount> {
    use std::collections::HashMap;
    let mut counts: HashMap<String, usize> = HashMap::new();
    for (_, entity) in arena.iter() {
        *counts.entry(entity.type_name().to_string()).or_insert(0) += 1;
    }
    let mut breakdown: Vec<_> = counts
        .into_iter()
        .map(|(type_name, count)| crate::output::EntityTypeCount { type_name, count })
        .collect();
    breakdown.sort_by(|a, b| a.type_name.cmp(&b.type_name));
    breakdown
}

pub fn prescan_only(bytes: &[u8]) -> Result<PrescanResult, String> {
    prescan_ids(bytes)
}

fn empty_bbox() -> BoundingBox {
    BoundingBox {
        min: Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        },
        max: Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        },
        dimensions: Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        },
    }
}

#[cfg(target_arch = "wasm32")]
fn now_ms() -> f64 {
    js_sys::Date::now()
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_cancel_before_ingest() {
        let state = PipelineState::new();
        let gen = state.begin_parse();
        state.cancel();
        let err = run_pipeline(b"", ParseOptions::quoting_only(), &state, gen, None)
            .err()
            .expect("cancelled parse should fail");
        assert!(err.contains("cancelled"), "unexpected: {err}");
    }

    #[test]
    fn pipeline_cancel_mid_parse() {
        let bytes = include_bytes!("../../tests/fixtures/simple_cube.step");
        let state = PipelineState::new();
        let gen = state.begin_parse();
        let mut cancelled = false;
        let result = run_pipeline(
            bytes,
            ParseOptions::quoting_only(),
            &state,
            gen,
            Some(&mut |stage| {
                if stage == STAGE_PARSE {
                    state.cancel();
                    cancelled = true;
                }
            }),
        );
        assert!(cancelled);
        let err = result.err().expect("cancel after parse stage should fail");
        assert!(err.contains("cancelled"), "unexpected: {err}");
    }
}
