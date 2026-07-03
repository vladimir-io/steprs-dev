# Steprs API v1 — fixture handoff audit

Generated from `apps/web/data/api/v1/fixtures/*.json` via `pnpm fixtures:api`.

| Fixture | Holes | Pockets | Slots | AAG faces | Manifold edges | Concave | Full graph nodes |
|---------|-------|---------|-------|-----------|----------------|---------|------------------|
| hole-plate (NIST CTC-01) | 10 | 0 | 8 | 139 | 370 | 122 | 139 |
| mounting-plate | 26 | 4 | 8 | 61 | 153 | 40 | 61 |
| machined-bracket | 0 | 1 | 15 | 15 | 39 | 17 | 15 |

## What we fixed (vs old export)

1. **Facts before topology** — prompt now leads with envelope, holes (Ø list), setups, pockets/slots before JSON.
2. **Compact graph default** — `view=compact` keeps 48 highest-signal faces (cylindrical + concave adjacency); full graph via `?view=full`.
3. **Bracket case** — 0 holes but 15 slots; old graph-only prompt misled LLMs; summary now surfaces slots/pockets.
4. **Stable HTTP API** — same `SteprsHandoff` contract in browser WASM export and `/api/v1/fixtures/{id}/handoff`.

## Try it

```bash
curl -s https://steprs.dev/api/v1/fixtures/hole-plate/handoff | jq '.summary'
curl -s -H 'Accept: text/plain' https://steprs.dev/api/v1/fixtures/mounting-plate/handoff | head -40
```

Regenerate snapshots after parser changes: `pnpm fixtures:api`
