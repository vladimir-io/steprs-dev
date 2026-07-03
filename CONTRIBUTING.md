# Contributing to steprs.dev

Thank you for helping improve the open-core STEP engine. This project is meant to be readable, testable, and honest about what geometry heuristics can and cannot prove.

## Repository layout

| Path | Purpose |
|------|---------|
| `crates/steprs-core/` | Rust parser, topology, AAG, WASM bindings (Apache-2.0) |
| `apps/web/` | Next.js workbench (proprietary hosted app) |
| `packages/ts-types/` | Shared TypeScript types for `ParseResult` |
| `crates/steprs-core/tests/fixtures/` | Committed STEP test files (NIST MBE, prismatic, golden snapshots) |

## Scope boundaries

### In scope (core engine)

- Edge-adjacency resolution and Joshi–Chang AAG convexity math
- Dihedral precision, parser performance, and memory layout (arena, prescan)
- Faster ISO-10303-21 string parsing and ingest
- Alternative terminal output formats (JSON graph, triage reports)
- Hole, pocket, and stock heuristics with documented limits
- Golden tests and NIST MBE regression fixtures

### Out of scope (please open a discussion first)

- Full WebGL CAD editors or in-browser B-rep modeling
- Multi-body assembly viewers with mates and kinematics
- Machine-specific G-code or post-processor output
- Cloud upload pipelines or proprietary CAD kernel licensing
- “100% DFM” claims without test fixtures and documented false-positive rates

Feature creep in the core crate increases WASM size, review burden, and user trust risk. Prefer keeping the engine small and composable.

## Development setup

```bash
yarn install
yarn build:wasm          # after any Rust change
yarn dev                 # http://localhost:3000
```

Rust only:

```bash
cd crates/steprs-core
cargo test
cargo clippy -- -D warnings
```

## Test matrix

CI jobs in `.github/workflows/ci.yml`:

**rust-wasm** (production path, `--no-default-features`)

- `cargo fmt --check`
- `cargo test --lib --tests`
- `cargo test --test golden_suite`
- `cargo run --example golden_report`
- `scripts/generate-scorecard.sh` + diff on `SCORECARD.md`
- `cargo run --example generate_schema` + diff on `parse-result.schema.json`
- `cargo clippy -D warnings`

**rust-brepkit** (editor dev path, `brepkit-kernel` feature)

- `cargo test --lib --tests`

**wasm-freshness**

- Rebuild WASM with `--no-default-features`; diff `apps/web/public/wasm/`
- `node apps/web/scripts/wasm-smoke-test.mjs` (strict golden snapshots)

**web**

- lint, typecheck, unit tests, Playwright E2E, `next build`

Local checks before a parser change:

```bash
yarn test                    # WASM path + golden suite
yarn build:wasm              # commit apps/web/public/wasm/*
cargo test --test golden_suite --manifest-path crates/steprs-core/Cargo.toml --no-default-features
cargo run --example golden_report --manifest-path crates/steprs-core/Cargo.toml --no-default-features
yarn workspace @steprs/web test:e2e
```

### Golden gates (`tests/fixtures/golden/manifest.json`)

| Gate | Test / tool | What it enforces |
|------|-------------|------------------|
| **1** | `golden_report` | Per-hole identity precision/recall on strict tier |
| **2** | `golden_suite_strict_and_smoke` | Hole counts, kinds, diameters, units, bbox, AAG bounds |
| **3** | `golden_suite_parse_budget_gate` | Per-fixture parse time budgets |
| **4** | `golden_suite_known_limitations_documented` | `known_limitations` is non-empty |
| **5** | (future) | AP242 semantic PMI vs geometry holes |

`golden_parity_snapshots_match_native` compares full `quoting.holes` JSON for strict fixtures (native Rust; WASM smoke test covers WASM parity separately).

### NIST MBE Combined Test Cases

Fixtures live under `crates/steprs-core/tests/fixtures/nist/ftc/` (FTC, CTC). Expected hole counts, units, bbox tolerances, and parse budgets are declared in `tests/fixtures/golden/manifest.json`.

Published metrics: [`SCORECARD.md`](SCORECARD.md) (regenerated in CI).

If you change graph math, hole classification, or bbox logic, run:

```bash
cd crates/steprs-core
cargo test --test golden_suite
cargo test --test integration_test
```

Update golden snapshots only when behavior change is intentional:

```bash
UPDATE_GOLDEN_SNAPSHOTS=1 cargo test golden_parity -- --nocapture
```

Document known limitations in `manifest.json` → `known_limitations`.

## Pull request checklist

- [ ] `cargo test` passes locally
- [ ] `cargo clippy -- -D warnings` passes
- [ ] If Rust changed: `yarn build:wasm` and commit `apps/web/public/wasm/*`
- [ ] If parser output changed: update golden manifest or snapshots with justification
- [ ] No secrets, `.env`, or customer STEP files in the commit
- [ ] User-facing copy stays factual (heuristics labeled as prep, not verification)

## Code style

- **Rust:** explicit types at API boundaries; prefer `f64` vector math in hot paths; no new heavy dependencies without discussion
- **TypeScript:** match existing workbench patterns; keep file guardrails centralized in `lib/file-guardrails.ts`
- **Comments:** explain non-obvious geometry or STEP conventions only — no dev scratch notes in production paths

## Security

- Do not commit proprietary CAD, ITAR-controlled geometry, or credentials
- The hosted app has no server-side STEP upload path; keep it that way unless a separate security review is done
- Report vulnerabilities privately via GitHub Security Advisories

## License

Contributions to `crates/steprs-core` are licensed under Apache-2.0. The `apps/web` application remains proprietary — see [OPEN_CORE.md](./OPEN_CORE.md).
