#!/usr/bin/env python3
"""Build HTC-inspired hole reference geometry (FreeCAD / OpenCASCADE B-rep).

Not the official NIST HTC solid (native CAD only). Geometry analog of the 12
authored hole features for steprs B-rep detection validation without NX/Creo/CATIA.
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import FreeCAD
import Part


def v(x: float, y: float, z: float):
    return FreeCAD.Vector(x, y, z)


def through(solid, x: float, y: float, d: float, z0: float = -1.0, h: float = 24.0):
    cyl = Part.makeCylinder(d / 2.0, h, v(x, y, z0), v(0, 0, 1))
    return solid.cut(cyl)


def blind_flat(solid, x: float, y: float, d: float, depth: float, z_top: float = 20.0):
    cyl = Part.makeCylinder(d / 2.0, depth, v(x, y, z_top - depth), v(0, 0, 1))
    return solid.cut(cyl)


def counterbore_through(solid, x: float, y: float, bore_d: float, cb_d: float, cb_depth: float):
    solid = through(solid, x, y, bore_d)
    cb = Part.makeCylinder(cb_d / 2.0, cb_depth, v(x, y, -1.0), v(0, 0, 1))
    return solid.cut(cb)


def counterbore_blind(solid, x: float, y: float, bore_d: float, bore_depth: float, cb_d: float, cb_depth: float):
    solid = blind_flat(solid, x, y, bore_d, bore_depth)
    cb = Part.makeCylinder(cb_d / 2.0, cb_depth, v(x, y, 20.0 - cb_depth), v(0, 0, 1))
    return solid.cut(cb)


def countersink_blind(
    solid,
    x: float,
    y: float,
    bore_d: float,
    bore_depth: float,
    cs_d: float,
    angle_deg: float = 82.0,
):
    half = math.radians(angle_deg / 2.0)
    cone_h = max((cs_d - bore_d) / (2.0 * math.tan(half)), 0.8)
    z_cone_base = 20.0 - cone_h
    cone = Part.makeCone(cs_d / 2.0, bore_d / 2.0, cone_h, v(x, y, z_cone_base), v(0, 0, 1))
    solid = solid.cut(cone)
    if bore_depth > cone_h:
        cyl = Part.makeCylinder(
            bore_d / 2.0,
            bore_depth - cone_h,
            v(x, y, z_cone_base - (bore_depth - cone_h)),
            v(0, 0, 1),
        )
        solid = solid.cut(cyl)
    return solid


def angled_through(solid, x: float, y: float, d: float, axis):
    ax = v(*axis)
    cyl = Part.makeCylinder(d / 2.0, 40.0, v(x, y, 10.0), ax)
    return solid.cut(cyl)


def revolved_through(solid, x: float, y: float, r: float):
    # Approximate revolved cut as a through cylinder (catalog feature 5).
    return through(solid, x, y, r * 2.0)


def main() -> int:
    out = Path(
        os.environ.get("HTC_GEOMETRY_OUT")
        or (sys.argv[1] if len(sys.argv) > 1 else "nist_htc_geometry.stp")
    )
    out.parent.mkdir(parents=True, exist_ok=True)

    # mm - plate matching HTC order-of-magnitude
    solid = Part.makeBox(120.0, 80.0, 20.0)

    # 1-THRU-ALL (0.203 in ~ 5.16 mm)
    solid = through(solid, 12.0, 12.0, 5.16)
    # 3-NUMERIC_THRU (0.2188 in ~ 5.56 mm)
    solid = through(solid, 28.0, 12.0, 5.56)
    # 4-SKETCH_EXTRUDE_THRU_ALL - rectangular pocket through (extrude cut)
    pocket = Part.makeBox(8.0, 4.0, 24.0, v(44.0, 10.0, -2.0))
    solid = solid.cut(pocket)
    # 5-REVOLVE_THRU_ALL (dia 0.25 in = 6.35 mm)
    solid = revolved_through(solid, 62.0, 12.0, 3.175)
    # 6-COUNTERBORE_THRU
    solid = counterbore_through(solid, 78.0, 12.0, bore_d=4.0, cb_d=8.0, cb_depth=3.0)
    # 7-COUNTERBORE_DRILL (blind)
    solid = counterbore_blind(solid, 94.0, 12.0, bore_d=3.5, bore_depth=10.0, cb_d=7.0, cb_depth=3.0)
    # 8-COUNTERSUNK_DRILL
    solid = countersink_blind(solid, 12.0, 36.0, bore_d=4.0, bore_depth=9.0, cs_d=9.0)
    # 11-COUNTERBORE on second row
    solid = counterbore_through(solid, 28.0, 36.0, bore_d=3.0, cb_d=6.5, cb_depth=2.5)
    # 12-CONVEX_3_SURFACES - through on raised pad
    pad = Part.makeBox(14.0, 14.0, 6.0, v(48.0, 30.0, 20.0))
    solid = solid.fuse(pad)
    solid = through(solid, 55.0, 37.0, 4.5, z0=18.0, h=10.0)
    # 13-ANGLE - axis tilted 30 deg from Z
    ax = (0.0, math.sin(math.radians(30.0)), math.cos(math.radians(30.0)))
    solid = angled_through(solid, 72.0, 37.0, 5.0, ax)
    # 14-PARTIAL_HOLE - short arc cylinder (through partial)
    solid = through(solid, 88.0, 37.0, 6.0)
    # 15-THRU_SELECTED - blind up-to-depth (blind_flat)
    solid = blind_flat(solid, 104.0, 37.0, 5.5, depth=8.0)

    # Linear pattern leader duplicate (feature 1 pattern instance)
    solid = through(solid, 12.0, 52.0, 5.16)

    solid.exportStep(str(out))
    print(f"Wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
else:
    raise SystemExit(main())
