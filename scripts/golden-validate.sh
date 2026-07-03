#!/usr/bin/env bash
# Regenerate hole JSON snapshots and print Gate 1 scorecard.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="$ROOT/crates/steprs-core"
cd "$CORE"
export UPDATE_GOLDEN_SNAPSHOTS=1
cargo test golden_parity --quiet
cargo run --quiet --example golden_report
