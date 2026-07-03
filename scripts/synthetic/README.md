# Synthetic STEP suite (differential-testing oracle)

Scales eval confidence beyond the n=12 strict golden fixtures without hunting
real-world CAD. Files are generated programmatically, so the exact ground
truth is known by construction and recorded in `truth.json`.

## Generate

```bash
pip install cadquery          # OCCT kernel, one-time
python3 scripts/synthetic/generate_synthetic_steps.py
```

Outputs to `crates/steprs-core/tests/fixtures/synthetic/`:

| File | Ground truth |
|------|--------------|
| `plate_through_holes.step` | 3× Ø5 through, 10 mm plate |
| `plate_blind_flat.step` | 2× Ø6 flat-bottom blind, 6 mm deep |
| `plate_blind_drill_point.step` | 3× Ø5 blind with 118° cone tips |
| `deep_pocket_block.step` | 60×30 pocket, 30 mm deep (shank-collision trigger) |
| `counterbore_plate.step` | Ø5 through + Ø10×4 counterbore |

## Check against the parser

```bash
cargo run --example batch_parse --manifest-path crates/steprs-core/Cargo.toml \
  -- crates/steprs-core/tests/fixtures/synthetic
```

Assert the Rust `ParseResult` matches `truth.json` (hole kinds, diameters,
depths, envelope). Any drift is a regression in rim confirmation or hole
classification — catch it here before it reaches real parts.

## Extending to a combinatorial grid

`generate_synthetic_steps.py` case functions are parameterized; sweep hole
diameter (1–20 mm), depth, bottom geometry (flat / 118° / 135°), and
through-vs-blind to build the 100-case grid. Keep generated files out of the
strict golden tier — they validate parsing invariants, not NIST calibration.

## Relation to the pre-flight rule matrix

`apps/web/lib/preflight/preflight-rules.eval.json` (Phase 2) pins
machine/tool/rule outcomes on real fixtures and runs in CI on every push.
This synthetic suite (Phase 1) is the parser-level oracle beneath it.
