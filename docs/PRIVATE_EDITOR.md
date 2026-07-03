# Private geometry editor

The natural-language geometry editor, agent orchestration, B-rep edit kernel, and MCP bridge **do not ship in this public repository**.

They live in a separate proprietary repository (not linked here). This split protects competitive AI logic — prompts, NL→geometry planners, part intelligence, and brepkit edit wiring — from public git history and automated scrapers.

## What remains public

| Surface | Status |
|---------|--------|
| Rust WASM parse pipeline | Apache-2.0 in `crates/steprs-core` |
| Golden eval + `SCORECARD.md` | Public |
| Analysis handoff API | `/api/v1/fixtures/*/handoff` |
| Edit tab UI | “Coming soon” panel only |
| `/api/editor/*` | Always **503** with pointer to this doc |

## Before a competitive editor launch

1. Develop editor in the **private** repository.
2. Deploy with editor-enabled WASM and authenticated API routes.
3. If this public repo ever contained editor source, **scrub git history** before launch (`git filter-repo` or fresh orphan root).

See also [COMPETITIVE_BOUNDARY.md](./COMPETITIVE_BOUNDARY.md) and [OPEN_CORE.md](../OPEN_CORE.md).
