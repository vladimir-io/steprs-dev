import { siteConfig } from "@/lib/site";
import { formatNumber } from "@/lib/utils";

import {
  formatEnvelopeLine,
  type TriageReport,
} from "./build-triage-report";

export function formatTriageReportText(report: TriageReport): string {
  const lines: string[] = [
    `${siteConfig.name} STEP check report`,
    `Generated: ${report.generatedAt}`,
    `File: ${report.fileName}`,
    report.fileSizeBytes != null
      ? `Size: ${(report.fileSizeBytes / 1024).toFixed(1)} KB`
      : null,
    `Engine: ${report.engineVersion} · ${formatNumber(report.parseDurationMs, 0)} ms · ${report.entityCount.toLocaleString()} entities`,
    "",
    "── Header ──",
    `Format: ${report.header.format}`,
    `Header units: ${report.header.headerUnits}`,
    `Geometry units: ${report.header.geometryUnits} (${Math.round(report.header.unitConfidence * 100)}% confidence)`,
    `Bodies: ${report.header.assembly.headline}`,
    ...report.header.assembly.indicators.map((i) => `  · ${i}`),
    ...report.header.assembly.notes.map((n) => `  ! ${n}`),
    report.header.importIssues.length
      ? `Import notes: ${report.header.importIssues.join("; ")}`
      : "Import notes: none",
    "",
    "── Envelope ──",
    formatEnvelopeLine(report.envelope),
    "",
  ].filter((line): line is string => line != null);

  if (report.stock) {
    lines.push(
      "── Stock ──",
      `Part envelope: ${report.stock.rawLabelMm} / ${report.stock.rawLabelIn}`,
      `Billet (+${report.stock.allowancePerSideIn}" / side): ${report.stock.billetLabelMm}`,
      `Stock volume: ${formatNumber(report.stock.stockVolumeIn3, 2)} in³`,
      "",
    );
  }

  if (report.holes) {
    lines.push(
      "── Holes ──",
      `${report.holes.total} holes · ${report.holes.uniqueDiameters} unique Ø`,
      "",
    );
    for (const row of report.holes.rows) {
      lines.push(
        `${row.count}× ⌀${formatNumber(row.diameterMm, 2)} mm (${formatNumber(row.diameterIn, 3)}") · ${row.holeKinds.join(", ")} · ${row.depthNote} → ${row.toolNote}`,
      );
    }
    lines.push("");
  } else {
    lines.push("── Holes ──", "No cylindrical holes detected.", "");
  }

  const h = report.geometryHeuristics;
  lines.push(
    "── Geometry heuristics ──",
    `Fillets: ${h.fillets} · Pockets: ${h.pockets} · Slots: ${h.slots}`,
    `Setup hint (heuristic): ${h.setups}`,
    h.requires5Axis
      ? "5-axis hint (heuristic): possible undercuts. Verify in CAM."
      : "5-axis hint (heuristic): none flagged",
  );
  if (h.minInternalToolMm != null) {
    lines.push(
      `Min internal tool: ~Ø${formatNumber(h.minInternalToolMm, 1)} mm`,
    );
  }
  lines.push(
    ...h.detectionNotes.map((n) => `Note: ${n}`),
    "",
    `${siteConfig.url} · v${siteConfig.engineVersion}`,
  );

  return lines.filter((line): line is string => line != null).join("\n");
}

export function buildTriageReportHtml(report: TriageReport): string {
  const text = formatTriageReportText(report);
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${report.fileName} · steprs check</title>
  <style>
    @page { margin: 1.2cm; }
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; color: #111; }
    h1 { font-family: system-ui, sans-serif; font-size: 16px; font-weight: 600; margin: 0 0 12px; }
    pre { white-space: pre-wrap; margin: 0; }
  </style>
</head>
<body>
  <h1>steprs check · ${report.fileName}</h1>
  <pre>${escaped}</pre>
</body>
</html>`;
}
