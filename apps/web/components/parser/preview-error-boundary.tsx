"use client";

import { Component, type ReactNode } from "react";

import { isBenignExtensionError } from "@/lib/benign-extension-errors";
import {
  isChunkLoadError,
  resetPreviewCanvasModuleCache,
} from "@/lib/preview/load-preview-canvas";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface PreviewErrorBoundaryState {
  error: Error | null;
}

/** Prevent HDR/network/GL failures from crashing the whole workspace. */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    if (isBenignExtensionError(error)) {
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isBenignExtensionError(error)) {
      console.warn("[preview] suppressed non-fatal extension error:", error);
      return;
    }
    console.error("[preview] viewer error:", error);
  }

  private handleRetry = () => {
    resetPreviewCanvasModuleCache();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const error = this.state.error;
      const chunkFailure = isChunkLoadError(error);

      return (
        this.props.fallback ?? (
          <div className="viewer-canvas viewer-canvas--empty flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted">
            <p>
              {chunkFailure
                ? "3D preview module failed to load."
                : `3D preview unavailable${error.message ? ` (${error.message})` : ""}.`}
            </p>
            <p className="text-xs text-muted-foreground">
              {chunkFailure
                ? "This usually clears after a refresh, especially right after a deploy or hot reload."
                : "Parsing and tools still work. Try disabling browser extensions if errors persist."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {chunkFailure ? (
                <button
                  type="button"
                  className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.04]"
                  onClick={() => window.location.reload()}
                >
                  Refresh page
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground hover:bg-white/[0.04]"
                  onClick={this.handleRetry}
                >
                  Retry preview
                </button>
              )}
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
