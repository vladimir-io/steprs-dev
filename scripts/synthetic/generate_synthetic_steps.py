#!/usr/bin/env python3
"""Combinatorial synthetic STEP generator — differential-testing oracle.

Programmatically generates parameterized STEP files with cadquery (OCCT).
Because the CAD is generated from known parameters, the exact ground truth
(hole count, kind, diameter, depth, envelope) is recorded alongside each file
in truth.json. Assert that the Rust ParseResult matches the generator inputs:

    pip install cadquery
    python3 scripts/synthetic/generate_synthetic_steps.py
    cargo run --example batch_parse --manifest-path crates/steprs-core/Cargo.toml \
        -- crates/steprs-core/tests/fixtures/synthetic

The 5 seed cases below cover through holes, flat-bottom blind holes,
118-degree drill-point blind holes, a deep pocket (shank-collision trigger),
and a counterbore stack. Extend the PLATE_CASES grid for combinatorial sweeps.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

try:
    import cadquery as cq
except ImportError:
    sys.exit(
        "cadquery is required: pip install cadquery\n"
        "(pulls the OCCT kernel; ~700 MB, one-time)"
    )

OUT_DIR = Path(__file__).resolve().parents[2] / (
    "crates/steprs-core/tests/fixtures/synthetic"
)

DRILL_POINT_ANGLE_DEG = 118.0


def drill_point_tip_height(radius: float) -> float:
    """Cone height left by a standard drill: r / tan(half-point-angle)."""
    half = math.radians(DRILL_POINT_ANGLE_DEG / 2.0)
    return radius / math.tan(half)


def plate(length: float, width: float, height: float) -> cq.Workplane:
    return cq.Workplane("XY").box(length, width, height, centered=(True, True, False))


def cut_blind_flat(
    wp: cq.Workplane, points: list[tuple[float, float]], diameter: float, depth: float
) -> cq.Workplane:
    return (
        wp.faces(">Z")
        .workplane()
        .pushPoints(points)
        .circle(diameter / 2.0)
        .cutBlind(-depth)
    )


def cut_blind_drill_point(
    solid: cq.Workplane,
    top_z: float,
    points: list[tuple[float, float]],
    diameter: float,
    depth: float,
) -> cq.Workplane:
    """Cylinder + 118-degree cone tip, like a real twist drill leaves."""
    r = diameter / 2.0
    tip = drill_point_tip_height(r)
    body = cq.Solid.makeCylinder(r, depth - tip, cq.Vector(0, 0, tip))
    cone = cq.Solid.makeCone(0.0, r, tip)
    drill = body.fuse(cone)
    result = solid
    for (x, y) in points:
        placed = drill.translate(cq.Vector(x, y, top_z - depth))
        result = result.cut(placed)
    return result


CASES = []


def case(fn):
    CASES.append(fn)
    return fn


@case
def plate_through_holes():
    """60 x 40 x 10 plate, 3x diameter-5 through holes."""
    wp = plate(60, 40, 10).faces(">Z").workplane()
    pts = [(-20, 0), (0, 0), (20, 0)]
    solid = wp.pushPoints(pts).hole(5)
    return solid, {
        "name": "plate_through_holes",
        "envelope_mm": [60, 40, 10],
        "holes": [
            {"kind": "through", "diameter_mm": 5.0, "depth_mm": 10.0, "count": 3}
        ],
        "pockets": [],
    }


@case
def plate_blind_flat():
    """50 x 30 x 12 plate, 2x diameter-6 flat-bottom blind holes, 6 deep."""
    solid = cut_blind_flat(plate(50, 30, 12), [(-12, 0), (12, 0)], 6.0, 6.0)
    return solid, {
        "name": "plate_blind_flat",
        "envelope_mm": [50, 30, 12],
        "holes": [
            {"kind": "blind_flat", "diameter_mm": 6.0, "depth_mm": 6.0, "count": 2}
        ],
        "pockets": [],
    }


@case
def plate_blind_drill_point():
    """50 x 30 x 15 plate, 3x diameter-5 blind holes with 118-degree cone tips."""
    base = plate(50, 30, 15)
    solid = cut_blind_drill_point(base, 15.0, [(-15, 0), (0, 0), (15, 0)], 5.0, 8.0)
    return solid, {
        "name": "plate_blind_drill_point",
        "envelope_mm": [50, 30, 15],
        "holes": [
            {
                "kind": "blind_drill_point",
                "diameter_mm": 5.0,
                "depth_mm": 8.0,
                "count": 3,
            }
        ],
        "pockets": [],
    }


@case
def deep_pocket_block():
    """80 x 50 x 35 block with a 60 x 30 pocket, 30 deep — shank-collision trigger."""
    solid = (
        plate(80, 50, 35)
        .faces(">Z")
        .workplane()
        .rect(60, 30)
        .cutBlind(-30)
    )
    return solid, {
        "name": "deep_pocket_block",
        "envelope_mm": [80, 50, 35],
        "holes": [],
        "pockets": [{"depth_mm": 30.0}],
        "preflight_expect": {
            "rule": "pocket-reach",
            "status": "fail",
            "with_tools": ["em-flat-6.35"],
        },
    }


@case
def counterbore_plate():
    """40 x 40 x 12 plate, diameter-5 through with diameter-10 x 4 counterbore."""
    solid = (
        plate(40, 40, 12)
        .faces(">Z")
        .workplane()
        .cboreHole(5.0, 10.0, 4.0)
    )
    return solid, {
        "name": "counterbore_plate",
        "envelope_mm": [40, 40, 12],
        "holes": [
            {
                "kind": "counterbore",
                "diameter_mm": 5.0,
                "counterbore_diameter_mm": 10.0,
                "count": 1,
            }
        ],
        "pockets": [],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    truth = []
    for build in CASES:
        solid, meta = build()
        path = OUT_DIR / f"{meta['name']}.step"
        cq.exporters.export(solid, str(path))
        truth.append(meta)
        print(f"wrote {path}")
    manifest = OUT_DIR / "truth.json"
    manifest.write_text(json.dumps({"cases": truth}, indent=2) + "\n")
    print(f"wrote {manifest} ({len(truth)} cases)")


if __name__ == "__main__":
    main()
