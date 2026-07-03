import type { ToolTabId } from "@/components/tools/tool-picker";
import type { ParseResult } from "@steprs/ts-types";

const STORAGE_KEY = "steprs.workbenchTab";
/** First tab after drop when no stored preference — tooling is the core value. */
export const DEFAULT_WORKBENCH_TAB: ToolTabId = "tools";

const VALID_TABS: ToolTabId[] = [
  "schema",
  "tools",
  "stock",
  "preflight",
  "aag",
  "edit",
];

/** Pick the most useful first tab for a freshly parsed part. */
export function pickWorkbenchTabForResult(result: ParseResult): ToolTabId {
  const q = result.quoting;
  if (!q) return "schema";

  if (q.units.confidence < 0.6) return "schema";
  if (q.holes.length > 0 || q.pockets.length > 0 || q.slots.length > 0) {
    return "preflight";
  }
  return "stock";
}

export function readStoredWorkbenchTab(options?: {
  editEnabled?: boolean;
}): ToolTabId {
  if (typeof window === "undefined") return DEFAULT_WORKBENCH_TAB;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && VALID_TABS.includes(value as ToolTabId)) {
      if (value === "edit" && !options?.editEnabled) {
        return DEFAULT_WORKBENCH_TAB;
      }
      return value as ToolTabId;
    }
  } catch {
    /* private browsing */
  }
  return DEFAULT_WORKBENCH_TAB;
}

export function storeWorkbenchTab(tab: ToolTabId): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* private browsing */
  }
}
