import type { BoundingBox, ParseResult } from "@steprs/ts-types";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.round((sorted.length - 1) * p);
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)]!;
}

/** Single-pass min/max envelope from mesh vertices. */
export function boundingBoxFromMesh(
  positions: ArrayLike<number>,
): BoundingBox | null {
  if (positions.length < 9) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    dimensions: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    },
  };
}

/** Trim stray STEP points from mesh vertices (1st–99th percentile per axis). */
export function robustBoundingBoxFromMesh(
  positions: ArrayLike<number>,
): BoundingBox | null {
  if (positions.length < 9) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];

  for (let i = 0; i < positions.length; i += 3) {
    xs.push(positions[i]!);
    ys.push(positions[i + 1]!);
    zs.push(positions[i + 2]!);
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  zs.sort((a, b) => a - b);

  const min = {
    x: percentile(xs, 0.01),
    y: percentile(ys, 0.01),
    z: percentile(zs, 0.01),
  };
  const max = {
    x: percentile(xs, 0.99),
    y: percentile(ys, 0.99),
    z: percentile(zs, 0.99),
  };

  return {
    min,
    max,
    dimensions: {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    },
  };
}

/** Machining envelope from Rust quoting (never OCCT or mesh). */
export function quotingBoundingBoxMm(result: ParseResult): BoundingBox {
  return result.quoting.part_envelope_mm ?? result.quoting.bounding_box_mm;
}

/** @deprecated Use quotingBoundingBoxMm — kept for call-site clarity. */
export function effectiveBoundingBoxMm(result: ParseResult): BoundingBox {
  return quotingBoundingBoxMm(result);
}
