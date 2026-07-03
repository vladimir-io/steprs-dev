"use client";

import { useCallback, useState } from "react";

import { buildLlmContextGraph, hasLlmContextGraph } from "@/lib/aag-prompt";
import { cn } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

interface LlmHandoffCopyButtonProps {
  result: ParseResult;
  fileName?: string;
  className?: string;
  variant?: "primary" | "default";
  onCopied?: () => void;
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      aria-hidden
    >
      <rect
        x="5.25"
        y="4.25"
        width="7.5"
        height="9"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M4.75 11.75H4.25A1.25 1.25 0 013 10.5V3.25A1.25 1.25 0 014.25 2h7.25A1.25 1.25 0 0112.75 3.25V3.75"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LlmHandoffCopyButton({
  result,
  fileName,
  className,
  variant = "default",
  onCopied,
}: LlmHandoffCopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const enabled = hasLlmContextGraph(result);

  const copy = useCallback(async () => {
    if (!enabled) return;
    try {
      await navigator.clipboard.writeText(
        buildLlmContextGraph(result, { fileName }),
      );
      setState("copied");
      onCopied?.();
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2800);
    }
  }, [enabled, result, fileName, onCopied]);

  const label =
    state === "copied"
      ? "Copied. Paste where needed"
      : state === "error"
        ? "Copy failed"
        : "Copy AAG + facts";

  return (
    <button
      type="button"
      className={cn(
        "llm-handoff-copy",
        variant === "primary" && "llm-handoff-copy--primary",
        className,
      )}
      disabled={!enabled}
      title={
        enabled
          ? "Machining facts and topology graph only. No mesh or STEP file."
          : "Load a STEP file to build an AAG export"
      }
      onClick={copy}
    >
      <ClipboardIcon className="llm-handoff-copy__icon" />
      <span className="llm-handoff-copy__label">{label}</span>
    </button>
  );
}

/** @deprecated Use LlmHandoffCopyButton */
export const CopyLlmContextButton = LlmHandoffCopyButton;
