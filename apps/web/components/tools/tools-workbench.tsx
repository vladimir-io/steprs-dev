"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { productFlags } from "@/lib/product-flags";

import { ParseProgress } from "@/components/parser/parse-progress";
import { cn } from "@/lib/utils";
import type { ModelSnapshot, ParseResult } from "@steprs/ts-types";

import { AagPanel } from "./aag-panel";
import { EditComingSoonPanel } from "./edit-coming-soon-panel";
import { PartViewer } from "./part-viewer";
import { HeaderPanel } from "./header-panel";
import type { StepHeaderReport } from "@/lib/step-header";
import { StockSizerPanel } from "./stock-sizer-panel";
import { ToolMapperPanel } from "./tool-mapper-panel";
import { ToolPicker, type ToolTabId } from "./tool-picker";
import { WorkbenchHeader } from "./workbench-header";

const TRIAGE_TABS: ToolTabId[] = ["schema", "tools", "stock"];

interface ToolsWorkbenchProps {
  result: ParseResult | null;
  isParsing: boolean;
  stage: string;
  completedStages: string[];
  fileName?: string;
  fileSize?: number;
  fileSessionKey?: number;
  previewBytes?: ArrayBuffer | null;
  header: StepHeaderReport | null;
  headerInspectMs?: number;
  editorSnapshot: ModelSnapshot | null;
  activeTab: ToolTabId;
  onTabChange: (tab: ToolTabId) => void;
  selectedFaceIds: number[];
  onFaceClick: (faceId: number) => void;
  onSelectionChange: (ids: number[]) => void;
  pendingEditInstruction: string | null;
  onPendingInstructionConsumed: () => void;
  onSnapshotChange: (snap: ModelSnapshot, parse: ParseResult) => void;
  onError: (message: string) => void;
  onFileSelected: (file: File) => void;
  worker: Worker | null;
  hoveredToolHoleId?: number | null;
  onHoverToolHole?: (holeId: number | null) => void;
}

