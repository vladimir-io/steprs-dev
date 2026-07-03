import {
  buildTriageReportHtml,
  formatTriageReportText,
} from "./format-triage-report";
import type { TriageReport } from "./build-triage-report";
import { triageReportBaseName } from "./build-triage-report";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTriageReportText(report: TriageReport) {
  const base = triageReportBaseName(report.fileName);
  downloadBlob(
    new Blob([formatTriageReportText(report)], { type: "text/plain;charset=utf-8" }),
    `${base}-triage.txt`,
  );
}

export function downloadTriageReportJson(report: TriageReport) {
  const base = triageReportBaseName(report.fileName);
  downloadBlob(
    new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
    `${base}-triage.json`,
  );
}

/** Opens a print dialog; user can save as PDF from the browser. */
export function printTriageReportPdf(report: TriageReport) {
  const html = buildTriageReportHtml(report);
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to export PDF.");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}
