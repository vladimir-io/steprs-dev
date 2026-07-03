# Open core at steprs.dev

steprs.dev ships as **open core**: the STEP parser engine is Apache-2.0 in this public repository; the geometry editor and agent layer live in a **private repository**.

## Open source (Apache-2.0) — in this repo

| Component | Path | What it does |
|-----------|------|----------------|
| **steprs-core** | `crates/steprs-core/` | Rust WASM parser — ingest, topology, quoting, AAG, optional mesh + labels |
| **WASM bundle** | `apps/web/public/wasm/` | Pre-built parse-only `steprs_core.js` + `.wasm` |
| **Shared types** | `packages/ts-types/` | Parse result JSON contract |
| **Tests & fixtures** | `crates/steprs-core/tests/`, golden suite | NIST MBE calibration, scorecard |

Capabilities in the open core:

- ISO 10303 STEP ingest (AP203/AP214-style DATA sections)
- `part_envelope_mm`, units, holes, pockets, fillets, setup count
- Attributed adjacency graph (pocket/slot detection)
- Optional triangle mesh for preview (fan triangulation, capped)
- Browser Web Worker API (`parse`, `parseQuotingOnly`, `cancel`)
- Analysis handoff API (`/api/v1/fixtures/*/handoff`)

## Proprietary — not in this public repository

| Component | Status in public repo |
|-----------|----------------------|
| **Geometry editor UI** | Edit tab → “Coming soon” only |
| **Editor API** | `/api/editor/*` → **503** stubs |
| **NL agent / intent planner / Ollama prompts** | Removed — private repo |
| **B-rep edit kernel (brepkit)** | Removed — private repo |
| **MCP bridge** | README stub only (`packages/steprs-mcp/`) |
| **Hosted SaaS** | Future cloud APIs, billing — not open source |

The Next.js workbench shell (UI, branding) is source-visible here for the triage product but is **not Apache-2.0** for competitive editor logic — see [NOTICE](./NOTICE).

Details: [docs/PRIVATE_EDITOR.md](./docs/PRIVATE_EDITOR.md), [docs/COMPETITIVE_BOUNDARY.md](./docs/COMPETITIVE_BOUNDARY.md).

## Competitive posture (external review)

An independent architecture review confirmed:

- **Runtime gates were necessary but insufficient** — proprietary editor source in public git exposed copyable AI moat (prompts, planners, brepkit wiring).
- **Golden eval is honest** — n=12 strict unique fixtures, documented limitations.
- **Scope copy is credible** — no DFM/PMI/ML oversell; rule-based labels only.
- **Handoff API is the right public contract** — topology export without edit-generation logic.

This repository now reflects the recommended split: parse + eval public; editor private.

Agent review bundle: [llm.json](./llm.json).

## Production vs development

| Environment | Analysis tabs | Edit tab |
|-------------|---------------|----------|
| **steprs.dev** | Stock · Schema · Tooling — local WASM | Coming soon |
| **Private editor deploy** | Same | Full editor (separate repo + build) |

Analysis parses do **not** open an editor WASM session (`openEditor: false`).

## CI (public repo)

| Job | What it tests |
|-----|---------------|
| **rust-wasm** | Golden suite, scorecard, schema drift, clippy (`--no-default-features`) |
| **wasm-freshness** | WASM rebuild diff + 12-fixture smoke |
| **web** | lint, typecheck, unit tests, Playwright E2E, `next build` |

No brepkit or editor test jobs in the public repository.

## Contributing

Parser bugs and quoting accuracy fixes in `steprs-core` are the highest-value contributions. UI work on Stock / Schema / Tooling is welcome. Editor work happens in the private repository.

## Questions

- Parser / WASM: open an issue with a sample STEP (or sanitized excerpt).
- Commercial embed: Apache-2.0 applies to `steprs-core`; contact us for hosted editor licensing.
