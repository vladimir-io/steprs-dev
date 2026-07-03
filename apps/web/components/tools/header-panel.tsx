"use client";

import {
  inspectStepHeader,
  validateImportCompatibility,
  type StepHeaderReport,
} from "@/lib/step-header";
import { summarizeAssembly } from "@/lib/assembly-summary";
import { parseQualityNotes } from "@/lib/parse-quality";
import { formatNumber, cn } from "@/lib/utils";
import type { ModelSnapshot, ParseResult } from "@steprs/ts-types";

import { StatusBadge } from "./status-badge";

interface HeaderPanelProps {
  header: StepHeaderReport | null;
  result: ParseResult | null;
  inspectMs?: number;
  editorSnapshot?: ModelSnapshot | null;
}

export function HeaderPanel({
  header,
  result,
  inspectMs,
  editorSnapshot = null,
}: HeaderPanelProps) {
  if (!header) {
    return (
      <div className="header-panel header-panel--empty">
        Drop a STEP file to verify AP, units, and assembly before CAM.
      </div>
    );
  }

  const importCheck = validateImportCompatibility(
    header,
    result?.quoting?.units?.detected_unit,
    result?.quoting?.units?.confidence,
  );
  const assembly = summarizeAssembly(header, result, editorSnapshot);
  const parseNotes = result ? parseQualityNotes(result) : [];

  const headerMs = formatNumber(inspectMs ?? header.inspectDurationMs, 2);
  const parseMs = result
    ? formatNumber(result.stats.parse_duration_ms, 0)
    : null;

  return (
    <div className="header-panel">
      <p className="header-panel__meta">
        <MetaStat label="Header" value={`${headerMs} ms`} />
        {parseMs != null && (
          <>
            <MetaSep />
            <MetaStat label="Parse" value={`${parseMs} ms`} />
          </>
        )}
        {importCheck.issues.length > 0 && (
          <>
            <MetaSep />
            <span className="header-panel__meta-note">
              {importCheck.issues.length === 1
                ? "1 import note"
                : `${importCheck.issues.length} import notes`}
            </span>
          </>
        )}
        {parseNotes.length > 0 && (
          <>
            <MetaSep />
            <span className="header-panel__meta-note">
              {parseNotes.length === 1
                ? "1 parse note"
                : `${parseNotes.length} parse notes`}
            </span>
          </>
        )}
      </p>

      <p className="header-panel__subhead">
        Verify protocol and units before CAM. Wrong scale is the most common STEP
        import failure.
      </p>

      <section className="header-panel__block" aria-labelledby="header-format-heading">
        <h3 id="header-format-heading" className="header-panel__heading">
          STEP header
        </h3>
        <div className="header-sheet">
          <StatusBadge
            label="Format"
            value={header.format.label}
            status={header.format.status}
            detail={header.format.raw ?? undefined}
            technical
          />
          <StatusBadge
            label="Units"
            value={header.units.label}
            status={header.units.status}
            detail={header.units.source}
          />
          <StatusBadge
            label="Assembly"
            value={assembly.isAssembly ? "Assembly" : "Single part"}
            status={assembly.status}
            detail={
              assembly.indicators.length
                ? assembly.indicators.slice(0, 2).join(" · ")
                : assembly.headline
            }
          />
        </div>
      </section>

      <section className="header-panel__block" aria-labelledby="header-bodies-heading">
        <h3 id="header-bodies-heading" className="header-panel__heading">
          Bodies &amp; assembly
        </h3>
        <dl className="header-sheet header-sheet--kv">
          <KvRow label="Summary" value={assembly.headline} />
          <KvRow
            label="Solid count"
            value={
              assembly.solidCount != null
                ? String(assembly.solidCount)
                : assembly.isAssembly
                  ? "Multiple (header scan)"
                  : "1"
            }
            mono
          />
          {assembly.editorSolidIds.length > 0 && (
            <KvRow
              label="Editor solids"
              value={assembly.editorSolidIds.map((id) => `#${id}`).join(", ")}
              mono
            />
          )}
        </dl>
        {assembly.indicators.length > 0 && (
          <ul className="header-panel__indicator-list">
            {assembly.indicators.map((indicator) => (
              <li key={indicator}>{indicator}</li>
            ))}
          </ul>
        )}
        {assembly.notes.map((note) => (
          <p key={note} className="header-panel__footnote">
            {note}
          </p>
        ))}
      </section>

      {result && (
        <section
          className="header-panel__block"
          aria-labelledby="header-geometry-heading"
        >
          <div className="header-panel__block-head">
            <h3 id="header-geometry-heading" className="header-panel__heading">
              Geometry cross-check
            </h3>
            <p className="header-panel__subhead">
              WASM · {result.quoting.units.detected_unit}
              <span className="header-panel__confidence">
                {Math.round(result.quoting.units.confidence * 100)}%
              </span>
            </p>
          </div>
          <dl className="header-sheet header-sheet--kv">
            <KvRow label="Scale to mm" value={String(result.quoting.units.scale_to_mm)} />
            <KvRow
              label="Unit source"
              value={result.quoting.units.source}
              mono
            />
            <KvRow
              label="Entities"
              value={result.stats.entity_count.toLocaleString()}
              mono
            />
          </dl>
        </section>
      )}

      {parseNotes.length > 0 && (
        <aside className="header-panel__note" role="alert" data-testid="parse-quality-notes">
          <p className="header-panel__note-title">Parse notes</p>
          <ul className="header-panel__note-list">
            {parseNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      )}

      {importCheck.issues.length > 0 && (
        <aside className="header-panel__note" role="alert">
          <p className="header-panel__note-title">Import notes</p>
          <ul className="header-panel__note-list">
            {importCheck.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </aside>
      )}

      {importCheck.overall === "pass" && result && parseNotes.length === 0 && (
        <p className="header-panel__footnote">
          Header and geometry units agree. Safe to size stock and list holes.
        </p>
      )}
    </div>
  );
}

/** Run header inspect synchronously on file bytes. */
export function inspectHeaderFromBytes(bytes: ArrayBuffer): StepHeaderReport {
  return inspectStepHeader(bytes);
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="header-panel__meta-stat">
      <span className="header-panel__meta-label">{label}</span>
      <span className="header-panel__meta-value">{value}</span>
    </span>
  );
}

function MetaSep() {
  return <span className="header-panel__meta-sep" aria-hidden />;
}

function KvRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="header-sheet__row">
      <dt className="header-sheet__key">{label}</dt>
      <dd
        className={cn(
          "header-sheet__val",
          mono && "header-sheet__val--mono",
        )}
        title={value.length > 40 ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
