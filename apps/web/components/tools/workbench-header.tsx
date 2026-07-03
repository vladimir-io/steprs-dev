"use client";

import { useMemo } from "react";
import type { RefObject } from "react";

import { buildParseSummary } from "@/lib/analysis/parse-summary";
import { buildTriageProgress, type TriageStepId } from "@/lib/analysis/triage-progress";
import type { StepHeaderReport } from "@/lib/step-header";
import { formatBytes } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

import { ExportMenu } from "./export-menu";
import { TriageChecklist } from "./triage-checklist";
import type { ToolTabId } from "./tool-picker";

interface WorkbenchHeaderProps {
  fileName?: string;
  fileSize?: number;
  result: ParseResult | null;
  header: StepHeaderReport | null;
  activeTab: ToolTabId;
  visitedTabs: ReadonlySet<ToolTabId>;
  exported: boolean;
  isParsing: boolean;
  onTabChange: (tab: ToolTabId) => void;
  onExportOpen: () => void;
  onExported: () => void;
  onReplace: () => void;
  exportTriggerRef?: RefObject<HTMLButtonElement | null>;
}

export function WorkbenchHeader({
  fileName,
  fileSize,
  result,
  header,
  activeTab,
  visitedTabs,
  exported,
  isParsing,
  onTabChange,
  onExportOpen,
  onExported,
  onReplace,
  exportTriggerRef,
}: WorkbenchHeaderProps) {
  const profile = useMemo(() => {
    if (!result) return null;
    return buildParseSummary(result, fileName);
  }, [result, fileName]);

  const triageSteps = useMemo(
    () =>
      buildTriageProgress({
        result,
        header,
        activeTab,
        visitedTabs,
        exported,
      }),
    [result, header, activeTab, visitedTabs, exported],
  );

  const handleTriageSelect = (id: TriageStepId) => {
    const step = triageSteps.find((s) => s.id === id);
    if (id === "export") {
      onExportOpen();
      return;
    }
    if (step?.tab) onTabChange(step.tab);
  };

  return (
    <header className="workbench-header">
      <div className="workbench-header__primary">
        <div className="workbench-header__file">
          <span className="workbench-header__dot" aria-hidden />
          <span className="workbench-header__filename">{fileName ?? "Part"}</span>
          {fileSize != null && (
            <span className="workbench-header__meta">{formatBytes(fileSize)}</span>
          )}
          {result && (
            <span className="workbench-header__meta">
              {result.stats.parse_duration_ms.toFixed(0)} ms
            </span>
          )}
        </div>

        {profile && (
          <div className="workbench-header__part">
            <span className="workbench-header__title">{profile.title}</span>
            <span className="workbench-header__envelope">{profile.summary}</span>
            {profile.features && profile.features.length > 0 && (
              <ul className="workbench-header__chips" aria-label="Detected features">
                {profile.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {result && (
        <TriageChecklist
          className="workbench-header__triage"
          steps={triageSteps}
          onStepSelect={handleTriageSelect}
        />
      )}

      <div className="workbench-header__actions">
        {result && (
          <ExportMenu
            triggerRef={exportTriggerRef}
            fileName={fileName}
            fileSize={fileSize}
            result={result}
            header={header}
            disabled={isParsing}
            onExported={onExported}
          />
        )}
        <button
          type="button"
          className="workbench-header__replace"
          onClick={onReplace}
          disabled={isParsing}
        >
          Replace file
        </button>
      </div>

    </header>
  );
}
