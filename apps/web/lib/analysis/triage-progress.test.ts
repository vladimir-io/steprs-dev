import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTriageProgress } from "./triage-progress";
import type { StepHeaderReport } from "@/lib/step-header";
import type { ParseResult } from "@steprs/ts-types";

const headerPass: StepHeaderReport = {
  format: { label: "AP214", ap: "214", raw: "AUTOMOTIVE_DESIGN", status: "pass" },
  units: { label: "Millimetres", detected: "millimetre", status: "pass", source: "header" },
  assembly: { label: "Single part", isAssembly: false, status: "pass", indicators: [] },
  inspectDurationMs: 1,
};

function minimalResult(holes = 0): ParseResult {
  return {
    success: true,
    engine_version: "0.1.0",
    stats: {
      parse_duration_ms: 50,
      entity_count: 10,
      stages_completed: [],
      storage_mode: "memory",
    },
    aag: { nodes: [], edges: [] },
    labels: null,
    quoting: {
      units: { detected_unit: "millimetre", confidence: 0.95 },
      holes: Array.from({ length: holes }, (_, i) => ({ id: i + 1 })),
      fillets: [],
      pockets: [],
      slots: [],
      requires_5_axis: false,
      min_internal_tool_diameter_mm: null,
      detection_notes: [],
    },
  } as unknown as ParseResult;
}

describe("buildTriageProgress", () => {
  it("marks schema done for clean files without a visit", () => {
    const steps = buildTriageProgress({
      result: minimalResult(),
      header: headerPass,
      activeTab: "tools",
      visitedTabs: new Set(["tools"]),
      exported: false,
    });
    assert.equal(steps.find((s) => s.id === "schema")?.status, "done");
  });

  it("requires tooling visit when holes exist", () => {
    const steps = buildTriageProgress({
      result: minimalResult(1),
      header: headerPass,
      activeTab: "schema",
      visitedTabs: new Set(["schema"]),
      exported: false,
    });
    assert.equal(steps.find((s) => s.id === "tools")?.status, "pending");
  });

  it("marks export done after export", () => {
    const steps = buildTriageProgress({
      result: minimalResult(),
      header: headerPass,
      activeTab: "stock",
      visitedTabs: new Set(["schema", "tools", "stock"]),
      exported: true,
    });
    assert.equal(steps.find((s) => s.id === "export")?.status, "done");
  });
});
