import { quotingBoundingBoxMm } from "@/lib/analysis/envelope";
import { parseQualityNotes } from "@/lib/parse-quality";
import { sizeStock } from "@/lib/stock-sizer";
import { mapHolesToTools } from "@/lib/tool-mapper";
import {
  validateImportCompatibility,
  type StepHeaderReport,
} from "@/lib/step-header";
import { formatNumber } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

import { summarizeAssembly } from "@/lib/assembly-summary";

export interface TriageReportEnvelope {
  mm: { x: number; y: number; z: number };
  in: { x: number; y: number; z: number };
  units: string;
}

export interface TriageReport {
  generatedAt: string;
  engineVersion: string;
  fileName: string;
  fileSizeBytes?: number;
  parseDurationMs: number;
  entityCount: number;
  header: {
    format: string;
    headerUnits: string;
    geometryUnits: string;
    unitConfidence: number;
    assembly: ReturnType<typeof summarizeAssembly>;
    importIssues: string[];
    importOverall: string;
  };
  envelope: TriageReportEnvelope;
  stock: {
    rawLabelMm: string;
    rawLabelIn: string;
    billetLabelMm: string;
    billetLabelIn: string;
    allowancePerSideIn: number;
    stockVolumeIn3: number;
  } | null;
  holes: {
    total: number;
    uniqueDiameters: number;
    rows: Array<{
      count: number;
      diameterMm: number;
      diameterIn: number;
      holeKinds: string[];
      depthNote: string;
      toolNote: string;
    }>;
    copyText: string;
  } | null;
  geometryHeuristics: {
    fillets: number;
    pockets: number;
    slots: number;
    setups: number;
    requires5Axis: boolean;
    minInternalToolMm: number | null;
    detectionNotes: string[];
  };
}

const MM_PER_IN = 25.4;

export function buildTriageReport(input: {
  fileName: string;
  fileSizeBytes?: number;
  result: ParseResult;
  headerReport: StepHeaderReport | null;
}): TriageReport {
  const { fileName, fileSizeBytes, result, headerReport } = input;
  const q = result.quoting;
  const bbox = quotingBoundingBoxMm(result);
  const dims = bbox.dimensions;

  const importCheck = headerReport
    ? validateImportCompatibility(
        headerReport,
        q.units.detected_unit,
        q.units.confidence,
      )
    : { overall: "unknown" as const, issues: [] as string[] };

  const stockReport = sizeStock(bbox, q.units);
  const toolReport = q.holes.length ? mapHolesToTools(q.holes) : null;
  const fmtDims = (x: number, y: number, z: number, unit: "mm" | "in") => {
    const decimals = unit === "mm" ? 0 : 3;
    const fmt = (n: number) => formatNumber(n, decimals);
    return `${fmt(x)} × ${fmt(y)} × ${fmt(z)} ${unit}`;
  };

  return {
    generatedAt: new Date().toISOString(),
    engineVersion: result.engine_version,
    fileName,
    fileSizeBytes,
    parseDurationMs: result.stats.parse_duration_ms,
    entityCount: result.stats.entity_count,
    header: {
      format: headerReport?.format.label ?? "unknown",
      headerUnits: headerReport?.units.label ?? "unknown",
      geometryUnits: q.units.detected_unit,
      unitConfidence: q.units.confidence,
      assembly: summarizeAssembly(headerReport, result),
      importIssues: importCheck.issues,
      importOverall: importCheck.overall,
    },
    envelope: {
      mm: {
        x: dims.x,
        y: dims.y,
        z: dims.z,
      },
      in: {
        x: dims.x / MM_PER_IN,
        y: dims.y / MM_PER_IN,
        z: dims.z / MM_PER_IN,
      },
      units: q.units.detected_unit,
    },
    stock: {
      rawLabelMm: fmtDims(
        stockReport.rawMm.x,
        stockReport.rawMm.y,
        stockReport.rawMm.z,
        "mm",
      ),
      rawLabelIn: fmtDims(
        stockReport.rawIn.x,
        stockReport.rawIn.y,
        stockReport.rawIn.z,
        "in",
      ),
      billetLabelMm: stockReport.billetLabelMm,
      billetLabelIn: stockReport.billetLabelIn,
      allowancePerSideIn: stockReport.allowancePerSideIn,
      stockVolumeIn3: stockReport.stockVolumeIn3,
    },
    holes: toolReport
      ? {
          total: toolReport.totalHoles,
          uniqueDiameters: toolReport.uniqueDiameters,
          rows: toolReport.rows.map((row) => ({
            count: row.count,
            diameterMm: row.diameterMm,
            diameterIn: row.diameterIn,
            holeKinds: row.holeKinds,
            depthNote: row.depthNote,
            toolNote: row.toolNote,
          })),
          copyText: toolReport.copyText,
        }
      : null,
    geometryHeuristics: {
      fillets: q.fillets.length,
      pockets: q.pockets.length,
      slots: q.slots.length,
      setups: q.setup_count,
      requires5Axis: q.requires_5_axis,
      minInternalToolMm: q.min_internal_tool_diameter_mm ?? null,
      detectionNotes: [
        ...parseQualityNotes(result),
        ...(q.detection_notes ?? []),
      ],
    },
  };
}

export function triageReportBaseName(fileName: string): string {
  return fileName.replace(/\.(step|stp)$/i, "") || "part";
}

export function formatEnvelopeLine(env: TriageReportEnvelope): string {
  return `${formatNumber(env.mm.x, 1)} × ${formatNumber(env.mm.y, 1)} × ${formatNumber(env.mm.z, 1)} mm (${formatNumber(env.in.x, 2)} × ${formatNumber(env.in.y, 2)} × ${formatNumber(env.in.z, 2)} in)`;
}
