//! AP242 / PMI semantic hole entity scan (Gate 5 scaffold).

use crate::arena::Arena;
use crate::output::MachiningHole;

const PMI_HOLE_TYPES: &[&str] = &[
    "DRILLING_FEATURE",
    "HOLE_FEATURE",
    "ROUND_HOLE",
    "COUNTERBORE_HOLE",
    "COUNTERSINK_HOLE",
    "THREADED_HOLE",
    "CATALOGUE_HOLE",
];

pub fn count_semantic_hole_entities(arena: &Arena) -> usize {
    arena
        .iter()
        .filter(|(_, e)| {
            let name = e.type_name();
            PMI_HOLE_TYPES.iter().any(|t| name.eq_ignore_ascii_case(t)) || name.contains("HOLE")
        })
        .count()
}

pub fn detection_notes(arena: &Arena, holes: &[MachiningHole]) -> Vec<String> {
    let mut notes = Vec::new();
    let pmi = count_semantic_hole_entities(arena);
    if pmi > 0 {
        notes.push(format!(
            "AP242 semantic hole PMI entities detected ({pmi}); geometry holes={}.",
            holes.len()
        ));
    } else {
        notes.push(
            "Hole metrics are geometry-derived (B-rep). No AP242 semantic hole PMI in file.".into(),
        );
    }
    notes
}
