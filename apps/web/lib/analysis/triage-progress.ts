import type { ToolTabId } from "@/components/tools/tool-picker";
import { validateImportCompatibility, type StepHeaderReport } from "@/lib/step-header";
import { parseNeedsReview } from "@/lib/parse-quality";
import type { ParseResult } from "@steprs/ts-types";

export type TriageStepId = "schema" | "tools" | "stock" | "export";

export type TriageStepStatus = "pending" | "active" | "done" | "review";

export interface TriageStep {
  id: TriageStepId;
  label: string;
  tab: ToolTabId | null;
  status: TriageStepStatus;
}

export interface TriageProgressInput {
  result: ParseResult | null;
  header: StepHeaderReport | null;
  activeTab: ToolTabId;
  visitedTabs: ReadonlySet<ToolTabId>;
  exported: boolean;
}

function schemaNeedsReview(
  header: StepHeaderReport | null,
  result: ParseResult | null,
): boolean {
  if (!header || !result?.quoting) return true;
  const importCheck = validateImportCompatibility(
    header,
    result.quoting.units.detected_unit,
    result.quoting.units.confidence,
  );
  return importCheck.overall !== "pass" || result.quoting.units.confidence < 0.6 || parseNeedsReview(result);
}

function toolingApplies(result: ParseResult | null): boolean {
  const q = result?.quoting;
  if (!q) return false;
  return q.holes.length > 0 || q.slots.length > 0 || q.pockets.length > 0;
}

function stepStatus(
  id: TriageStepId,
  input: TriageProgressInput,
): TriageStepStatus {
  const { result, header, activeTab, visitedTabs, exported } = input;

  switch (id) {
    case "schema": {
      if (activeTab === "schema") return "active";
      if (!result || !header) return "pending";
      if (visitedTabs.has("schema")) {
        return schemaNeedsReview(header, result) ? "review" : "done";
      }
      return schemaNeedsReview(header, result) ? "pending" : "done";
    }
    case "tools": {
      if (activeTab === "tools") return "active";
      if (!result) return "pending";
      if (!toolingApplies(result)) return "done";
      return visitedTabs.has("tools") ? "done" : "pending";
    }
    case "stock": {
      if (activeTab === "stock") return "active";
      if (!result?.quoting) return "pending";
      return visitedTabs.has("stock") ? "done" : "pending";
    }
    case "export":
      if (exported) return "done";
      return "pending";
    default:
      return "pending";
  }
}

/** Quiet checklist — header → holes → stock → export. */
export function buildTriageProgress(input: TriageProgressInput): TriageStep[] {
  const steps: Omit<TriageStep, "status">[] = [
    { id: "schema", label: "Header", tab: "schema" },
    { id: "tools", label: "Holes", tab: "tools" },
    { id: "stock", label: "Stock", tab: "stock" },
    { id: "export", label: "Export", tab: null },
  ];

  return steps.map((step) => ({
    ...step,
    status: stepStatus(step.id, input),
  }));
}
