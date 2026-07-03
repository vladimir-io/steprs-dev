import { effectiveBoundingBoxMm } from "@/lib/analysis/envelope";
import { formatNumber } from "@/lib/utils";
import type { BoundingBox, ParseResult } from "@steprs/ts-types";

import type { StepHeaderReport } from "./step-header";
import { summarizeAssembly } from "./assembly-summary";

export interface RevisionSide {
  fileName: string;
  fileSizeBytes: number;
  result: ParseResult;
  header: StepHeaderReport | null;
  envelope: BoundingBox;
}

export interface RevisionDiffRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface RevisionCompareReport {
  baseline: { fileName: string; fileSizeBytes: number };
  revision: { fileName: string; fileSizeBytes: number };
  rows: RevisionDiffRow[];
  summary: string;
}

function formatDims(bbox: BoundingBox): string {
  const d = bbox.dimensions;
  return `${formatNumber(d.x, 1)} × ${formatNumber(d.y, 1)} × ${formatNumber(d.z, 1)} mm`;
}

function row(
  label: string,
  before: string,
  after: string,
): RevisionDiffRow {
  return { label, before, after, changed: before !== after };
}

export function compareRevisions(
  baseline: RevisionSide,
  revision: RevisionSide,
): RevisionCompareReport {
  const b = baseline.result.quoting;
  const r = revision.result.quoting;
  const bAsm = summarizeAssembly(baseline.header, baseline.result);
  const rAsm = summarizeAssembly(revision.header, revision.result);

  const rows: RevisionDiffRow[] = [
    row("Envelope", formatDims(baseline.envelope), formatDims(revision.envelope)),
    row("Units", b.units.detected_unit, r.units.detected_unit),
    row(
      "AP protocol",
      baseline.header?.format.label ?? "n/a",
      revision.header?.format.label ?? "n/a",
    ),
    row("Bodies", bAsm.headline, rAsm.headline),
    row("Holes (total)", String(b.holes.length), String(r.holes.length)),
    row(
      "Unique hole Ø",
      String(new Set(b.holes.map((h) => h.diameter_mm.toFixed(2))).size),
      String(new Set(r.holes.map((h) => h.diameter_mm.toFixed(2))).size),
    ),
    row("Pockets", String(b.pockets.length), String(r.pockets.length)),
    row("Fillets", String(b.fillets.length), String(r.fillets.length)),
    row("Slots", String(b.slots.length), String(r.slots.length)),
    row(
      "Parse time",
      `${formatNumber(baseline.result.stats.parse_duration_ms, 0)} ms`,
      `${formatNumber(revision.result.stats.parse_duration_ms, 0)} ms`,
    ),
  ];

  const changed = rows.filter((entry) => entry.changed);
  const summary =
    changed.length === 0
      ? "No metric changes detected between revisions."
      : `${changed.length} metric${changed.length === 1 ? "" : "s"} changed: ${changed.map((c) => c.label.toLowerCase()).join(", ")}.`;

  return {
    baseline: {
      fileName: baseline.fileName,
      fileSizeBytes: baseline.fileSizeBytes,
    },
    revision: {
      fileName: revision.fileName,
      fileSizeBytes: revision.fileSizeBytes,
    },
    rows,
    summary,
  };
}

export function buildRevisionSide(
  fileName: string,
  fileSizeBytes: number,
  result: ParseResult,
  header: StepHeaderReport | null,
): RevisionSide {
  return {
    fileName,
    fileSizeBytes,
    result,
    header,
    envelope: effectiveBoundingBoxMm(result),
  };
}
