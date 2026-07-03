"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DropZoneIdle } from "@/components/parser/drop-zone";
import { PageStepDrop } from "@/components/parser/page-step-drop";
import { FileToast } from "@/components/ui/file-toast";
import {
  getFileSizeBucket,
  trackParseCompleted,
  trackParseError,
  trackParseStarted,
} from "@/lib/analytics/track";
import {
  sanitizeDisplayFilename,
  validateStepFile,
} from "@/lib/file-guardrails";
import { productFlags } from "@/lib/product-flags";
import {
  fetchSampleFile,
  getSamplePart,
  prefetchSampleParts,
  type SamplePartId,
} from "@/lib/sample-part";
import {
  buildRevisionSide,
  compareRevisions,
  type RevisionCompareReport,
} from "@/lib/revision-compare";
import { onWorkspaceReset } from "@/lib/workspace-reset";
import { cancelOcctPreview, preloadOcct } from "@/lib/preview/occt-client";
import { requestIdleCallback } from "@/lib/request-idle-callback";
import type { StepHeaderReport } from "@/lib/step-header";
import { createParserWorker } from "@/lib/wasm";
import type { ParseResult, WorkerOutboundMessage, ModelSnapshot } from "@steprs/ts-types";

import { readShareHash, clearShareHash } from "@/lib/preflight/share-report";
import type { SharedReportPayload } from "@/lib/preflight/share-report";

import { ConvertToStep } from "./convert-to-step";
import { SharedReportView } from "./shared-report-view";
import { ToolsWorkbench } from "./tools-workbench";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import {
  inspectHeaderFromBytes,
} from "./header-panel";
import type { ToolTabId } from "./tool-picker";
import {
  DEFAULT_WORKBENCH_TAB,
  pickWorkbenchTabForResult,
  readStoredWorkbenchTab,
  storeWorkbenchTab,
} from "@/lib/workbench-tab";

/** Fan mesh carries face_ranges for B-rep hole tinting — always on in production. */
const PARSE_OPTIONS = {
  include_mesh: true,
  include_labels: productFlags.editEnabled,
} as const;
const INIT_TIMEOUT_MS = 20_000;

