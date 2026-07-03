# steprs-core

Client-side ISO 10303 STEP parser compiled to WebAssembly.

## What it does

- Single-pass ingest of the STEP `DATA;` section into an adaptive arena (dense `Vec` or sparse `HashMap`)
- Builds a topology index and edge-indexed attributed adjacency graph (AAG)
- Extracts Tier 1–3 CNC quoting metrics (bbox, holes, pockets, fillets, setups)
- Optional fan-triangulated mesh for browser preview (triangle cap enforced)
- Topology-based face labels (`topology-v2`) from geometry type and adjacency

## Build & test

```bash
cargo test --manifest-path Cargo.toml
cargo run --example batch_parse -- ~/Downloads
wasm-pack build . --target web --out-dir ../../apps/web/public/wasm
```

## Pipeline

```
ingest_step → TopologyIndex → quoting → AAG → mesh (opt) → labels (opt)
```

See the [monorepo README](../../README.md) for WASM API and deploy notes.
