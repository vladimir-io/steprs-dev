"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { meshReadyForPreview } from "@/lib/preview/mesh-ready";
import { robustBoundingBoxFromMesh } from "@/lib/analysis/envelope";
import {
  cancelOcctPreview,
  tessellateWithOcct,
} from "@/lib/preview/occt-client";
import { ViewerLoader } from "@/components/brand/viewer-loader";
import { PreviewErrorBoundary } from "@/components/parser/preview-error-boundary";
import { loadPreviewCanvasComponent } from "@/lib/preview/load-preview-canvas";
import type { FramingMode } from "@/components/parser/part-camera-framing";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { BoundingBox, MachiningHole, ParseResult, TessellatedMesh } from "@steprs/ts-types";

const PreviewCanvas = dynamic(() => loadPreviewCanvasComponent(), {
  ssr: false,
  loading: () => <ViewerLoader label="Loading viewer" />,
});

interface PartViewerProps {
  result: ParseResult | null;
  isParsing: boolean;
  fileName?: string;
  /** Raw STEP bytes for occt-import-js preview tessellation. */
  previewBytes?: ArrayBuffer | null;
  previewSessionKey?: number;
  pickable?: boolean;
  onFaceClick?: (faceId: number) => void;
  /** Face ids to tint — fan mesh with face_ranges (edit or hole hover). */
  selectedFaceIds?: number[];
  faceHighlightKind?: "selection" | "hole";
  highlightedHoleId?: number | null;
  highlightHoles?: MachiningHole[];
  compact?: boolean;
}

function envelopeFromMesh(mesh: TessellatedMesh): BoundingBox | null {
  if (!mesh.positions?.length) return null;
  return robustBoundingBoxFromMesh(mesh.positions);
}

