"use client";

import { useCallback, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";

import { usePageFileDrag } from "@/hooks/use-page-file-drag";
import { isStepFile } from "@/lib/cad-formats";
import {
  MAX_PARSE_FILE_BYTES,
  validateFileSize,
} from "@/lib/file-guardrails";
import { cn } from "@/lib/utils";

interface PageStepDropProps {
  children: ReactNode;
  enabled: boolean;
  /** Full-viewport idle target (landing). When false, only overlay while dragging. */
  fullscreen?: boolean;
  onFileSelected: (file: File) => void;
  onUnsupportedFormat?: (file: File) => void;
  onReject?: (reason: string) => void;
  idle: (ctx: { open: () => void; isDragActive: boolean }) => ReactNode;
}

export function PageStepDrop({
  children,
  enabled,
  fullscreen = false,
  onFileSelected,
  onUnsupportedFormat,
  onReject,
  idle,
}: PageStepDropProps) {
  const pageDragging = usePageFileDrag(enabled && !fullscreen);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!isStepFile(file.name)) {
        onUnsupportedFormat?.(file);
        return;
      }

      const sizeCheck = validateFileSize(file);
      if (!sizeCheck.ok) {
        onReject?.(sizeCheck.reason);
        return;
      }

      onFileSelected(file);
    },
    [onFileSelected, onUnsupportedFormat, onReject],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    disabled: !enabled,
    noClick: true,
    noKeyboard: true,
    maxSize: MAX_PARSE_FILE_BYTES,
    accept: {
      "application/step": [".step", ".stp", ".STEP", ".STP"],
      "model/step": [".step", ".stp"],
    },
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (!rejection) return;
      const tooLarge = rejection.errors.some((e) => e.code === "file-too-large");
      if (tooLarge) {
        onReject?.(
          `File exceeds the ${MAX_PARSE_FILE_BYTES / (1024 * 1024)} MB limit.`,
        );
        return;
      }
      onReject?.("Could not accept that file. Use a .step or .stp export.");
    },
  });

  const dragging = isDragActive || pageDragging;

  return (
    <>
      {fullscreen ? (
        <div
          {...getRootProps()}
          className={cn(
            "page-drop-idle",
            dragging && "page-drop-idle--dragging",
            !enabled && "page-drop-idle--disabled",
          )}
        >
          <input {...getInputProps()} aria-label="Upload STEP file" />
          {idle({ open, isDragActive: dragging })}
        </div>
      ) : (
        children
      )}

      {!fullscreen && dragging && (
        <div
          {...getRootProps()}
          className="page-drop-overlay"
          role="presentation"
        >
          <input {...getInputProps()} aria-label="Upload STEP file" />
          <div className="page-drop-overlay__inner">
            <p className="page-drop-overlay__title">Drop to open</p>
            <p className="page-drop-overlay__hint">.step · .stp</p>
          </div>
        </div>
      )}

      {fullscreen && dragging && (
        <div className="page-drop-overlay page-drop-overlay--idle" aria-hidden>
          <div className="page-drop-overlay__inner">
            <p className="page-drop-overlay__title">Release to parse</p>
            <p className="page-drop-overlay__hint">.step · .stp</p>
          </div>
        </div>
      )}
    </>
  );
}
