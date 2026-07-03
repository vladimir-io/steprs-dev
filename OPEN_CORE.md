# Open core at steprs.dev

steprs.dev ships as **open core**: the STEP parser engine is open source; the hosted product and advanced editing layer are proprietary until released.

## Open source (Apache-2.0)

Published under [LICENSE](./LICENSE). Safe to fork, embed, and ship in your own tools.

| Component | Path | What it does |
|-----------|------|----------------|
| **steprs-core** | `crates/steprs-core/` | Rust WASM parser — ingest, topology, quoting, AAG, optional mesh + labels |
| **WASM bundle** | `apps/web/public/wasm/` | Pre-built `steprs_core.js` + `.wasm` committed with the web app |
| **Shared types** | `packages/ts-types/` | Parse result JSON contract |
| **Tests & fixtures** | `crates/steprs-core/tests/`, `apps/web/public/fixtures/` | Golden parses, batch examples |

Capabilities in the open core today:

- ISO 10303 STEP ingest (AP203/AP214-style DATA sections)
- Bounding box, units, holes, pockets, fillets, setup count
- Attributed adjacency graph (pocket/slot detection)
- Optional triangle mesh for preview (capped for WASM memory)
- Browser Web Worker API (`parse`, `parseQuotingOnly`, `cancel`)

## Proprietary / not in public release (yet)

These stay **closed** on [steprs.dev](https://steprs.dev) production until explicitly released:

| Component | Path | Status |
|-----------|------|--------|
| **Geometry editor** | `apps/web/components/editor/`, `apps/web/lib/editor/` | Disabled in prod (`Edit` tab → Coming soon) |
| **Editor API** | `apps/web/app/api/editor/` | Returns 503 unless `NEXT_PUBLIC_ENABLE_EDIT=true` |
| **Server edit sessions** | `apps/web/lib/editor/server-session.ts`, MCP bridges | Hosted / dev only |
| **B-rep edit kernel ops** | `crates/steprs-core` editor session (`openSession`, `applyEdits`) | Wired for preview; not exposed publicly |
| **Hosted SaaS** | Future cloud APIs, team features, billing | Not open source |

The **Next.js web app shell** (UI, branding, analytics, deployment) is source-available in this repo for development but marketed as part of the proprietary product layer—the **parser engine** is what we open license.

## Production vs preview

| Environment | Analysis tabs | Edit tab |
|-------------|---------------|----------|
| **steprs.dev (default)** | Stock · Schema · Tooling — local WASM, read-only | Coming soon |
| **Local preview** | Same | Set `NEXT_PUBLIC_ENABLE_EDIT=true` in `apps/web/.env.local` |

Analysis parses do **not** open an editor WASM session in production (`openEditor: false`), which keeps memory use predictable and avoids edit-path instability.

## WASM vs brepkit in CI

| Build | Cargo features | What it tests |
|-------|----------------|---------------|
| **Shipped WASM** | `--no-default-features` | Golden suite, scorecard, clippy, WASM smoke — matches production build |
| **Editor dev** | `brepkit-kernel` | B-rep edit kernel integration only |

CI runs these as separate jobs so a green brepkit build cannot mask a broken production WASM path. OCCT is viewport-only; stock and holes use Rust `ParseResult`.

## Contributing

Parser bugs and quoting accuracy fixes in `steprs-core` are the highest-value contributions. UI work on Stock / Schema / Tooling is welcome. Editor changes are accepted but remain off by default in production builds.

## Questions

- Parser / WASM: open an issue with a sample STEP (or sanitized excerpt).
- Licensing for commercial embed: Apache-2.0 applies to `steprs-core`; contact us for hosted editor licensing when available.
