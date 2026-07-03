# NIST MBE Combined Test Cases

Committed STEP fixtures from the [NIST MBE PMI Validation and Conformance Testing Project](https://www.nist.gov/el/intelligent-systems-division-7350/mbe-pmi-validation-and-conformance-testing-project) (Feature Testing Cases — FTC and Composite Testing Cases — CTC).

These files are the regression baseline for `golden_suite` and block merges when hole metrics, units, bbox tolerances, or parse budgets drift without an intentional manifest update. Bounding boxes are gated per-fixture in `manifest.json`, not globally.

## Layout

| Directory | Contents |
|-----------|----------|
| `ftc/` | `nist_ftc_*` and `nist_ctc_*` ASME1 STEP exports |
| `../nist_htc/` | HTC-inspired geometry (FreeCAD build script; see manifest notes) |

## Running locally

```bash
cd crates/steprs-core
cargo test --test golden_suite
```

Expected thresholds: `tests/fixtures/golden/manifest.json`.

## Adding or updating fixtures

1. Place `.stp` / `.step` under `ftc/` with the official NIST filename.
2. Add or update an entry in `manifest.json` with `tier`, `holes`, and `parse_budget_ms`.
3. Run `cargo run --example golden_calibrate` if hole metrics need baselining.
4. Document known false negatives in `known_limitations`.

Do not commit customer or export-controlled parts to this directory.
