import type { BoundingBox, TessellatedMesh } from "@steprs/ts-types";

export interface MeshFrame {
  center: [number, number, number];
  radius: number;
  size: [number, number, number];
}

export interface ScenePlacement {
  /** Subtract from scene coords after CAD→Three transform (floor + center XZ). */
  offset: [number, number, number];
  center: [number, number, number];
  radius: number;
  size: [number, number, number];
}

/** STEP/CAD Z-up → three.js Y-up (matches preview-canvas). */
export function transformCadPoint(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [x, z, -y];
}

export function cadToScene(
  x: number,
  y: number,
  z: number,
  offset: [number, number, number],
): [number, number, number] {
  const [tx, ty, tz] = transformCadPoint(x, y, z);
  return [tx - offset[0], ty - offset[1], tz - offset[2]];
}

function bboxCorners(bbox: BoundingBox): Array<[number, number, number]> {
  const { min, max } = bbox;
  return [
    [min.x, min.y, min.z],
    [max.x, min.y, min.z],
    [max.x, max.y, min.z],
    [min.x, max.y, min.z],
    [min.x, min.y, max.z],
    [max.x, min.y, max.z],
    [max.x, max.y, max.z],
    [min.x, max.y, max.z],
  ];
}

function extentsFromScenePoints(
  points: Iterable<[number, number, number]>,
): { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  let count = 0;

  for (const [x, y, z] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    z1 = Math.max(z1, z);
    count += 1;
  }

  if (count === 0) return null;
  return { x0, y0, z0, x1, y1, z1 };
}

/** Single-pass scene-space extents — O(n), no sorting. */
function meshSceneExtents(
  mesh: TessellatedMesh,
  bbox?: BoundingBox,
): { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null {
  const hasSolid = mesh.triangle_count > 0 && mesh.positions.length >= 9;
  const positions = hasSolid ? mesh.positions : mesh.edge_positions ?? [];

  if (positions.length >= 3) {
    let x0 = Infinity;
    let y0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let z1 = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const [tx, ty, tz] = transformCadPoint(
        positions[i]!,
        positions[i + 1]!,
        positions[i + 2]!,
      );
      x0 = Math.min(x0, tx);
      y0 = Math.min(y0, ty);
      z0 = Math.min(z0, tz);
      x1 = Math.max(x1, tx);
      y1 = Math.max(y1, ty);
      z1 = Math.max(z1, tz);
    }

    return { x0, y0, z0, x1, y1, z1 };
  }

  if (!bbox) return null;

  return extentsFromScenePoints(
    bboxCorners(bbox).map(([x, y, z]) => transformCadPoint(x, y, z)),
  );
}

function placementFromExtents(ext: {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}): ScenePlacement {
  const sx = ext.x1 - ext.x0;
  const sy = ext.y1 - ext.y0;
  const sz = ext.z1 - ext.z0;
  const offset: [number, number, number] = [
    (ext.x0 + ext.x1) * 0.5,
    ext.y0,
    (ext.z0 + ext.z1) * 0.5,
  ];

  return {
    offset,
    center: [0, sy * 0.5, 0],
    radius: Math.max(Math.max(sx, sy, sz) * 0.5, 1e-3),
    size: [sx, sy, sz],
  };
}

/** Floor-aligned frame: bottom on y=0, centered on XZ. */
export function computeScenePlacement(
  mesh: TessellatedMesh,
  bbox?: BoundingBox,
): ScenePlacement | null {
  const ext = meshSceneExtents(mesh, bbox);
  if (!ext) return null;
  return placementFromExtents(ext);
}

export function sceneMeshFrame(
  mesh: TessellatedMesh,
  bbox?: BoundingBox,
): MeshFrame | null {
  const placement = computeScenePlacement(mesh, bbox);
  if (!placement) return null;
  return {
    center: placement.center,
    radius: placement.radius,
    size: placement.size,
  };
}

export function fitLevelCameraDistance(
  camera: { fov: number; aspect?: number },
  size: [number, number, number],
  radius: number,
): number {
  const aspect = camera.aspect && camera.aspect > 0 ? camera.aspect : 1;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const distForHeight = (size[1] * 0.5) / Math.tan(vFov / 2);
  const distForWidth = (Math.max(size[0], size[2]) * 0.5) / Math.tan(hFov / 2);
  const dist = Math.max(distForHeight, distForWidth) * 1.45;
  return Math.max(dist, radius * 1.65, 8);
}

/** Distance to frame a bounding sphere from the current viewing direction. */
export function fitViewDistance(
  camera: { fov: number; aspect?: number },
  radius: number,
  margin = 1.45,
): number {
  const aspect = camera.aspect && camera.aspect > 0 ? camera.aspect : 1;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const halfFov = Math.min(vFov, hFov) / 2;
  return Math.max((radius * margin) / Math.sin(halfFov), radius * 1.65, 8);
}
