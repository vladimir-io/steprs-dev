"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ToolTabId = "stock" | "schema" | "tools" | "aag" | "edit";

const ANALYSIS_TABS: { id: Exclude<ToolTabId, "edit">; label: string }[] = [
  { id: "schema", label: "Header" },
  { id: "tools", label: "Holes" },
  { id: "stock", label: "Stock" },
  { id: "aag", label: "AAG" },
];

interface ToolPickerProps {
  active: ToolTabId;
  onChange: (tab: ToolTabId) => void;
  className?: string;
  variant?: "tabs" | "segment";
  editEnabled?: boolean;
}

function useSegmentIndicator(active: ToolTabId) {
  const segmentRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const root = segmentRef.current;
    if (!root) return;
    const tab = root.querySelector<HTMLElement>(`#tab-${active}`);
    if (!tab) return;
    const rootRect = root.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - rootRect.left,
      width: tabRect.width,
      ready: true,
    });
  }, [active]);

  useLayoutEffect(() => {
    measure();
    const root = segmentRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return { segmentRef, indicator };
}

export function ToolPicker({
  active,
  onChange,
  className,
  variant = "tabs",
  editEnabled = false,
}: ToolPickerProps) {
  const { segmentRef, indicator } = useSegmentIndicator(active);

  if (variant === "segment") {
    return (
      <div className={cn("workbench-tabs", className)}>
        <div ref={segmentRef} role="tablist" aria-label="Analysis tools" className="tool-segment">
          <span
            className="tool-segment__indicator"
            aria-hidden
            style={{
              width: indicator.width,
              transform: `translateX(${indicator.left}px)`,
              opacity: indicator.ready ? 1 : 0,
            }}
          />
          {ANALYSIS_TABS.map((tool) => {
            const selected = active === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${tool.id}`}
                id={`tab-${tool.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tool.id)}
                className={cn(
                  "tool-segment__btn",
                  selected && "tool-segment__btn--active",
                )}
              >
                {tool.label}
              </button>
            );
          })}
        </div>
        {editEnabled && (
          <button
            type="button"
            role="tab"
            aria-selected={active === "edit"}
            aria-controls="panel-edit"
            id="tab-edit"
            tabIndex={active === "edit" ? 0 : -1}
            onClick={() => onChange("edit")}
            className={cn(
              "workbench-tabs__edit",
              active === "edit" && "workbench-tabs__edit--active",
            )}
          >
            <span className="workbench-tabs__edit-label">Edit</span>
            <span className="workbench-tabs__edit-hint">Optional</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Results"
      className={cn("tool-picker", className)}
    >
      {[
        ...ANALYSIS_TABS,
        ...(editEnabled ? [{ id: "edit" as const, label: "Edit" }] : []),
      ].map((tool) => {
        const selected = active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tool.id}`}
            id={`tab-${tool.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tool.id)}
            className={cn(
              "-mb-px border-b pb-3 text-[12px] tracking-wide transition-colors duration-500",
              selected
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
              tool.id === "edit" && "ml-auto",
            )}
          >
            {tool.label}
          </button>
        );
      })}
    </div>
  );
}

export { ANALYSIS_TABS };
