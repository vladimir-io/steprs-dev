import type { MachiningHole, ModelSnapshot } from "@steprs/ts-types";

/** STEP AdvancedFace ids whose underlying surface is this cylindrical hole. */
export function faceIdsForMachiningHole(
  hole: MachiningHole,
  snapshot: ModelSnapshot | null | undefined,
): number[] {
  if (hole.face_ids?.length) return hole.face_ids;
  if (!snapshot?.faces?.length) return [];
  return snapshot.faces
    .filter((face) => face.geometry_id === hole.id)
    .map((face) => face.id);
}

export function faceIdsForHoleId(
  holeId: number,
  snapshot: ModelSnapshot | null | undefined,
  holes?: MachiningHole[],
): number[] {
  const fromParse = holes?.find((h) => h.id === holeId);
  if (fromParse) {
    const ids = faceIdsForMachiningHole(fromParse, snapshot);
    if (ids.length) return ids;
  }
  const hole = snapshot?.holes.find((h) => h.id === holeId);
  if (!hole) return [];
  return faceIdsForMachiningHole(hole, snapshot);
}
