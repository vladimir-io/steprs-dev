/** Lightning-fast G-code Z plunge scan — no full parser. */

const Z_MOVE =
  /\bZ\s*(-?\d+(?:\.\d+)?)/gi;

/** Deepest programmed Z in mm (positive depth below zero). */
export function scanMaxPlungeDepthMm(text: string): number | null {
  let minZ = 0;
  let found = false;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("(")) continue;

    Z_MOVE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = Z_MOVE.exec(trimmed)) !== null) {
      const z = Number.parseFloat(match[1]!);
      if (Number.isNaN(z)) continue;
      found = true;
      if (z < minZ) minZ = z;
    }
  }

  return found ? Math.abs(minZ) : null;
}

export function deepestModelPocketMm(
  pockets: { depth_mm: number }[],
  holes: { depth_mm?: number }[],
): number {
  let deepest = 0;
  for (const p of pockets) deepest = Math.max(deepest, p.depth_mm);
  for (const h of holes) {
    if (h.depth_mm != null) deepest = Math.max(deepest, h.depth_mm);
  }
  return deepest;
}

export interface GcodeDepthCheck {
  status: "pass" | "warn" | "fail";
  programmedMm: number;
  modelMm: number;
  title: string;
  detail: string;
}

export function compareGcodeToModel(
  gcodeText: string,
  modelDeepestMm: number,
): GcodeDepthCheck | null {
  const programmed = scanMaxPlungeDepthMm(gcodeText);
  if (programmed == null) {
    return {
      status: "warn",
      programmedMm: 0,
      modelMm: modelDeepestMm,
      title: "No Z moves found in G-code",
      detail: "Could not find Z- coordinates. Check file format or units.",
    };
  }

  if (modelDeepestMm <= 0) {
    return {
      status: "pass",
      programmedMm: programmed,
      modelMm: 0,
      title: `G-code deepest Z: ${programmed.toFixed(2)} mm`,
      detail: "No deep pockets or holes in the STEP model to compare against.",
    };
  }

  const margin = 0.5;
  if (programmed > modelDeepestMm + margin) {
    return {
      status: "fail",
      programmedMm: programmed,
      modelMm: modelDeepestMm,
      title: "G-code plunges deeper than the model",
      detail: `Programmed ${programmed.toFixed(2)} mm vs model deepest feature ${modelDeepestMm.toFixed(2)} mm. Check post-processor units or Z origin before running.`,
    };
  }

  return {
    status: "pass",
    programmedMm: programmed,
    modelMm: modelDeepestMm,
    title: "G-code depth matches model",
    detail: `Deepest Z ${programmed.toFixed(2)} mm within model feature depth ${modelDeepestMm.toFixed(2)} mm.`,
  };
}
