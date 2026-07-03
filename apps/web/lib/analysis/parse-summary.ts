import { quotingBoundingBoxMm } from "@/lib/analysis/envelope";
import type { ParseResult } from "@steprs/ts-types";

import type { PartProfileSummary } from "@steprs/ts-types";

/** Read-only summary from parse output — no editor session required. */
export function buildParseSummary(
  result: ParseResult,
  fileName?: string,
): PartProfileSummary {
  const q = result.quoting;
  const bbox = quotingBoundingBoxMm(result);
  const dims = bbox.dimensions;
  const units = q.units.detected_unit;
  const title =
    fileName?.replace(/\.(step|stp)$/i, "").replace(/[-_]/g, " ") ?? "Part";

  const features: string[] = [];
  if (q.holes.length > 0) {
    const through = q.holes.filter((h) => h.kind === "through").length;
    const blind = q.holes.length - through;
    if (through > 0 && blind > 0) {
      features.push(`${through} through, ${blind} blind`);
    } else {
      features.push(`${q.holes.length} hole${q.holes.length === 1 ? "" : "s"}`);
    }
  }
  if (q.fillets.length > 0) {
    features.push(`${q.fillets.length} fillet${q.fillets.length === 1 ? "" : "s"}`);
  }
  if (q.pockets.length > 0) {
    features.push(`${q.pockets.length} pocket${q.pockets.length === 1 ? "" : "s"}`);
  }
  if (q.slots.length > 0) {
    features.push(`${q.slots.length} slot${q.slots.length === 1 ? "" : "s"}`);
  }

  const hints: string[] = [];
  if (q.requires_5_axis) {
    hints.push("Possible undercuts (heuristic). Verify in CAM.");
  }
  if (q.min_internal_tool_diameter_mm != null) {
    hints.push(
      `Min internal tool ~Ø${q.min_internal_tool_diameter_mm.toFixed(1)} mm (estimate)`,
    );
  }

  const summary = `${dims.x.toFixed(1)} × ${dims.y.toFixed(1)} × ${dims.z.toFixed(1)} ${units}`;

  const insightParts: string[] = [];
  if (q.units.confidence < 0.6) {
    insightParts.push(
      `Low unit confidence (${Math.round(q.units.confidence * 100)}%). Open Header before CAM.`,
    );
  }
  if (q.detection_notes?.length) {
    insightParts.push(q.detection_notes[0]!);
  }

  return {
    kind: "generic",
    title,
    summary,
    insight: insightParts.join(" "),
    confidence: 1,
    features,
    hints,
    capabilities: [],
  };
}
