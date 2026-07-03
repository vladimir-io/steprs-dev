//! # steprs-core
//!
//! Rust WASM engine for client-side ISO 10303 STEP parsing.
//!
//! Design goals: predictable memory layout, a single parse IR (`ParseContext`),
//! and CNC-oriented feature extraction — entirely client-side.
//!
//! ## Pipeline stages
//!
//! | Stage | Label | Work |
//! |-------|-------|------|
//! | L0+L1 | prescan + parse | `ingest_step` — DATA scan, entity parse, arena allocation |
//! | L3 | topology | `TopologyIndex` — face IR + edge-indexed adjacency |
//! | L4 | quoting | units, bbox, holes, fillets, pockets, slots, setups |
//! | L6 | aag | Joshi–Chang convexity + pocket/slot patterns |
//! | L7 | mesh | fan triangulation (optional) |
//! | L8 | labels | topology classifier, engine `"topology-v2"` (optional) |
//!
//! Stages L2 and L5 are reserved/unused in the stage label sequence.
//!
//! `prescan_ids` is a diagnostic ID-only scan; the hot path uses `ingest_step` which
//! parses entities then derives prescan counts for arena mode selection.

pub mod arena;
pub mod core;
pub mod entity;
pub mod error;
pub mod features;
pub mod golden;
pub mod kernel;
pub mod output;
pub mod parser;
pub mod pipeline;
pub mod resolver;
pub mod topology;
pub mod wasm;

pub use pipeline::{run_pipeline, ParseOptions, PipelineState};
