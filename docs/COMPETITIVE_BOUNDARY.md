# Competitive boundary (AI era)

steprs.dev is **open core**: the public `steprs-dev` repository ships the Apache-2.0 parser, golden eval, and analysis handoff API only. **Runtime gates alone are not IP protection** — repository-level separation is required for the edit moat.

## What stays public (this repo)

| Asset | Why public |
|-------|------------|
| `crates/steprs-core` parse pipeline | Apache-2.0; embeddable engine |
| Golden suite + `SCORECARD.md` | Credibility; moat = regression discipline |
| `ParseResult` schema + `packages/ts-types` | Stable integrator contract |
| Analysis handoff (`steprs-handoff.ts`, `/api/v1/fixtures/*/handoff`) | Public API; value is parser output quality |
| `llms.txt` / product docs | Discovery |

Hole detection, AAG convexity, stock envelope, and NIST calibration are hard to copy well even with source.

## Removed from public repository

The following **no longer appear in public git** (moved to private editor repo):

| Former path | Competitive content |
|-------------|---------------------|
| `apps/web/lib/editor/*` (except `api-guard.ts`) | NL→EditOp planner, Ollama prompts, part intelligence |
| `apps/web/app/api/editor/*` (implementation) | Agent orchestration — routes now 503 stubs |
| `apps/web/components/editor/` | Full editor UI |
| `packages/steprs-mcp/src/` | MCP tool surface |
| `crates/steprs-core/src/editor/` | Edit session, verify, STEP writer, latent ops |
| `crates/steprs-core/src/kernel/brepkit.rs` | B-rep edit kernel wiring |

See [PRIVATE_EDITOR.md](./PRIVATE_EDITOR.md) for deployment and history-scrub guidance.

## Borderline (public by design)

| Item | Notes |
|------|--------|
| `compactAagGraph()` in `apps/web/lib/api/types.ts` | Handoff compaction — public contract |
| `LLM_SYSTEM_PROMPT` in `steprs-handoff.ts` | Analysis handoff guardrails, not edit moat |
| Face labels (`topology-v2`) in Rust | Rule-based, not ML |

## Production exposure

| Surface | Public steprs.dev |
|---------|-------------------|
| WASM parse APIs | Yes |
| WASM `openSession` / `applyEdits` | **Not in build** |
| `/api/editor/*` | **503** always |
| Edit tab | Coming soon panel |
| `/api/v1/fixtures/*/handoff` | Yes (example parts) |
| Third-party analytics | Off by default |

## External review checklist (answered)

1. **Runtime vs repo boundary** — Runtime was gated; repo now split. NOTICE + stubs enforce public scope.
2. **Golden eval honesty** — n=12 strict unique fixtures; limitations documented in manifest.
3. **Scope oversell** — No DFM/PMI/ML/verified editing claims.
4. **Stock truth** — `part_envelope_mm` from Rust quoting, not OCCT bbox.
5. **Parser edge cases** — Tests for missing DATA, `''` escapes, malformed entity skip, assembly header markers.
6. **Handoff API** — Credible public contract; edit generation stays private.

Machine-readable context: [`llm.json`](../llm.json).
