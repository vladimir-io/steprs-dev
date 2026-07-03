import type { FaceMeshRange, ParseResult, TessellatedMesh } from "@steprs/ts-types";

/** WASM wire payload: metrics without mesh arrays + optional typed mesh. */
export interface ParseWirePayload {
  metrics: ParseResult;
  mesh?: MeshWireBuffers;
}

interface MeshWireBuffers {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangle_count: number;
  truncated: boolean;
  mesh_engine?: string;
  face_ranges?: FaceMeshRange[];
  edge_positions?: Float32Array;
  edge_segment_count?: number;
}

export function normalizeMeshWire(raw: MeshWireBuffers): TessellatedMesh {
  return {
    positions: raw.positions,
    normals: raw.normals,
    indices: raw.indices,
    triangle_count: raw.triangle_count,
    truncated: raw.truncated,
    mesh_engine: raw.mesh_engine ?? "fan",
    face_ranges: raw.face_ranges ?? [],
    edge_positions: raw.edge_positions,
    edge_segment_count: raw.edge_segment_count ?? 0,
  };
}

export function meshTransferables(mesh: TessellatedMesh): Transferable[] {
  const out: Transferable[] = [];
  if (mesh.positions instanceof Float32Array) {
    out.push(mesh.positions.buffer);
  }
  if (mesh.normals instanceof Float32Array) {
    out.push(mesh.normals.buffer);
  }
  if (mesh.indices instanceof Uint32Array) {
    out.push(mesh.indices.buffer);
  }
  if (mesh.edge_positions instanceof Float32Array) {
    out.push(mesh.edge_positions.buffer);
  }
  return out;
}

export function assembleParseResult(wire: ParseWirePayload): {
  result: ParseResult;
  transfers: Transferable[];
} {
  const result = wire.metrics;
  if (!wire.mesh) {
    return { result, transfers: [] };
  }
  const mesh = normalizeMeshWire(wire.mesh);
  result.mesh = mesh;
  return { result, transfers: meshTransferables(mesh) };
}
