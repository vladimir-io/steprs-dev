"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { buildTriageReport } from "@/lib/reports/build-triage-report";
import {
  downloadTriageReportJson,
  downloadTriageReportText,
  printTriageReportPdf,
} from "@/lib/reports/download-report";
import { buildSteprsHandoff, buildAagJsonOnly } from "@/lib/api";
import type { StepHeaderReport } from "@/lib/step-header";
import type { ParseResult } from "@steprs/ts-types";

interface ExportMenuProps {
  fileName?: string;
  fileSize?: number;
  result: ParseResult | null;
  header: StepHeaderReport | null;
  disabled?: boolean;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onExported?: () => void;
}

function ClipboardIcon() {
  return (
    <svg className="export-menu__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="4" width="7" height="9" rx="1" />
      <path d="M4 11H3.5A1.5 1.5 0 012 9.5V3A1.5 1.5 0 013.5 1.5h6A1.5 1.5 0 0111 3v0.5" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="export-menu__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4L2 8l3 4M11 4l3 4-3 4M7.5 13l1-10" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg className="export-menu__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 1.5H3A1.5 1.5 0 001.5 3v10A1.5 1.5 0 003 14.5h10a1.5 1.5 0 001.5-1.5V6L9 1.5z" />
      <path d="M9 1.5V6h4.5" />
      <path d="M4 7.5h8M4 10.5h8" />
    </svg>
  );
}

function FileJsonIcon() {
  return (
    <svg className="export-menu__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 1.5H3A1.5 1.5 0 001.5 3v10A1.5 1.5 0 003 14.5h10a1.5 1.5 0 001.5-1.5V6L9 1.5z" />
      <path d="M9 1.5V6h4.5" />
      <path d="M5 8.5a1.5 1.5 0 001.5-1.5h1a1.5 1.5 0 001.5 1.5M8 10.5h1.5a1.5 1.5 0 000-3H8" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg className="export-menu__icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5V2h8v3M4 11H2.5A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5h11A1.5 1.5 0 0115 6.5v3A1.5 1.5 0 0113.5 11H12" />
      <rect x="4" y="9" width="8" height="5" rx="1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="export-menu__chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function ExportMenu({
  fileName,
  fileSize,
  result,
  header,
  disabled = false,
  triggerRef: externalTriggerRef,
  onExported,
}: ExportMenuProps) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copiedAag, setCopiedAag] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const panelRef = useRef<HTMLDivElement>(null);

  const report = useMemo(() => {
    if (!result || !fileName) return null;
    return buildTriageReport({
      fileName,
      fileSizeBytes: fileSize,
      result,
      headerReport: header,
    });
  }, [fileName, fileSize, result, header]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
      zIndex: 200,
    });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onResize = () => updatePanelPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, triggerRef]);

  const copyAag = useCallback(async () => {
    if (!result) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(
        buildSteprsHandoff(result, { fileName, view: "compact" }).prompt,
      );
      setCopiedAag(true);
      window.setTimeout(() => setCopiedAag(false), 2200);
      setOpen(false);
      onExported?.();
    } catch {
      setError("Clipboard copy blocked");
    }
  }, [result, fileName, onExported]);

  const copyJsonGraph = useCallback(async () => {
    if (!result) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(buildAagJsonOnly(result, "full"));
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 2200);
      setOpen(false);
      onExported?.();
    } catch {
      setError("Clipboard copy blocked");
    }
  }, [result, onExported]);

  const runDownload = useCallback(
    (action: "txt" | "json" | "pdf") => {
      if (!report) return;
      setError(null);
      try {
        if (action === "txt") downloadTriageReportText(report);
        if (action === "json") downloadTriageReportJson(report);
        if (action === "pdf") printTriageReportPdf(report);
        setOpen(false);
        onExported?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    },
    [report, onExported],
  );

  if (!result) return null;

  const panel =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        className="export-menu__panel export-menu__panel--portal"
        role="menu"
        style={panelStyle}
      >
        <p className="export-menu__section" role="presentation">
          AAG export
        </p>
        <button type="button" role="menuitem" onClick={copyAag}>
          <ClipboardIcon />
          <span>{copiedAag ? "Copied!" : "Copy prompt + facts"}</span>
        </button>
        <button type="button" role="menuitem" onClick={copyJsonGraph}>
          <CodeIcon />
          <span>{copiedJson ? "Copied!" : "Copy AAG JSON only"}</span>
        </button>

        <div className="export-menu__divider" aria-hidden />

        <p className="export-menu__section" role="presentation">
          Triage report
        </p>

        <button type="button" role="menuitem" disabled={!report} onClick={() => runDownload("txt")}>
          <FileTextIcon />
          <span>Plain Text (.txt)</span>
        </button>
        <button type="button" role="menuitem" disabled={!report} onClick={() => runDownload("json")}>
          <FileJsonIcon />
          <span>JSON report (.json)</span>
        </button>
        <button type="button" role="menuitem" disabled={!report} onClick={() => runDownload("pdf")}>
          <PrinterIcon />
          <span>Print / PDF report</span>
        </button>
      </div>,
      document.body,
    );

  return (
    <div className="export-menu">
      <button
        ref={triggerRef}
        type="button"
        className="export-menu__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Export / Copy</span>
        <ChevronDownIcon />
      </button>
      {panel}
      {error && (
        <p className="export-menu__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
