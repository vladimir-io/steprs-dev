# steprs web app

Next.js 15 front end for [steprs.dev](https://steprs.dev).

## Layout

```
app/                 Routes, metadata, API handlers
components/
  home/              Landing shell (viewport-first grid)
  layout/            Header, footer
  parser/            Drop zone, preview, progress
  tools/             Stock, schema, tooling workspace
  editor/            AI edit UI (dev-only until released)
  ui/                Primitives
lib/                 Site config, WASM worker, editor agent, guardrails
public/
  wasm/              Committed steprs-core WASM bundle
  fixtures/          Benchy demo STEP (benchy.stp)
workers/             Parser + OCCT preview workers
```

## Commands

```bash
yarn dev          # from repo root
yarn workspace @steprs/web dev:clean   # fix corrupted .next
yarn build:wasm   # after Rust changes
yarn workspace @steprs/web build       # production build — stop dev first
yarn workspace @steprs/web check       # lint + types + tests + build
```

### Dev errors (`ENOENT` / `build-manifest.json`)

This happens when **`next dev` and `next build` run at the same time** — they fight over `.next`.

1. Stop the dev server (Ctrl+C)
2. Run `yarn workspace @steprs/web dev:clean`  
   Or: `yarn workspace @steprs/web clean` then `yarn dev`

Do not run `yarn workspace @steprs/web check` or `yarn build` while `yarn dev` is active in another terminal.

After Rust changes: `yarn build:wasm` from the repo root, then commit `public/wasm/*`.

Validate local STEP files against the WASM bundle:

```bash
cargo run --example batch_parse --manifest-path ../../crates/steprs-core/Cargo.toml -- ~/Downloads
```

## Theme

Light/dark tokens live in `app/themes.css`. Theme toggle applies instantly (no color transition) via `html.theme-instant` on switch.
