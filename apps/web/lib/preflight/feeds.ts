/**
 * Starting feeds & speeds — pure math, no AI.
 *
 * RPM = (SFM × 3.82) / tool diameter (inches); feed = RPM × chipload × flutes.
 * SFM and chipload baselines are conservative Machinery's Handbook-style
 * starting points for carbide tooling. Always listen to the cut.
 */

import type { ToolProfile } from "./tools";

export type MaterialId = "aluminum-6061" | "steel-1018" | "mdf";

export interface MaterialProfile {
  id: MaterialId;
  label: string;
  sfm: number;
  /** Chipload (inches/tooth) by tool diameter bracket (mm upper bound). */
  chiploadIn: { maxDiameterMm: number; value: number }[];
}

export const MATERIALS: MaterialProfile[] = [
  {
    id: "aluminum-6061",
    label: "6061 Aluminum",
    sfm: 500,
    chiploadIn: [
      { maxDiameterMm: 3.5, value: 0.0005 },
      { maxDiameterMm: 7, value: 0.001 },
      { maxDiameterMm: 10, value: 0.002 },
      { maxDiameterMm: 100, value: 0.003 },
    ],
  },
  {
    id: "steel-1018",
    label: "1018 Steel",
    sfm: 100,
    chiploadIn: [
      { maxDiameterMm: 3.5, value: 0.0003 },
      { maxDiameterMm: 7, value: 0.0006 },
      { maxDiameterMm: 10, value: 0.001 },
      { maxDiameterMm: 100, value: 0.002 },
    ],
  },
  {
    id: "mdf",
    label: "MDF / wood",
    sfm: 1000,
    chiploadIn: [
      { maxDiameterMm: 3.5, value: 0.002 },
      { maxDiameterMm: 7, value: 0.004 },
      { maxDiameterMm: 10, value: 0.006 },
      { maxDiameterMm: 100, value: 0.008 },
    ],
  },
];

export const DEFAULT_MATERIAL_ID: MaterialId = "aluminum-6061";

export function getMaterial(id: string): MaterialProfile | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export interface FeedsRecommendation {
  rpm: number;
  /** True when the machine spindle ceiling clipped the ideal RPM. */
  rpmClamped: boolean;
  feedMmPerMin: number;
}

export function recommendFeeds(
  tool: ToolProfile,
  material: MaterialProfile,
  spindleMaxRpm: number,
): FeedsRecommendation {
  const diameterIn = tool.diameterMm / 25.4;
  const idealRpm = (material.sfm * 3.82) / diameterIn;
  const rpm = Math.min(idealRpm, spindleMaxRpm);
  const bracket =
    material.chiploadIn.find((c) => tool.diameterMm <= c.maxDiameterMm) ??
    material.chiploadIn[material.chiploadIn.length - 1]!;
  const feedInPerMin = rpm * bracket.value * tool.flutes;
  return {
    rpm: Math.round(rpm),
    rpmClamped: idealRpm > spindleMaxRpm,
    feedMmPerMin: Math.round(feedInPerMin * 25.4),
  };
}
