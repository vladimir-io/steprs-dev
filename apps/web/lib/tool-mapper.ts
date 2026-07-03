import type { MachiningHole } from "@steprs/ts-types";

export interface StandardTool {
  diameterMm: number;
  diameterIn: number;
  name: string;
  kind: "endmill" | "drill" | "tap_prep" | "reamer";
}

/** Standard drill and endmill sizes mapped by cut diameter. */
export const STANDARD_TOOLS: StandardTool[] = [
  { diameterMm: 1.5875, diameterIn: 0.0625, name: '1/16" Endmill', kind: "endmill" },
  { diameterMm: 2.3813, diameterIn: 0.09375, name: '3/32" Endmill', kind: "endmill" },
  { diameterMm: 3.175, diameterIn: 0.125, name: '1/8" Endmill', kind: "endmill" },
  { diameterMm: 3.2639, diameterIn: 0.1285, name: "#30 Drill", kind: "drill" },
  { diameterMm: 3.453, diameterIn: 0.136, name: "M3 Tap Drill", kind: "tap_prep" },
  { diameterMm: 3.9688, diameterIn: 0.15625, name: '5/32" Endmill', kind: "endmill" },
  { diameterMm: 4.2164, diameterIn: 0.166, name: '#19 Drill (M5 tap prep)', kind: "tap_prep" },
  { diameterMm: 4.3656, diameterIn: 0.171875, name: "M4 Tap Drill", kind: "tap_prep" },
  { diameterMm: 4.7625, diameterIn: 0.1875, name: '3/16" Endmill', kind: "endmill" },
  { diameterMm: 5.1054, diameterIn: 0.201, name: "#7 Drill", kind: "drill" },
  { diameterMm: 5.5, diameterIn: 0.2165, name: "M6 Tap Drill", kind: "tap_prep" },
  { diameterMm: 6.35, diameterIn: 0.25, name: '1/4" Endmill', kind: "endmill" },
  { diameterMm: 6.8, diameterIn: 0.2677, name: "M8 Tap Drill", kind: "tap_prep" },
  { diameterMm: 7.9375, diameterIn: 0.3125, name: '5/16" Endmill', kind: "endmill" },
  { diameterMm: 8.5, diameterIn: 0.3346, name: "M10 Tap Drill", kind: "tap_prep" },
  { diameterMm: 9.525, diameterIn: 0.375, name: '3/8" Endmill', kind: "endmill" },
  { diameterMm: 10.2, diameterIn: 0.4016, name: "M12 Tap Drill", kind: "tap_prep" },
  { diameterMm: 12.7, diameterIn: 0.5, name: '1/2" Endmill', kind: "endmill" },
  { diameterMm: 15.875, diameterIn: 0.625, name: '5/8" Endmill', kind: "endmill" },
  { diameterMm: 19.05, diameterIn: 0.75, name: '3/4" Endmill', kind: "endmill" },
];

const DIAMETER_GROUP_TOLERANCE_MM = 0.08;
const TOOL_MATCH_TOLERANCE_MM = 0.15;

export interface ToolMappingRow {
  count: number;
  diameterMm: number;
  diameterIn: number;
  holeKinds: string[];
  depthMm: number | null;
  depthNote: string;
  tool: StandardTool | null;
  toolNote: string;
}

export interface ToolMappingReport {
  rows: ToolMappingRow[];
  totalHoles: number;
  uniqueDiameters: number;
  copyText: string;
}

export function mapHolesToTools(holes: MachiningHole[]): ToolMappingReport {
  const groups = groupHolesByDiameter(holes);
  const rows: ToolMappingRow[] = groups.map((group) => {
    const tool = matchTool(group.diameterMm);
    const toolNote = tool
      ? tool.name
      : `Custom Ø${group.diameterMm.toFixed(2)} mm. Select nearest tool`;
    const depthMm = summarizeDepth(group.holes);

    return {
      count: group.holes.length,
      diameterMm: group.diameterMm,
      diameterIn: group.diameterMm / 25.4,
      holeKinds: [...new Set(group.holes.map((h) => h.kind))],
      depthMm,
      depthNote: formatDepthNote(group.holes, depthMm),
      tool,
      toolNote,
    };
  });

  rows.sort((a, b) => a.diameterMm - b.diameterMm);

  const copyText = rows.map((row) => formatRow(row)).join("\n");

  return {
    rows,
    totalHoles: holes.length,
    uniqueDiameters: rows.length,
    copyText,
  };
}

function groupHolesByDiameter(holes: MachiningHole[]) {
  const sorted = [...holes].sort((a, b) => a.diameter_mm - b.diameter_mm);
  const groups: { diameterMm: number; holes: MachiningHole[] }[] = [];

  for (const hole of sorted) {
    const existing = groups.find(
      (g) => Math.abs(g.diameterMm - hole.diameter_mm) <= DIAMETER_GROUP_TOLERANCE_MM,
    );
    if (existing) {
      existing.holes.push(hole);
    } else {
      groups.push({ diameterMm: hole.diameter_mm, holes: [hole] });
    }
  }

  return groups;
}

function summarizeDepth(holes: MachiningHole[]): number | null {
  const depths = holes
    .map((h) => h.depth_mm)
    .filter((d): d is number => d != null && d > 0);
  if (depths.length === 0) return null;
  const unique = [...new Set(depths.map((d) => Math.round(d * 100) / 100))];
  if (unique.length === 1) return unique[0]!;
  return Math.max(...depths);
}

function formatDepthNote(holes: MachiningHole[], depthMm: number | null): string {
  if (depthMm == null) return "Depth n/a";
  const through = holes.some((h) => h.kind === "through");
  if (through && holes.every((h) => h.kind === "through")) {
    return "Through (part thickness)";
  }
  const depths = holes
    .map((h) => h.depth_mm)
    .filter((d): d is number => d != null);
  const unique = [...new Set(depths.map((d) => Math.round(d * 10) / 10))];
  if (unique.length === 1) return `${unique[0]!.toFixed(1)} mm`;
  return `${Math.min(...depths).toFixed(1)}–${Math.max(...depths).toFixed(1)} mm`;
}

function matchTool(diameterMm: number): StandardTool | null {
  let best: StandardTool | null = null;
  let bestDelta = Infinity;

  for (const tool of STANDARD_TOOLS) {
    const delta = Math.abs(tool.diameterMm - diameterMm);
    if (delta <= TOOL_MATCH_TOLERANCE_MM && delta < bestDelta) {
      best = tool;
      bestDelta = delta;
    }
  }

  return best;
}

function formatRow(row: ToolMappingRow): string {
  const mm = row.diameterMm.toFixed(2);
  const inch = row.diameterIn.toFixed(3);
  const depth =
    row.depthNote !== "Depth n/a" ? ` · ${row.depthNote}` : "";
  return `${row.count}× Holes @ ${mm}mm (${inch}")${depth} · ${row.toolNote}`;
}
