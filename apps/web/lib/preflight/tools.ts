/**
 * Virtual tool crib — standard catalog cutting tool dimensions.
 *
 * LOC (length of cut / flute length) and OAL are typical catalog values for
 * stub/standard carbide tools and jobber drills. Stickout is what actually
 * protrudes from the collet; the default assumes the tool is gripped near the
 * flutes (LOC + 6 mm runout allowance). Long-reach profiles override that.
 */

export type ToolType =
  | "flat_endmill"
  | "ballnose"
  | "drill"
  | "spot_drill";

export interface ToolProfile {
  id: string;
  label: string;
  type: ToolType;
  diameterMm: number;
  /** Flute length / length of cut. Cutting deeper than this rubs the shank. */
  fluteLengthMm: number;
  /** Overall tool length. */
  oalMm: number;
  shankDiameterMm: number;
  /** Default protrusion from collet face used for Z-stack math. */
  defaultStickoutMm: number;
  longReach?: boolean;
  /** Drill point angle in degrees (drills only). */
  pointAngleDeg?: number;
  flutes: number;
}

function stickout(fluteLengthMm: number): number {
  return fluteLengthMm + 6;
}

export const TOOLS: ToolProfile[] = [
  {
    id: "em-flat-3.175",
    label: '1/8" flat endmill',
    type: "flat_endmill",
    diameterMm: 3.175,
    fluteLengthMm: 12.7,
    oalMm: 38.1,
    shankDiameterMm: 3.175,
    defaultStickoutMm: stickout(12.7),
    flutes: 2,
  },
  {
    id: "em-flat-6.35",
    label: '1/4" flat endmill',
    type: "flat_endmill",
    diameterMm: 6.35,
    fluteLengthMm: 19.05,
    oalMm: 63.5,
    shankDiameterMm: 6.35,
    defaultStickoutMm: stickout(19.05),
    flutes: 3,
  },
  {
    id: "em-flat-6.35-lr",
    label: '1/4" long-reach endmill',
    type: "flat_endmill",
    diameterMm: 6.35,
    fluteLengthMm: 38.1,
    oalMm: 101.6,
    shankDiameterMm: 6.35,
    defaultStickoutMm: stickout(38.1),
    longReach: true,
    flutes: 3,
  },
  {
    id: "em-flat-9.525",
    label: '3/8" flat endmill',
    type: "flat_endmill",
    diameterMm: 9.525,
    fluteLengthMm: 25.4,
    oalMm: 63.5,
    shankDiameterMm: 9.525,
    defaultStickoutMm: stickout(25.4),
    flutes: 3,
  },
  {
    id: "em-flat-12.7",
    label: '1/2" flat endmill',
    type: "flat_endmill",
    diameterMm: 12.7,
    fluteLengthMm: 31.75,
    oalMm: 76.2,
    shankDiameterMm: 12.7,
    defaultStickoutMm: stickout(31.75),
    flutes: 3,
  },
  {
    id: "em-flat-3",
    label: "3 mm flat endmill",
    type: "flat_endmill",
    diameterMm: 3,
    fluteLengthMm: 12,
    oalMm: 38,
    shankDiameterMm: 3,
    defaultStickoutMm: stickout(12),
    flutes: 2,
  },
  {
    id: "em-flat-6",
    label: "6 mm flat endmill",
    type: "flat_endmill",
    diameterMm: 6,
    fluteLengthMm: 19,
    oalMm: 63,
    shankDiameterMm: 6,
    defaultStickoutMm: stickout(19),
    flutes: 3,
  },
  {
    id: "em-flat-8",
    label: "8 mm flat endmill",
    type: "flat_endmill",
    diameterMm: 8,
    fluteLengthMm: 25,
    oalMm: 63,
    shankDiameterMm: 8,
    defaultStickoutMm: stickout(25),
    flutes: 3,
  },
  {
    id: "em-ball-6.35",
    label: '1/4" ballnose',
    type: "ballnose",
    diameterMm: 6.35,
    fluteLengthMm: 19.05,
    oalMm: 63.5,
    shankDiameterMm: 6.35,
    defaultStickoutMm: stickout(19.05),
    flutes: 2,
  },
  {
    id: "drill-3",
    label: "3 mm jobber drill",
    type: "drill",
    diameterMm: 3,
    fluteLengthMm: 33,
    oalMm: 61,
    shankDiameterMm: 3,
    defaultStickoutMm: stickout(33),
    pointAngleDeg: 118,
    flutes: 2,
  },
  {
    id: "drill-4",
    label: "4 mm jobber drill",
    type: "drill",
    diameterMm: 4,
    fluteLengthMm: 43,
    oalMm: 75,
    shankDiameterMm: 4,
    defaultStickoutMm: stickout(43),
    pointAngleDeg: 118,
    flutes: 2,
  },
  {
    id: "drill-6",
    label: "6 mm jobber drill",
    type: "drill",
    diameterMm: 6,
    fluteLengthMm: 57,
    oalMm: 93,
    shankDiameterMm: 6,
    defaultStickoutMm: stickout(57),
    pointAngleDeg: 118,
    flutes: 2,
  },
  {
    id: "drill-6.35",
    label: '1/4" jobber drill',
    type: "drill",
    diameterMm: 6.35,
    fluteLengthMm: 60,
    oalMm: 98,
    shankDiameterMm: 6.35,
    defaultStickoutMm: stickout(60),
    pointAngleDeg: 118,
    flutes: 2,
  },
  {
    id: "drill-8",
    label: "8 mm jobber drill",
    type: "drill",
    diameterMm: 8,
    fluteLengthMm: 75,
    oalMm: 117,
    shankDiameterMm: 8,
    defaultStickoutMm: stickout(75),
    pointAngleDeg: 118,
    flutes: 2,
  },
  {
    id: "spot-90-6",
    label: "6 mm 90° spot / chamfer",
    type: "spot_drill",
    diameterMm: 6,
    fluteLengthMm: 8,
    oalMm: 50,
    shankDiameterMm: 6,
    defaultStickoutMm: stickout(8),
    pointAngleDeg: 90,
    flutes: 2,
  },
];

/** Sensible starter crib for a hobby router. */
export const DEFAULT_TOOL_IDS = [
  "em-flat-3.175",
  "em-flat-6.35",
  "drill-4",
  "drill-6.35",
];

export function getTools(ids: string[]): ToolProfile[] {
  return TOOLS.filter((t) => ids.includes(t.id));
}

/** Diameter match tolerance for pairing a drill with a modeled hole. */
export const DRILL_MATCH_TOLERANCE_MM = 0.15;
