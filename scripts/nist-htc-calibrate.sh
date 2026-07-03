#!/usr/bin/env bash
# Parse an exported NIST HTC STEP file and print metrics for manifest calibration.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE="$ROOT/crates/steprs-core"
DEFAULT_STEP="$CORE/tests/fixtures/nist_htc/nist_htc_geometry.stp"
LEGACY_STEP="$CORE/tests/fixtures/nist_htc/nist_htc_ap242.stp"
STEP="${1:-${NIST_HTC_STEP:-$DEFAULT_STEP}}"
if [[ ! -f "$STEP" && -f "$LEGACY_STEP" ]]; then
  STEP="$LEGACY_STEP"
fi
if [[ "$STEP" != /* ]]; then
  STEP="$(cd "$(dirname "$STEP")" 2>/dev/null && pwd)/$(basename "$STEP")" || STEP="$ROOT/$STEP"
fi

if [[ ! -f "$STEP" ]]; then
  echo "HTC STEP not found: $STEP" >&2
  echo "" >&2
  echo "Build FreeCAD geometry (no NX/Creo/CATIA required):" >&2
  echo "  $ROOT/scripts/build-htc-geometry.sh" >&2
  echo "" >&2
  echo "Or export official HTC from CAD and save as:" >&2
  echo "  File → Export → STEP AP242 (semantic PMI + geometry)" >&2
  echo "  Save as: nist-htc-<vendor>-242.stp" >&2
  echo "" >&2
  echo "Then either:" >&2
  echo "  cp <export.stp> $DEFAULT_STEP" >&2
  echo "  NIST_HTC_STEP=<path> $0" >&2
  exit 1
fi

echo "Parsing: $STEP"
cd "$CORE"
cargo run --quiet --example parse_step -- "$STEP"

echo ""
echo "Update tests/fixtures/nist_htc/manifest.json → htc.geometry_detection with:"
echo '  "geometry_detection": {'
cargo run --quiet --example nist_htc_calibrate -- "$STEP"
