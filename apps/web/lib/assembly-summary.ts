import type { StepHeaderReport } from "@/lib/step-header";
import type { ModelSnapshot, ParseResult } from "@steprs/ts-types";

export interface AssemblySummary {
  isAssembly: boolean;
  solidCount: number | null;
  status: "pass" | "warn" | "unknown";
  headline: string;
  indicators: string[];
  editorSolidIds: number[];
  notes: string[];
}

function solidCountFromHeader(header: StepHeaderReport | null): number | null {
  if (!header) return null;
  for (const indicator of header.assembly.indicators) {
    const match = indicator.match(/^(\d+)×\s*MANIFOLD_SOLID_BREP$/i);
    if (match) return Number(match[1]);
  }
  return header.assembly.isAssembly ? null : 1;
}

/** Surface multi-body / assembly signals from header scan and editor snapshot. */
export function summarizeAssembly(
  header: StepHeaderReport | null,
  result?: ParseResult | null,
  snapshot?: ModelSnapshot | null,
): AssemblySummary {
  const editorSolidIds = snapshot?.solid_ids ?? [];
  const headerSolids = solidCountFromHeader(header);
  const solidCount =
    editorSolidIds.length > 0
      ? editorSolidIds.length
      : headerSolids;

  const indicators = header?.assembly.indicators ?? [];
  const isAssembly =
    Boolean(header?.assembly.isAssembly) ||
    (solidCount != null && solidCount > 1) ||
    editorSolidIds.length > 1;

  const notes: string[] = [];
  if (isAssembly) {
    notes.push(
      "Assembly or multiple solids detected. Confirm the correct body is imported before CAM.",
    );
  }
  if (
    solidCount != null &&
    solidCount > 1 &&
    result &&
    result.quoting.holes.length > 0
  ) {
    notes.push(
      "Hole and stock metrics reflect the parsed model envelope, not per-body breakdown.",
    );
  }

  let headline = "Single solid part file";
  if (solidCount != null && solidCount > 1) {
    headline = `${solidCount} solid bodies`;
  } else if (isAssembly) {
    headline = "Assembly structure";
  }

  return {
    isAssembly,
    solidCount,
    status: isAssembly ? "warn" : header?.assembly.status ?? "unknown",
    headline,
    indicators,
    editorSolidIds,
    notes,
  };
}