export function PartViewer({
  result,
  isParsing,
  fileName,
  previewBytes,
  previewSessionKey = 0,
  pickable,
  selectedFaceIds,
  faceHighlightKind,
  onFaceClick,
  highlightedHoleId = null,
  highlightHoles,
  compact = false,
}: PartViewerProps) {
  const [occtMesh, setOcctMesh] = useState<TessellatedMesh | null>(null);
  const [occtLoading, setOcctLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [framingKey, setFramingKey] = useState(0);
  const [framingMode, setFramingMode] = useState<FramingMode>("home");
  const occtLoadKeyRef = useRef<string | null>(null);
  const framedSessionRef = useRef<number | null>(null);

  const fanMesh = result?.mesh;
  const fanMeshReady = meshReadyForPreview(fanMesh);
  const hasFaceRanges = (fanMesh?.face_ranges?.length ?? 0) > 0;
  const needsBrepMesh = hasFaceRanges && !!pickable;

  // Load OCCT once per file — never cancelled on tab/highlight changes.
  useEffect(() => {
    if (!result) {
      occtLoadKeyRef.current = null;
      setOcctMesh(null);
      setOcctLoading(false);
      setPreviewError(null);
      framedSessionRef.current = null;
      return;
    }

    if (!previewBytes?.byteLength) {
      occtLoadKeyRef.current = null;
      setOcctMesh(null);
      setOcctLoading(false);
      return;
    }

    const loadKey = `${previewSessionKey}:${previewBytes.byteLength}`;
    if (occtLoadKeyRef.current === loadKey) return;

    occtLoadKeyRef.current = loadKey;
    let cancelled = false;
    setOcctLoading(true);
    setPreviewError(null);

    void tessellateWithOcct(previewBytes)
      .then((mesh) => {
        if (cancelled) return;
        setOcctMesh(mesh);
        setOcctLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled || err.message === "Preview superseded") return;
        setOcctLoading(false);
        if (!meshReadyForPreview(fanMesh)) {
          setPreviewError(err.message);
        }
      });

    return () => {
      cancelled = true;
      cancelOcctPreview();
    };
  }, [result, previewBytes, previewSessionKey, fanMesh]);

  const displayMesh = useMemo(() => {
    if (needsBrepMesh && fanMeshReady) return fanMesh!;
    if (occtMesh) return occtMesh;
    if (fanMeshReady) return fanMesh!;
    return null;
  }, [needsBrepMesh, fanMesh, fanMeshReady, occtMesh]);

  // Re-frame camera only when a new file session gets its first mesh.
  useEffect(() => {
    if (!displayMesh) return;
    if (framedSessionRef.current === previewSessionKey) return;
    framedSessionRef.current = previewSessionKey;
    setFramingMode("home");
    setFramingKey((k) => k + 1);
  }, [displayMesh, previewSessionKey]);

  const viewportBbox = useMemo(() => {
    if (displayMesh?.positions?.length) {
      return envelopeFromMesh(displayMesh) ?? undefined;
    }
    return undefined;
  }, [displayMesh]);

  if (!result && !isParsing) return null;

  const previewLoading = occtLoading && !displayMesh;
  const hasMesh =
    displayMesh &&
    (displayMesh.triangle_count > 0 || (displayMesh.edge_segment_count ?? 0) > 0);
  const hasSolid = displayMesh && displayMesh.triangle_count > 0;
  const useFanPick =
    pickable &&
    (displayMesh?.face_ranges?.length ?? 0) > 0 &&
    displayMesh?.mesh_engine !== "occt";

  const statsLabel =
    hasMesh &&
    (hasSolid
      ? `${displayMesh!.triangle_count.toLocaleString()} tris`
      : `${(displayMesh!.edge_segment_count ?? 0).toLocaleString()} edges`);

  const canvas = (
    <>
      {(isParsing || previewLoading) && !hasMesh && (
        <ViewerLoader label={isParsing ? "Parsing geometry" : "Building preview"} />
      )}
      {hasMesh && (
        <PreviewErrorBoundary>
          <PreviewCanvas
            mesh={displayMesh!}
            bbox={viewportBbox}
            pickable={useFanPick}
            selectedFaceIds={selectedFaceIds}
            faceHighlightKind={faceHighlightKind}
            onFaceClick={onFaceClick}
            highlightedHoleId={highlightedHoleId}
            highlightHoles={highlightHoles}
            meshEngine={displayMesh!.mesh_engine}
            framingKey={`session-${previewSessionKey}-${framingKey}`}
            framingMode={framingMode}
            onCenter={() => {
              setFramingMode("view");
              setFramingKey((k) => k + 1);
            }}
            showCenterButton
          />
        </PreviewErrorBoundary>
      )}
      {!hasMesh && !isParsing && !previewLoading && (
        <div className="viewer-canvas viewer-canvas--empty">
          {previewError ?? "No preview mesh available."}
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="viewer-shell">
        <div className="viewer-shell__overlay">
          {statsLabel && (
            <span className="viewer-shell__stat">{statsLabel}</span>
          )}
          {displayMesh?.mesh_engine && (
            <span className="viewer-shell__stat">{displayMesh.mesh_engine}</span>
          )}
          {result && (
            <span className="viewer-shell__stat">
              {formatNumber(result.stats.parse_duration_ms, 0)} ms
            </span>
          )}
          {displayMesh?.truncated && (
            <span className="viewer-shell__stat viewer-shell__stat--warn">
              capped
            </span>
          )}
        </div>
        {canvas}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden rounded-sm border-border">
      <CardHeader className="border-border px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {fileName ? fileName : "Part model"}
              {result &&
                ` · ${formatNumber(result.stats.parse_duration_ms, 0)} ms`}
              {displayMesh?.mesh_engine ? ` · ${displayMesh.mesh_engine}` : ""}
            </CardDescription>
          </div>
          {hasMesh && (
            <p className="font-mono text-xs text-muted">
              {hasSolid
                ? `${displayMesh!.triangle_count.toLocaleString()} triangles`
                : `${(displayMesh!.edge_segment_count ?? 0).toLocaleString()} edges · wireframe`}
              {displayMesh!.truncated ? " · capped" : ""}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">{canvas}</CardContent>
    </Card>
  );
}
