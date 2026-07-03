# steprs.dev

**STEP pre-flight before CAM** — drop a file, check units, holes, stock, and machine/tool fit. Runs in your browser; nothing uploads.

Open-core Rust WASM parser ([Apache-2.0](./LICENSE)).

## Architecture

```
Browser UI (Next.js + three.js preview)
    ↓ File bytes (Web Worker — zero main-thread compute)
    ↓ WASM StepParser
pipeline::run_pipeline
  L0+L1  ingest_step (single DATA scan → prescan + arena)
  L3     topology::TopologyIndex (face IR + edge-indexed AAG)
  L4     features::extract_quoting_report (tiers 1–3)
  L6     aag::analyze_aag (petgraph on shared topology)
  L7     mesh::tessellate_mesh (optional)
  L8     labels::classify_face_labels (topology-based face labels, engine topology-v2)
    ↓ JSON ParseResult
UI workbench (Header · Holes · Stock · Pre-Flight · AAG)
```

OCCT preview mesh is display-only. Hole counts, stock envelope, and AAG export come from the Rust WASM parser.

### Module map (`crates/steprs-core/src/`)

| Module | Role |
|--------|------|
| `core/` | Shared constants (`DENSITY_THRESHOLD`, `MAX_MESH_TRIANGLES`, stage labels) |
| `parser/` | nom ingest + `scan` utilities + single-pass `ingest_step` |
| `arena/` | Adaptive dense `Vec` / sparse `HashMap` storage |
| `topology/` | **Parse IR** — `FaceRecord`, edge-indexed adjacency graph (built once) |
| `pipeline/` | `ParseContext`, `ParseOptions`, `run_pipeline`, cancellation |
| `features/` | Quoting, AAG, mesh, label heads (all read `ParseContext`) |
| `output/` | Serde JSON contract |
| `wasm/` | Thin wasm-bindgen surface |

## Production defenses

- **Sparse ID arena:** pre-scan density gate → dense vs sparse allocation
- **Committed WASM:** `apps/web/public/wasm/*` rebuilt after Rust changes
- **50 MB warning** before parse; **parse cancellation** via worker `cancel` message
- **Real progress:** WASM `setProgressHandler` emits L0–L8 stage strings

## Development

```bash
yarn install
yarn build:wasm    # after any Rust change — commits artifacts to public/wasm/
yarn dev           # Next.js app in apps/web
yarn test          # cargo test + golden suite (see CONTRIBUTING.md)
yarn test:downloads # batch table against ~/Downloads STEP files
```

Web app layout and routes: [`apps/web/README.md`](apps/web/README.md).

Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md) — scope, test matrix, NIST fixtures.

**Agent / reviewer context:** [`llm.json`](llm.json) — architecture, eval, open vs proprietary scope. **Competitive AI boundary:** [`docs/COMPETITIVE_BOUNDARY.md`](docs/COMPETITIVE_BOUNDARY.md).

### Batch validation

```bash
# Human-readable table for any directory
cargo run --example batch_parse --manifest-path crates/steprs-core/Cargo.toml -- ~/Downloads

# Include live Downloads in cargo test
STEPRS_DOWNLOADS_DIR=~/Downloads cargo test --manifest-path crates/steprs-core/Cargo.toml
```

### WASM API

```javascript
const parser = new StepParser();
parser.setProgressHandler((stage) => console.log(stage));
parser.parse(bytes);                    // full pipeline
parser.parseQuotingOnly(bytes);         // skip mesh + labels
parser.parseWithOptions(bytes, false, true); // mesh off, face labels on
parser.cancel();                        // abort in-flight parse
```

## CI

`.github/workflows/ci.yml`:

1. **rust-wasm** — fmt, tests, golden suite, scorecard, schema drift, clippy (`--no-default-features`)
2. **wasm-freshness** — WASM rebuild diff + smoke test (all strict snapshots)
3. **web** — lint, typecheck, unit tests, Playwright E2E, `next build`

### SEO endpoints

| URL | Purpose |
|-----|---------|
| `/robots.txt` | Crawler rules, AI bot allowances, sitemap |
| `/sitemap.xml` | Search engine index |
| `/llms.txt` | Curated AI context ([llmstxt.org](https://llmstxt.org/)) |
| `/llms-full.txt` | Extended product/architecture summary |
| `/manifest.webmanifest` | PWA metadata |
| `/og-image.png` | Open Graph / Twitter card (1200×630) |
| `/privacy` | Privacy policy |

JSON-LD: `WebSite`, `SoftwareApplication`, `WebPage`, `FAQPage` on every page.

## License & open core

**steprs-core** (Rust WASM parser) is [Apache-2.0](./LICENSE).

The hosted app, geometry editor, and future cloud APIs are **proprietary** — see [OPEN_CORE.md](./OPEN_CORE.md) for what is open vs closed.

The geometry editor is **not in this public repository** — Edit tab shows “Coming soon”. See [docs/PRIVATE_EDITOR.md](./docs/PRIVATE_EDITOR.md).
