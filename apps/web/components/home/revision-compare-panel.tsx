"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RevisionCompareReport } from "@/lib/revision-compare";
import { formatBytes } from "@/lib/utils";

interface RevisionComparePanelProps {
  disabled?: boolean;
  busy?: boolean;
  report: RevisionCompareReport | null;
  error?: string | null;
  onCompare: (baseline: File, revision: File) => void;
  onClear: () => void;
}

export function RevisionComparePanel({
  disabled = false,
  busy = false,
  report,
  error,
  onCompare,
  onClear,
}: RevisionComparePanelProps) {
  const baselineRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef<HTMLInputElement>(null);
  const [baselineName, setBaselineName] = useState<string>();
  const [revisionName, setRevisionName] = useState<string>();

  const handleBaselinePick = useCallback((name: string) => {
    setBaselineName(name || undefined);
  }, []);

  const handleRevisionPick = useCallback((name: string) => {
    setRevisionName(name || undefined);
  }, []);

  const handleRun = useCallback(() => {
    const baseline = baselineRef.current?.files?.[0];
    const revision = revisionRef.current?.files?.[0];
    if (!baseline || !revision) return;
    onCompare(baseline, revision);
  }, [onCompare]);

  const canRun = Boolean(baselineName && revisionName && !disabled && !busy);

  return (
    <section className="revision-compare reveal-delay-2" aria-label="Revision compare">
      <header className="revision-compare__head">
        <p className="revision-compare__eyebrow">Job shops</p>
        <h2 className="revision-compare__title">Compare two revisions</h2>
        <p className="revision-compare__lead">
          Drop an old and new STEP to diff envelope, holes, pockets, and schema before
          reprogramming. Counts are automated geometry heuristics, not a CAM-ready diff.
        </p>
      </header>

      <div className="revision-compare__pickers">
        <RevisionPicker
          label="Baseline"
          inputRef={baselineRef}
          fileName={baselineName}
          onPick={handleBaselinePick}
          disabled={disabled || busy}
        />
        <RevisionPicker
          label="Revision"
          inputRef={revisionRef}
          fileName={revisionName}
          onPick={handleRevisionPick}
          disabled={disabled || busy}
        />
      </div>

      <div className="revision-compare__actions">
        <Button
          type="button"
          variant="glass"
          size="sm"
          disabled={!canRun}
          onClick={(event) => {
            event.stopPropagation();
            handleRun();
          }}
        >
          {busy ? "Comparing…" : "Compare revisions"}
        </Button>
        {report && (
          <button
            type="button"
            className="revision-compare__clear"
            onClick={(event) => {
              event.stopPropagation();
              setBaselineName(undefined);
              setRevisionName(undefined);
              if (baselineRef.current) baselineRef.current.value = "";
              if (revisionRef.current) revisionRef.current.value = "";
              onClear();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <p className="revision-compare__error" role="alert">
          {error}
        </p>
      )}

      {report && (
        <div className="revision-compare__results">
          <p className="revision-compare__summary">{report.summary}</p>
          <table className="revision-compare__table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{report.baseline.fileName}</th>
                <th>{report.revision.fileName}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={row.label}
                  className={row.changed ? "revision-compare__row--changed" : undefined}
                >
                  <td>{row.label}</td>
                  <td>{row.before}</td>
                  <td>{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RevisionPicker({
  label,
  inputRef,
  fileName,
  onPick,
  disabled,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileName?: string;
  onPick: (name: string, size?: number) => void;
  disabled?: boolean;
}) {
  const [size, setSize] = useState<number>();

  return (
    <label className="revision-picker">
      <span className="revision-picker__label">{label}</span>
      <button
        type="button"
        className="revision-picker__btn"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {fileName ?? "Choose STEP file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".step,.stp,.STEP,.STP"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setSize(file.size);
            onPick(file.name, file.size);
          } else {
            setSize(undefined);
            onPick("");
          }
        }}
      />
      {fileName && size != null && (
        <span className="revision-picker__meta">{formatBytes(size)}</span>
      )}
    </label>
  );
}
