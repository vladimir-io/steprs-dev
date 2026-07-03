"use client";

import { track } from "@vercel/analytics";

import { productFlags } from "@/lib/product-flags";

type ParseEventProps = {
  fileSizeBucket: string;
  durationMs?: number;
  entityCount?: number;
  storageMode?: string;
  error?: string;
};

export function trackParseStarted(fileSizeBytes: number) {
  if (!productFlags.analyticsEnabled) return;

  const bucket =
    fileSizeBytes < 1024 * 1024
      ? "<1MB"
      : fileSizeBytes < 10 * 1024 * 1024
        ? "1-10MB"
        : fileSizeBytes < 50 * 1024 * 1024
          ? "10-50MB"
          : "50MB+";

  track("parse_started", { fileSizeBucket: bucket });
}

export function trackParseCompleted(props: ParseEventProps) {
  if (!productFlags.analyticsEnabled) return;

  track("parse_completed", {
    fileSizeBucket: props.fileSizeBucket,
    durationMs: props.durationMs ?? 0,
    entityCount: props.entityCount ?? 0,
    storageMode: props.storageMode ?? "unknown",
  });
}

export function trackParseError(message: string) {
  if (!productFlags.analyticsEnabled) return;

  track("parse_error", { message: message.slice(0, 120) });
}

export function getFileSizeBucket(fileSizeBytes: number): string {
  if (fileSizeBytes < 1024 * 1024) return "<1MB";
  if (fileSizeBytes < 10 * 1024 * 1024) return "1-10MB";
  if (fileSizeBytes < 50 * 1024 * 1024) return "10-50MB";
  return "50MB+";
}
