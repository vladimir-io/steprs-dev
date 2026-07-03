import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLlmContextGraph,
  buildSteprsHandoff,
  LLM_SYSTEM_PROMPT,
  minifiedAagGraphJson,
} from "./api/steprs-handoff";
import type { ParseResult } from "@steprs/ts-types";

function minimalResult(graph: ParseResult["aag"]["graph"]): ParseResult {
  return {
    success: true,
    engine_version: "0.1.0",
    stats: {
      entity_count: 1,
      max_id: 1,
      density: 1,
      storage_mode: "dense",
      parse_duration_ms: 1,
      type_breakdown: [],
      stages_completed: [],
    },
    quoting: {
      units: { detected_unit: "millimetre", confidence: 1, scale_to_mm: 1, source: "test" },
      bounding_box_mm: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 },
        dimensions: { x: 10, y: 10, z: 10 },
      },
      part_envelope_mm: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 },
        dimensions: { x: 10, y: 10, z: 10 },
      },
      total_surface_area_mm2: 100,
      stock_volume_mm3: 1000,
      estimated_mass_g: 2.7,
      setup_count: 1,
      holes: [
        {
          id: 1,
          kind: "through",
          radius_mm: 5,
          diameter_mm: 10,
          origin: { x: 0, y: 0, z: 0 },
          axis: { x: 0, y: 0, z: 1 },
        },
      ],
      planar_faces: [],
      fillets: [],
      pockets: [],
      slots: [],
      undercuts: [],
      requires_5_axis: false,
    },
    aag: {
      face_count: graph?.length ?? 0,
      adjacency_edge_count: 0,
      storage_mode: "dense",
      manifold_edge_count: 1,
      concave_edge_count: 1,
      convex_edge_count: 0,
      smooth_edge_count: 0,
      graph: graph ?? [],
    },
    labels: {
      engine: "topology-v2",
      face_classifications: [],
      notes: "",
    },
  };
}

describe("buildSteprsHandoff", () => {
  it("puts machining facts before graph JSON", () => {
    const result = minimalResult([
      {
        face_id: 10,
        surface_type: "PLANE",
        adjacent_faces: [
          { face_id: 12, edge_curve_id: 8, edge_type: "CONCAVE" },
        ],
      },
    ]);
    const handoff = buildSteprsHandoff(result, { fileName: "test.step" });
    assert.match(handoff.prompt, /Holes:/);
    assert.match(handoff.prompt, /Envelope/);
    assert.match(handoff.prompt, new RegExp(LLM_SYSTEM_PROMPT.slice(0, 30)));
    assert.equal(handoff.summary.holes.count, 1);
    assert.equal(handoff.graph.length, 1);
  });

  it("buildLlmContextGraph ends with minified JSON", () => {
    const result = minimalResult([
      {
        face_id: 10,
        surface_type: "PLANE",
        adjacent_faces: [],
      },
    ]);
    const payload = buildLlmContextGraph(result);
    assert.equal(payload.trimEnd().endsWith(minifiedAagGraphJson(result)), true);
    assert.doesNotMatch(minifiedAagGraphJson(result), /\n\s+/);
  });
});
