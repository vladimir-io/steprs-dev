"use client";

import { ChevronDown, ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  CAD_FORMATS,
  lookupCadFormat,
  type CadFormat,
} from "@/lib/cad-formats";
import { cn } from "@/lib/utils";

interface ConvertToStepProps {
  /** Non-STEP file the user dropped (e.g. part.sldprt). */
  fileName: string;
  onDismiss: () => void;
}

export function ConvertToStep({ fileName, onDismiss }: ConvertToStepProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");

  const highlighted = lookupCadFormat(fileName);

  const formats = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = CAD_FORMATS.filter((f) => f.id !== "step");
    if (highlighted && !q) {
      list = list.filter((f) => f.id !== highlighted.id);
    }
    if (!q) return list;
    return list.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.extensions.some((e) => e.includes(q)),
    );
  }, [query, highlighted]);

  return (
    <div
      className="glass-panel rounded-sm border-border"
      role="region"
      aria-label="Export to STEP guide"
    >
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left transition-colors hover:opacity-90"
          aria-expanded={open}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {highlighted
                ? `${highlighted.name} → STEP`
                : "This file isn't STEP"}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted">
              {fileName}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Dismiss export guide"
        >
          <X className="size-4" />
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {highlighted && highlighted.id !== "step" && (
            <FormatCard format={highlighted} active />
          )}

          {!highlighted && (
            <p className="text-xs leading-relaxed text-muted">
              Unknown extension. Export a{" "}
              <span className="font-mono text-foreground">.step</span> or{" "}
              <span className="font-mono text-foreground">.stp</span> from your
              CAD app, then drop it above.
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-muted">
            steprs reads ISO STEP in your browser. Export from your CAD app,
            in-browser conversion of proprietary formats isn&apos;t supported.
          </p>

          <input
            type="search"
            placeholder="Search format (e.g. SolidWorks, .ipt)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
          />

          <ul className="mt-3 max-h-[min(320px,40vh)] space-y-2 overflow-y-auto">
            {formats.map((fmt) => (
              <li key={fmt.id}>
                <FormatCard
                  format={fmt}
                  active={highlighted?.id === fmt.id}
                />
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Free desktop option:{" "}
            <a
              href="https://www.freecad.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              FreeCAD
              <ExternalLink className="size-3" />
            </a>{" "}
            . Open native file, File → Export → STEP.
          </p>
        </div>
      )}
    </div>
  );
}

function FormatCard({
  format,
  active,
}: {
  format: CadFormat;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        active
          ? "border-white/20 bg-white/[0.06]"
          : "border-border bg-black/20",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{format.name}</p>
        <p className="font-mono text-[10px] text-muted">
          {format.extensions.join(" ")}
        </p>
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
        {format.exportSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