export function ToolsWorkbench({
  result,
  isParsing,
  stage,
  completedStages,
  fileName,
  fileSize,
  fileSessionKey = 0,
  previewBytes = null,
  header,
  headerInspectMs,
  editorSnapshot,
  activeTab,
  onTabChange,
  selectedFaceIds,
  onFaceClick,
  onSelectionChange,
  pendingEditInstruction,
  onPendingInstructionConsumed,
  onSnapshotChange,
  onError,
  onFileSelected,
  worker,
  hoveredToolHoleId = null,
  onHoverToolHole,
}: ToolsWorkbenchProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<ToolTabId>>(() => new Set());
  const [exported, setExported] = useState(false);
  const editEnabled = productFlags.editEnabled;

  useEffect(() => {
    setVisitedTabs(new Set());
    setExported(false);
  }, [fileSessionKey]);

  useEffect(() => {
    if (!TRIAGE_TABS.includes(activeTab)) return;
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const viewerFaceHighlight =
    editEnabled && activeTab === "edit" ? selectedFaceIds : [];

  const handleReplace = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleExportOpen = useCallback(() => {
    exportTriggerRef.current?.click();
  }, []);

  return (
    <div className="workbench fade-in">
      <WorkbenchHeader
        fileName={fileName}
        fileSize={fileSize}
        result={result}
        header={header}
        activeTab={activeTab}
        visitedTabs={visitedTabs}
        exported={exported}
        isParsing={isParsing}
        onTabChange={onTabChange}
        onExportOpen={handleExportOpen}
        onExported={() => setExported(true)}
        onReplace={handleReplace}
        exportTriggerRef={exportTriggerRef}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".step,.stp,.STEP,.STP"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = "";
        }}
      />

      {isParsing && (
        <ParseProgress stage={stage} completedStages={completedStages} />
      )}

      <div className="workbench__body">
        <div className="workbench__viewer">
          <PartViewer
            key={fileSessionKey}
            result={result}
            isParsing={isParsing}
            fileName={fileName}
            previewBytes={previewBytes}
            previewSessionKey={fileSessionKey}
            pickable={editEnabled && activeTab === "edit"}
            selectedFaceIds={viewerFaceHighlight}
            faceHighlightKind={
              editEnabled && activeTab === "edit" ? "selection" : undefined
            }
            onFaceClick={onFaceClick}
            compact
            highlightedHoleId={
              activeTab === "tools" ? hoveredToolHoleId : null
            }
            highlightHoles={result?.quoting?.holes}
          />
        </div>

        <aside className="workbench__rail">
          <ToolPicker
            active={activeTab}
            onChange={onTabChange}
            variant="segment"
            editEnabled={editEnabled}
          />

          <div
            className={
              activeTab === "edit"
                ? "workbench__panel workbench__panel--edit"
                : "workbench__panel workbench__panel--analysis"
            }
          >
            <WorkbenchTabPanels
              active={activeTab}
              editEnabled={editEnabled}
              result={result}
              isParsing={isParsing}
              fileName={fileName}
              header={header}
              headerInspectMs={headerInspectMs}
              editorSnapshot={editorSnapshot}
              hoveredToolHoleId={hoveredToolHoleId}
              onHoverToolHole={onHoverToolHole}
              worker={worker}
              selectedFaceIds={selectedFaceIds}
              pendingEditInstruction={pendingEditInstruction}
              onPendingInstructionConsumed={onPendingInstructionConsumed}
              onSelectionChange={onSelectionChange}
              onSnapshotChange={onSnapshotChange}
              onError={onError}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkbenchTabPanels({
  active,
  editEnabled,
  result,
  isParsing,
  fileName,
  header,
  headerInspectMs,
  editorSnapshot,
  hoveredToolHoleId,
  onHoverToolHole,
  worker,
  selectedFaceIds,
  pendingEditInstruction,
  onPendingInstructionConsumed,
  onSelectionChange,
  onSnapshotChange,
  onError,
}: {
  active: ToolTabId;
  editEnabled: boolean;
  result: ParseResult | null;
  isParsing: boolean;
  fileName?: string;
  header: StepHeaderReport | null;
  headerInspectMs?: number;
  editorSnapshot: ModelSnapshot | null;
  hoveredToolHoleId: number | null;
  onHoverToolHole?: (holeId: number | null) => void;
  worker: Worker | null;
  selectedFaceIds: number[];
  pendingEditInstruction: string | null;
  onPendingInstructionConsumed: () => void;
  onSelectionChange: (ids: number[]) => void;
  onSnapshotChange: (snap: ModelSnapshot, parse: ParseResult) => void;
  onError: (message: string) => void;
}) {
  const layers: { id: ToolTabId; node: ReactNode }[] = [
    {
      id: "schema",
      node: (
        <HeaderPanel
          header={header}
          result={result}
          inspectMs={headerInspectMs}
          editorSnapshot={editorSnapshot}
        />
      ),
    },
    {
      id: "tools",
      node: (
        <ToolMapperPanel
          result={result}
          isParsing={isParsing}
          hoveredHoleId={hoveredToolHoleId}
          onHoverHole={onHoverToolHole}
        />
      ),
    },
    {
      id: "stock",
      node: (
        <StockSizerPanel result={result} isParsing={isParsing} />
      ),
    },
    {
      id: "aag",
      node: (
        <AagPanel result={result} isParsing={isParsing} fileName={fileName} />
      ),
    },
    {
      id: "edit",
      node: <EditComingSoonPanel />,
    },
  ];

  return (
    <div className="workbench-panels-stack">
      {layers.map(({ id, node }) => {
        const isActive = active === id;
        return (
          <div
            key={id}
            role="tabpanel"
            id={`panel-${id}`}
            aria-labelledby={`tab-${id}`}
            aria-hidden={!isActive}
            inert={!isActive || undefined}
            className={cn(
              "workbench-panel",
              "workbench-panel-layer",
              isActive && "workbench-panel-layer--active",
            )}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}