export function ToolsWorkspace() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [stage, setStage] = useState("idle");
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [header, setHeader] = useState<StepHeaderReport | null>(null);
  const [headerInspectMs, setHeaderInspectMs] = useState<number>();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [fileSize, setFileSize] = useState<number>();
  const [activeTab, setActiveTabState] = useState<ToolTabId>(DEFAULT_WORKBENCH_TAB);
  const [unsupportedFile, setUnsupportedFile] = useState<string>();
  const [editorSnapshot, setEditorSnapshot] = useState<ModelSnapshot | null>(null);
  const [selectedFaceIds, setSelectedFaceIds] = useState<number[]>([]);
  const [hoveredToolHoleId, setHoveredToolHoleId] = useState<number | null>(null);
  const [fileSessionKey, setFileSessionKey] = useState(0);
  const [previewBytes, setPreviewBytes] = useState<ArrayBuffer | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareReport, setCompareReport] = useState<RevisionCompareReport | null>(
    null,
  );
  const [compareError, setCompareError] = useState<string | null>(null);
  const [sharedReport, setSharedReport] = useState<SharedReportPayload | null>(
    null,
  );

  useEffect(() => {
    if (activeTab !== "tools") {
      setHoveredToolHoleId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const payload = readShareHash();
    if (payload) {
      setSharedReport(payload);
      setActiveTabState("preflight");
    }
  }, []);
  const [pendingEditInstruction, setPendingEditInstruction] = useState<string | null>(
    null,
  );
  const requestIdRef = useRef(0);
  const activeParseRequestIdRef = useRef<string | null>(null);
  const fileSizeRef = useRef<number>(0);
  const readyRef = useRef(false);
  const progressRafRef = useRef<number>(0);
  const pendingProgressRef = useRef<string | null>(null);

  const showResults = (Boolean(result) && result?.success !== false) || isParsing;

  useEffect(() => {
    const worker = createParserWorker();

    const initTimer = window.setTimeout(() => {
      if (!readyRef.current) {
        setInitFailed(true);
        setReady(false);
        setError("Engine failed to start. Refresh the page and try again.");
      }
    }, INIT_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "ready":
          window.clearTimeout(initTimer);
          readyRef.current = true;
          setInitFailed(false);
          setReady(true);
          break;
        case "progress": {
          pendingProgressRef.current = message.stage;
          if (!progressRafRef.current) {
            progressRafRef.current = requestAnimationFrame(() => {
              progressRafRef.current = 0;
              const stageName = pendingProgressRef.current;
              if (!stageName) return;
              setStage(stageName);
              setCompletedStages((prev) =>
                prev.includes(stageName) ? prev : [...prev, stageName],
              );
            });
          }
          break;
        }
        case "result":
          if (message.id !== activeParseRequestIdRef.current) {
            break;
          }
          setIsParsing(false);
          if (!message.result.success) {
            setStage("error");
            setResult(null);
            setEditorSnapshot(null);
            setPreviewBytes(null);
            const failMsg =
              message.result.error ?? "Could not parse this STEP file.";
            setError(failMsg);
            trackParseError(failMsg);
            break;
          }
          setStage("complete");
          setCompletedStages(message.result.stats.stages_completed);
          setResult(message.result);
          setEditorSnapshot(message.snapshot ?? null);
          setSelectedFaceIds([]);
          setHoveredToolHoleId(null);
          {
            const nextTab = pickWorkbenchTabForResult(message.result);
            setActiveTabState(nextTab);
            storeWorkbenchTab(nextTab);
          }
          trackParseCompleted({
            fileSizeBucket: getFileSizeBucket(fileSizeRef.current),
            durationMs: message.result.stats.parse_duration_ms,
            entityCount: message.result.stats.entity_count,
            storageMode: message.result.stats.storage_mode,
          });
          break;
        case "error":
          if (message.id !== "init" && message.id !== activeParseRequestIdRef.current) {
            break;
          }
          setIsParsing(false);
          setStage("error");
          setError(message.message);
          if (message.id === "init") {
            window.clearTimeout(initTimer);
            setInitFailed(true);
            setReady(false);
          }
          trackParseError(message.message);
          break;
      }
    };

    worker.onerror = () => {
      window.clearTimeout(initTimer);
      setInitFailed(true);
      setReady(false);
      readyRef.current = false;
      setIsParsing(false);
      setError("Parser worker crashed. Refresh the page and try again.");
    };

    worker.postMessage({ type: "init" });
    workerRef.current = worker;

    return () => {
      window.clearTimeout(initTimer);
      worker.postMessage({ type: "editor_close", id: "cleanup" });
      worker.terminate();
    };
  }, []);

  const cancelWorker = useCallback(() => {
    workerRef.current?.postMessage({ type: "cancel" });
  }, []);

  const resetWorkspace = useCallback(() => {
    cancelOcctPreview();
    cancelWorker();
    workerRef.current?.postMessage({ type: "editor_close", id: "reset" });
    activeParseRequestIdRef.current = null;
    fileSizeRef.current = 0;
    setResult(null);
    setHeader(null);
    setHeaderInspectMs(undefined);
    setError(null);
    setFileName(undefined);
    setFileSize(undefined);
    setEditorSnapshot(null);
    setSelectedFaceIds([]);
    setHoveredToolHoleId(null);
    setPendingEditInstruction(null);
    setUnsupportedFile(undefined);
    setIsParsing(false);
    setStage("idle");
    setCompletedStages([]);
    setPreviewBytes(null);
    setCompareReport(null);
    setCompareError(null);
    setCompareBusy(false);
  }, [cancelWorker]);

  useEffect(() => onWorkspaceReset(resetWorkspace), [resetWorkspace]);

  useEffect(() => {
    setActiveTabState(
      readStoredWorkbenchTab({ editEnabled: productFlags.editEnabled }),
    );
  }, []);

  const setActiveTab = useCallback((tab: ToolTabId) => {
    setActiveTabState(tab);
    storeWorkbenchTab(tab);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void prefetchSampleParts();
  }, [ready]);

  const warmPreviewStack = useCallback(() => {
    void preloadOcct().catch(() => undefined);
  }, []);

  const parseBytesQuietly = useCallback(
    async (file: File, bytes: ArrayBuffer): Promise<ParseResult> => {
      const worker = workerRef.current;
      if (!worker || !ready) {
        throw new Error("Engine is not ready");
      }

      return new Promise<ParseResult>((resolve, reject) => {
        const id = `compare-${++requestIdRef.current}`;
        const timeout = window.setTimeout(() => {
          worker.removeEventListener("message", onMessage);
          reject(new Error("Compare parse timed out"));
        }, 60_000);

        const onMessage = (event: MessageEvent<WorkerOutboundMessage>) => {
          const message = event.data;
          if (!("id" in message) || message.id !== id) return;
          if (message.type === "result") {
            window.clearTimeout(timeout);
            worker.removeEventListener("message", onMessage);
            if (!message.result.success) {
              reject(
                new Error(
                  message.result.error ?? "Could not parse this STEP file.",
                ),
              );
              return;
            }
            resolve(message.result);
          }
          if (message.type === "error") {
            window.clearTimeout(timeout);
            worker.removeEventListener("message", onMessage);
            reject(new Error(message.message));
          }
        };

        worker.addEventListener("message", onMessage);
        cancelWorker();
        const workerBytes = bytes.slice(0);
        worker.postMessage(
          {
            type: "parse",
            id,
            bytes: workerBytes,
            options: PARSE_OPTIONS,
            openEditor: false,
            fileName: file.name,
          },
          [workerBytes],
        );
      });
    },
    [ready, cancelWorker],
  );

  const runParse = useCallback(
    async (file: File, bytes: ArrayBuffer) => {
      if (!workerRef.current || !ready) return;

      const headerStart = performance.now();
      requestIdleCallback(
        () => {
          setHeader(inspectHeaderFromBytes(bytes));
          setHeaderInspectMs(performance.now() - headerStart);
        },
        { timeout: 500 },
      );

      setError(null);
      setResult(null);
      setPreviewBytes(bytes.slice(0));
      setEditorSnapshot(null);
      setSelectedFaceIds([]);
      setHoveredToolHoleId(null);
      setCompletedStages([]);
      setIsParsing(true);
      setStage("reading file");
      trackParseStarted(file.size);

      const id = String(++requestIdRef.current);
      activeParseRequestIdRef.current = id;
      cancelWorker();

      const workerBytes = bytes.slice(0);
      workerRef.current.postMessage(
        {
          type: "parse",
          id,
          bytes: workerBytes,
          options: PARSE_OPTIONS,
          openEditor: productFlags.editEnabled,
          fileName: file.name,
        },
        [workerBytes],
      );
    },
    [ready, cancelWorker],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      if (!workerRef.current) return;

      if (!ready) {
        setError("Engine is still starting. Wait a moment and try again.");
        return;
      }

      setUnsupportedFile(undefined);
      setSharedReport(null);
      clearShareHash();

      const validation = await validateStepFile(file);
      if (!validation.ok) {
        setError(validation.reason);
        return;
      }

      setFileName(sanitizeDisplayFilename(file.name));
      setFileSize(file.size);
      fileSizeRef.current = file.size;

      setFileSessionKey((key) => key + 1);
      setResult(null);
      setEditorSnapshot(null);
      setHeader(null);

      warmPreviewStack();
      await runParse(file, validation.bytes);
    },
    [ready, runParse, warmPreviewStack],
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      await ingestFile(file);
    },
    [ingestFile],
  );

  const handleUnsupportedFormat = useCallback(
    (file: File) => {
      cancelWorker();
      setUnsupportedFile(sanitizeDisplayFilename(file.name));
      setFileName(sanitizeDisplayFilename(file.name));
      setFileSize(file.size);
      setResult(null);
      setError(null);
      setIsParsing(false);
      setStage("idle");
      setCompletedStages([]);
    },
    [cancelWorker],
  );

  const handleDismissConvertGuide = useCallback(() => {
    setUnsupportedFile(undefined);
  }, []);

  const handleTrySample = useCallback(
    async (sampleId: SamplePartId) => {
      if (!ready || initFailed) {
        if (!ready && !initFailed) {
          setError("Engine is still starting. Wait a moment and try again.");
        }
        return;
      }

      const sample = getSamplePart(sampleId);
      if (!sample) return;

      try {
        const file = await fetchSampleFile(sample);
        setUnsupportedFile(undefined);
        await ingestFile(file);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load sample file",
        );
      }
    },
    [ready, initFailed, ingestFile],
  );

  const handleCompareRevisions = useCallback(
    async (baselineFile: File, revisionFile: File) => {
      if (!ready || initFailed) {
        setCompareError("Engine is not ready yet.");
        return;
      }

      setCompareBusy(true);
      setCompareError(null);
      setCompareReport(null);

      try {
        const [baselineValidation, revisionValidation] = await Promise.all([
          validateStepFile(baselineFile),
          validateStepFile(revisionFile),
        ]);

        if (!baselineValidation.ok) {
          throw new Error(`Baseline: ${baselineValidation.reason}`);
        }
        if (!revisionValidation.ok) {
          throw new Error(`Revision: ${revisionValidation.reason}`);
        }

        const baselineHeader = inspectHeaderFromBytes(baselineValidation.bytes);
        const revisionHeader = inspectHeaderFromBytes(revisionValidation.bytes);

        const baselineResult = await parseBytesQuietly(
          baselineFile,
          baselineValidation.bytes,
        );
        const revisionResult = await parseBytesQuietly(
          revisionFile,
          revisionValidation.bytes,
        );

        const report = compareRevisions(
          buildRevisionSide(
            sanitizeDisplayFilename(baselineFile.name),
            baselineFile.size,
            baselineResult,
            baselineHeader,
          ),
          buildRevisionSide(
            sanitizeDisplayFilename(revisionFile.name),
            revisionFile.size,
            revisionResult,
            revisionHeader,
          ),
        );
        setCompareReport(report);
      } catch (err) {
        setCompareError(
          err instanceof Error ? err.message : "Could not compare revisions",
        );
      } finally {
        setCompareBusy(false);
      }
    },
    [ready, initFailed, parseBytesQuietly],
  );

  const handleClearCompare = useCallback(() => {
    setCompareReport(null);
    setCompareError(null);
  }, []);

  if (!ready && !initFailed) {
    return (
      <section id="parser" data-loaded="true" className="tools-workspace">
        <WorkspaceSkeleton />
      </section>
    );
  }

  if (sharedReport && !showResults) {
    return (
      <section
        id="parser"
        data-loaded="true"
        className="tools-workspace tools-workspace--shared"
      >
        <div className="shared-report-shell">
          <SharedReportView
            payload={sharedReport}
            onCheckOwnFile={() => {
              clearShareHash();
              setSharedReport(null);
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      id="parser"
      data-loaded={showResults ? "true" : "false"}
      className="tools-workspace"
    >
      <PageStepDrop
        enabled={!isParsing && ready && !initFailed}
        fullscreen={!showResults}
        onFileSelected={handleFileSelected}
        onUnsupportedFormat={handleUnsupportedFormat}
        onReject={setError}
        idle={({ open, isDragActive }) => (
          <DropZoneIdle
            onBrowse={open}
            onTrySample={handleTrySample}
            onCompareRevisions={handleCompareRevisions}
            compareBusy={compareBusy}
            compareReport={compareReport}
            compareError={compareError}
            onClearCompare={handleClearCompare}
            isParsing={isParsing}
            isReady={ready}
            initFailed={initFailed}
            isDragActive={isDragActive}
            fileName={fileName}
            fileSize={fileSize}
          />
        )}
      >
        {showResults && (
          <ToolsWorkbench
            result={result}
            isParsing={isParsing}
            stage={stage}
            completedStages={completedStages}
            fileName={fileName}
            fileSize={fileSize}
            fileSessionKey={fileSessionKey}
            previewBytes={previewBytes}
            header={header}
            headerInspectMs={headerInspectMs}
            editorSnapshot={editorSnapshot}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedFaceIds={selectedFaceIds}
            onFaceClick={(faceId) => {
              setSelectedFaceIds((prev) =>
                prev.includes(faceId)
                  ? prev.filter((id) => id !== faceId)
                  : [...prev, faceId],
              );
            }}
            onSelectionChange={setSelectedFaceIds}
            pendingEditInstruction={pendingEditInstruction}
            onPendingInstructionConsumed={() => setPendingEditInstruction(null)}
            onSnapshotChange={(snap, parse) => {
              setEditorSnapshot(snap);
              setResult(parse);
            }}
            onError={setError}
            onFileSelected={handleFileSelected}
            worker={workerRef.current}
            hoveredToolHoleId={hoveredToolHoleId}
            onHoverToolHole={setHoveredToolHoleId}
          />
        )}
      </PageStepDrop>

      {unsupportedFile && (
        <ConvertToStep
          fileName={unsupportedFile}
          onDismiss={handleDismissConvertGuide}
        />
      )}

      {error && (
        <FileToast message={error} onDismiss={() => setError(null)} />
      )}
    </section>
  );
}
