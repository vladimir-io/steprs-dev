#!/usr/bin/env bash
# Build HTC-inspired STEP geometry via FreeCAD (no native NIST CAD required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/crates/steprs-core/tests/fixtures/nist_htc/nist_htc_geometry.stp"
FREECAD="${FREECAD_CMD:-/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd}"

if [[ ! -x "$FREECAD" ]]; then
  echo "FreeCADCmd not found at $FREECAD" >&2
  echo "Install: brew install --cask freecad" >&2
  exit 1
fi

echo "Building HTC-inspired geometry -> $OUT"
HTC_GEOMETRY_OUT="$OUT" "$FREECAD" -c "exec(open('$ROOT/scripts/build-htc-geometry-freecad.py', encoding='utf-8').read())"

CORE="$ROOT/crates/steprs-core"
echo ""
echo "Parsing…"
cd "$CORE"
cargo run --quiet --example parse_step -- "$OUT"

echo ""
echo "Suggested manifest htc_ap242 / geometry_detection:"
cargo run --quiet --example nist_htc_calibrate -- "$OUT" 2>&1 | grep -v "^Parsed"
