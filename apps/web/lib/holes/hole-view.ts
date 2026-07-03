import type { MachiningHole, Vec3 } from "@steprs/ts-types";
import * as THREE from "three";

import { cadToScene } from "@/lib/preview/mesh-bounds";

/** STEP/CAD Z-up → three.js Y-up (matches preview canvas). */
export function cadPointToThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

export function holeAxisUnit(axis: Vec3): [number, number, number] {
  const len = Math.hypot(axis.x, axis.y, axis.z);
  if (len < 1e-9) return [0, 0, 1];
  return [axis.x / len, axis.y / len, axis.z / len];
}

/** Hole axis direction in three.js scene space (Y-up). */
export function holeAxisScene(axis: Vec3): THREE.Vector3 {
  const [x, y, z] = holeAxisUnit(axis);
  const [tx, ty, tz] = cadPointToThree(x, y, z);
  return new THREE.Vector3(tx, ty, tz).normalize();
}

/** Entry point on the bore face (hole origin) in scene space. */
export function holeEntryPosition(
  hole: MachiningHole,
  offset: [number, number, number],
): [number, number, number] {
  return cadToScene(hole.origin.x, hole.origin.y, hole.origin.z, offset);
}

/** Axial bore length for highlight geometry — prefers parsed depth. */
export function holeHighlightDepth(hole: MachiningHole): number {
  if (hole.depth_mm != null && hole.depth_mm > 1e-4) {
    return hole.depth_mm;
  }
  return Math.max(hole.diameter_mm * 2.5, hole.radius_mm * 2);
}

/** @deprecated Use holeEntryPosition */
export function holeMarkerPosition(
  hole: MachiningHole,
  offset: [number, number, number],
): [number, number, number] {
  const axis = holeAxisUnit(hole.axis);
  const halfDepth = hole.depth_mm != null ? hole.depth_mm * 0.5 : 0;
  const cx = hole.origin.x + axis[0] * halfDepth;
  const cy = hole.origin.y + axis[1] * halfDepth;
  const cz = hole.origin.z + axis[2] * halfDepth;
  return cadToScene(cx, cy, cz, offset);
}

export function meshCentroid(positions: ArrayLike<number>): {
  cx: number;
  cy: number;
  cz: number;
} {
  let count = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < positions.length; i += 3) {
    cx += positions[i]!;
    cy += positions[i + 1]!;
    cz += positions[i + 2]!;
    count += 1;
  }
  if (count === 0) return { cx: 0, cy: 0, cz: 0 };
  return { cx: cx / count, cy: cy / count, cz: cz / count };
}
