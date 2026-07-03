import type { TessellatedMesh } from "@steprs/ts-types";

interface OcctMesh {
  attributes: {
    position: { array: ArrayLike<number> };
    normal?: { array: ArrayLike<number> };
  };
  index: { array: ArrayLike<number> };
}

interface OcctReadResult {
  success?: boolean;
  meshes?: OcctMesh[];
}

/** Convert occt-import-js ReadStepFile meshes to our TessellatedMesh shape. Positions are already mm when linearUnit is millimeter. */
export function occtResultToMesh(result: OcctReadResult): TessellatedMesh {
  const meshes = result.meshes ?? [];
  let vertexCount = 0;
  let indexCount = 0;
  for (const geometryMesh of meshes) {
    vertexCount += geometryMesh.attributes.position.array.length / 3;
    indexCount += geometryMesh.index.array.length;
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  let vertexBase = 0;
  let posOffset = 0;
  let idxOffset = 0;

  for (const geometryMesh of meshes) {
    const pos = geometryMesh.attributes.position.array;
    const norm = geometryMesh.attributes.normal?.array;
    const idx = geometryMesh.index.array;
    const vertCount = pos.length / 3;

    for (let i = 0; i < pos.length; i += 1) {
      positions[posOffset + i] = Number(pos[i]);
    }
    if (norm && norm.length === pos.length) {
      for (let i = 0; i < norm.length; i += 1) {
        normals[posOffset + i] = Number(norm[i]);
      }
    } else {
      for (let i = 0; i < vertCount; i += 1) {
        const o = posOffset + i * 3;
        normals[o] = 0;
        normals[o + 1] = 0;
        normals[o + 2] = 1;
      }
    }
    for (let i = 0; i < idx.length; i += 1) {
      indices[idxOffset + i] = vertexBase + Number(idx[i]);
    }

    vertexBase += vertCount;
    posOffset += pos.length;
    idxOffset += idx.length;
  }

  return {
    positions,
    normals,
    indices,
    triangle_count: indices.length / 3,
    truncated: false,
    face_ranges: [],
    edge_positions: [],
    edge_segment_count: 0,
    mesh_engine: "occt",
  };
}
