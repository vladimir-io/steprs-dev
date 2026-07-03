"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { HomeHero } from "@/components/home/hero";
import { SampleGallery } from "@/components/home/sample-gallery";
import { WorkflowSteps } from "@/components/home/workflow-steps";
import { Button } from "@/components/ui/button";
import { isStepFile } from "@/lib/cad-formats";
import { maxUploadLabelMb } from "@/lib/file-guardrails";
import { sanitizeDisplayFilename } from "@/lib/file-guardrails";
import type { SamplePartId } from "@/lib/sample-part";
import type { RevisionCompareReport } from "@/lib/revision-compare";
import { cn, formatBytes } from "@/lib/utils";

interface DropZoneIdleProps {
  onBrowse: () => void;
  onTrySample?: (id: SamplePartId) => void;
  onCompareRevisions?: (baseline: File, revision: File) => void;
  compareBusy?: boolean;
  compareReport?: RevisionCompareReport | null;
  compareError?: string | null;
  onClearCompare?: () => void;
  isParsing: boolean;
  isReady: boolean;
  initFailed?: boolean;
  isDragActive?: boolean;
  fileName?: string;
  fileSize?: number;
}

function UploadGlyph() {
  return (
    <svg
      className="drop-stage__glyph"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 16V8m0 0-3.5 3.5M12 8l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17.5v1A2.5 2.5 0 007.5 21h9a2.5 2.5 0 002.5-2.5v-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DropZoneIdle({
  onBrowse,
  onTrySample,
  onCompareRevisions,
  compareBusy = false,
  compareReport = null,
  compareError,
  onClearCompare,
  isParsing,
  isReady,
  initFailed = false,
  isDragActive = false,
  fileName,
  fileSize,
}: DropZoneIdleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const status = !mounted
    ? "Starting…"
    : initFailed
      ? "Engine failed to load"
      : !isReady
        ? "Starting engine…"
        : isParsing
          ? "Parsing…"
          : isDragActive
            ? "Release to parse"
            : "Drop STEP file";

  const showLoader =
    !mounted || isParsing || (!isReady && !initFailed);

  const engineBusy = !isReady || isParsing || compareBusy;

  return (
    <div className="page-drop-idle__content landing-layout landing-layout--cinematic">
      <div className="landing-layout__stage">
        <div
          className={cn(
            "drop-stage reveal-delay-1",
            isDragActive && "drop-stage--active",
            showLoader && "drop-stage--loading",
            mounted && isReady && !isParsing && !isDragActive && "drop-stage--browse",
          )}
          onClick={() => {
            if (!mounted || !isReady || isParsing || isDragActive || initFailed) return;
            onBrowse();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            if (!mounted || !isReady || isParsing || isDragActive || initFailed) return;
            e.preventDefault();
            onBrowse();
          }}
          role="presentation"
        >
          <div className="drop-stage__aurora" aria-hidden />
          <div className="drop-stage__glow" aria-hidden />
          <div className="drop-stage__sheen" aria-hidden />

          <div className="drop-stage__body">
            {showLoader ? (
              <div className="drop-stage__loader">
                <BrandLoader
                  size={isParsing ? "md" : "lg"}
                  label={status}
                />
              </div>
            ) : (
              <>
                <header className="drop-stage__meta">
                  <span className="drop-stage__formats">.step · .stp · {maxUploadLabelMb()} MB</span>
                </header>

                <div className="drop-stage__center">
                  <div className="drop-stage__icon-ring" aria-hidden>
                    <UploadGlyph />
                  </div>

                  <p className="drop-stage__title">{status}</p>
                </div>

                {initFailed && (
                  <p className="drop-stage__hint">
                    WASM bundle missing from <code>/wasm/</code>
                  </p>
                )}

                {mounted && isReady && !isParsing && !isDragActive && (
                  <footer className="drop-stage__footer">
                    <Button
                      type="button"
                      variant="glow"
                      size="lg"
                      className="drop-stage__btn drop-stage__btn--primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBrowse();
                      }}
                    >
                      Browse file
                    </Button>
                  </footer>
                )}
              </>
            )}
          </div>
        </div>

        {!isDragActive && !showLoader && mounted && isReady && (
          <p className="drop-stage__trust">
            <strong>Your files never leave your machine.</strong> 100% local Rust
            WebAssembly.
          </p>
        )}

        {!isDragActive && !showLoader && onTrySample && (
          <SampleGallery
            onSelect={onTrySample}
            disabled={engineBusy || initFailed}
            className="landing-layout__samples"
          />
        )}
      </div>

      {!isDragActive && !showLoader && (
        <div className="landing-layout__mast reveal">
          <HomeHero />
          <WorkflowSteps />
        </div>
      )}

      {!isDragActive && !showLoader && (
        <Link
          href="/faq"
          className="landing-details landing-details--ghost landing-details--link"
          onClick={(e) => e.stopPropagation()}
        >
          FAQ
        </Link>
      )}

      {fileName && !isDragActive && (
        <p className="page-drop-idle__file">
          <span
            className={cn(
              "page-drop-idle__dot",
              isStepFile(fileName) && "page-drop-idle__dot--ok",
            )}
          />
          {sanitizeDisplayFilename(fileName)}
          {fileSize !== undefined ? ` · ${formatBytes(fileSize)}` : ""}
        </p>
      )}
    </div>
  );
}
