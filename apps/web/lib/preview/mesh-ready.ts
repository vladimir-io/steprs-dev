import type { TessellatedMesh } from "@steprs/ts-types";

export function meshReadyForPreview(mesh: TessellatedMesh | undefined | null): boolean {
  if (!mesh) return false;
  return mesh.triangle_count > 0 || (mesh.edge_segment_count ?? 0) > 0;
}
