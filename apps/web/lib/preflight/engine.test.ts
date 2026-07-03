import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ParseResult, MachiningHole, DetectedPocket } from "@steprs/ts-types";

import { runPreflight, type PreflightConfig, type RuleId, type CheckStatus } from "./engine";

function makeResult(overrides: {
  envelope?: { x: number; y: number; z: number };
  holes?: Partial<MachiningHole>[];
  pockets?: Partial<DetectedPocket>[];
  undercutCount?: number;
  requires5Axis?: boolean;
  minInternalToolDiameterMm?: number;
}): ParseResult {
  const dims = overrides.envelope ?? { x: 80, y: 60, z: 20 };
  const bbox = {
    min: { x: 0, y: 0, z: 0 },
    max: dims,
    dimensions: dims,
  };
  return {
    success: true,
    engine_version: "test",
    stats: {
      entity_count: 1,
      max_id: 1,
      density: 1,
      storage_mode: "dense",
      parse_duration_ms: 0,
      type_breakdown: [],
      stages_completed: [],
    },
    quoting: {
      units: {
        detected_unit: "millimetre",
        confidence: 1,
        scale_to_mm: 1,
        source: "test",
      },
      bounding_box_mm: bbox,
      part_envelope_mm: bbox,
      total_surface_area_mm2: 0,
      stock_volume_mm3: 0,
      estimated_mass_g: 0,
      setup_count: 1,
      holes: (overrides.holes ?? []).map((h, i) => ({
        id: i,
        kind: "through",
        radius_mm: (h.diameter_mm ?? 6) / 2,
        diameter_mm: 6,
        origin: { x: 0, y: 0, z: 0 },
        axis: { x: 0, y: 0, z: 1 },
        ...h,
      })),
      planar_faces: [],
      fillets: [],
      pockets: (overrides.pockets ?? []).map((p, i) => ({
        id: i,
        area_mm2: 100,
        depth_mm: 10,
        volume_mm3: 1000,
        detection_method: "test",
        ...p,
      })),
      slots: [],
      undercuts: Array.from({ length: overrides.undercutCount ?? 0 }, (_, i) => ({
        id: i,
        normal: { x: 1, y: 0, z: 0 },
        reason: "test",
      })),
      requires_5_axis: overrides.requires5Axis ?? false,
      min_internal_tool_diameter_mm: overrides.minInternalToolDiameterMm,
    },
    aag: {
      face_count: 0,
      adjacency_edge_count: 0,
      storage_mode: "dense",
      manifold_edge_count: 0,
      concave_edge_count: 0,
      convex_edge_count: 0,
      smooth_edge_count: 0,
    },
    labels: { engine: "test", face_classifications: [], notes: "" },
  };
}

const baseConfig: PreflightConfig = {
  machineId: "shapeoko-4-standard",
  workholdingId: "fixture-plate-clamps",
  toolIds: ["em-flat-6.35", "drill-6.35"],
  materialId: "aluminum-6061",
};

function statusOf(result: ParseResult, config: PreflightConfig, rule: RuleId): CheckStatus[] {
  return runPreflight(result, config)
    .checks.filter((c) => c.rule === rule)
    .map((c) => c.status);
}

describe("preflight engine", () => {
  it("passes envelope fit for a small part", () => {
    const r = makeResult({ envelope: { x: 100, y: 80, z: 20 } });
    assert.deepEqual(statusOf(r, baseConfig, "envelope-fit"), ["pass"]);
  });

  it("fails envelope fit when part exceeds travel", () => {
    const r = makeResult({ envelope: { x: 600, y: 80, z: 20 } });
    assert.deepEqual(statusOf(r, baseConfig, "envelope-fit"), ["fail"]);
  });

  it("always flags shank collision for a pocket deeper than every flute (rule matrix guarantee)", () => {
    const r = makeResult({ pockets: [{ depth_mm: 30 }] });
    // 1/4" endmill LOC is 19.05 mm — 30 mm pocket must fail 100% of the time.
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(statusOf(r, baseConfig, "pocket-reach"), ["fail"]);
    }
  });

  it("clears pocket reach with a long-reach tool", () => {
    const r = makeResult({ pockets: [{ depth_mm: 30 }] });
    const cfg = { ...baseConfig, toolIds: ["em-flat-6.35-lr"] };
    assert.deepEqual(statusOf(r, cfg, "pocket-reach"), ["pass"]);
  });

  it("fails a drill that is shorter than the deepest matching bore", () => {
    const r = makeResult({
      holes: [{ diameter_mm: 4, depth_mm: 55, kind: "through" }],
    });
    const cfg = { ...baseConfig, toolIds: ["drill-4"] };
    // 4 mm jobber flute = 43 mm < 55 mm bore.
    assert.deepEqual(statusOf(r, cfg, "hole-tooling"), ["fail"]);
  });

  it("suggests helical interpolation when no drill matches but an endmill fits", () => {
    const r = makeResult({
      holes: [{ diameter_mm: 10, depth_mm: 8, kind: "through" }],
    });
    const cfg = { ...baseConfig, toolIds: ["em-flat-6.35"] };
    assert.deepEqual(statusOf(r, cfg, "hole-tooling"), ["info"]);
  });

  it("warns on flat-bottom blind holes", () => {
    const r = makeResult({
      holes: [{ diameter_mm: 6, depth_mm: 10, kind: "blind_flat" }],
    });
    assert.deepEqual(statusOf(r, baseConfig, "flat-bottom-holes"), ["warn"]);
  });

  it("fails the z-stack when vise + part + stickout exceed clearance", () => {
    // Shapeoko clearance 101 mm; Kurt DX4 alone is 117 mm.
    const r = makeResult({ envelope: { x: 80, y: 60, z: 20 } });
    const cfg = { ...baseConfig, workholdingId: "kurt-dx4" };
    assert.deepEqual(statusOf(r, cfg, "z-stack"), ["fail"]);
  });

  it("fails five-axis parts on a 3-axis machine", () => {
    const r = makeResult({ requires5Axis: true });
    assert.deepEqual(statusOf(r, baseConfig, "five-axis"), ["fail"]);
  });

  it("fails sharp inside corners below broach threshold", () => {
    const r = makeResult({ minInternalToolDiameterMm: 0.05 });
    assert.deepEqual(statusOf(r, baseConfig, "sharp-corners"), ["fail"]);
  });

  it("emits feeds and a machinability score", () => {
    const r = makeResult({});
    const report = runPreflight(r, baseConfig);
    assert.ok(report.machinabilityScore > 0 && report.machinabilityScore <= 100);
    const feeds = report.checks.filter((c) => c.rule === "feeds-speeds");
    assert.equal(feeds.length, 1);
    assert.match(feeds[0]!.detail, /RPM/);
  });
});
