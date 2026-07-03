/**
 * Steprs v1 — end-user API types.
 * Stable JSON contract for fixtures, LLM handoff, and client SDK.
 */

import type { AagFaceNode, AagReport, ParseResult, QuotingReport } from "@steprs/ts-types";

export const STEPRS_API_VERSION = "1" as const;

export type SteprsHandoffView = "compact" | "full";

export interface SteprsFixtureCatalogEntry {
  id: string;
  file_name: string;
  label: string;
  teaser: string;
  tags: string[];
  href: string;
  handoff_href: string;
  aag_href: string;
}

export interface SteprsMachiningSummary {
  units: string;
  unit_confidence: number;
  envelope_mm: { x: number; y: number; z: number };
  holes: {
    count: number;
    unique_diameters_mm: number[];
    kinds: string[];
  };
  pockets: number;
  slots: number;
  fillets: number;
  setups: number;
  requires_5_axis: boolean;
  min_internal_tool_diameter_mm: number | null;
  surface_area_mm2: number;
  stock_volume_mm3: number;
}

export interface SteprsAagSummary {
  face_count: number;
  manifold_edge_count: number;
  concave_edge_count: number;
  convex_edge_count: number;
  smooth_edge_count: number;
  graph_node_count: number;
  graph_truncated: boolean;
  surface_histogram: Record<string, number>;
}

export interface SteprsHandoff {
  api_version: typeof STEPRS_API_VERSION;
  engine_version: string;
  view: SteprsHandoffView;
  source: {
    file_name: string;
    fixture_id?: string;
  };
  summary: SteprsMachiningSummary;
  aag: SteprsAagSummary;
  graph: AagFaceNode[];
  graph_bytes: number;
  prompt: string;
  prompt_markdown: string;
}

export interface SteprsFixtureSnapshot {
  api_version: string;
  fixture_id: string;
  file_name: string;
  label: string;
  generated_at: string;
  parse: Pick<ParseResult, "engine_version" | "stats" | "quoting" | "aag">;
}

export interface SteprsApiIndex {
  api_version: typeof STEPRS_API_VERSION;
  name: string;
  description: string;
  docs: string;
  openapi: string;
  fixtures: string;
  philosophy: string[];
  endpoints: SteprsApiEndpoint[];
}

export interface SteprsApiEndpoint {
  method: "GET";
  path: string;
  description: string;
}

export function machiningSummaryFromQuoting(q: QuotingReport): SteprsMachiningSummary {
  const diameters = [...new Set(q.holes.map((h) => h.diameter_mm))].sort((a, b) => a - b);
  const kinds = [...new Set(q.holes.map((h) => h.kind))];

  return {
    units: q.units.detected_unit,
    unit_confidence: q.units.confidence,
    envelope_mm: {
      x: round(q.part_envelope_mm.dimensions.x),
      y: round(q.part_envelope_mm.dimensions.y),
      z: round(q.part_envelope_mm.dimensions.z),
    },
    holes: {
      count: q.holes.length,
      unique_diameters_mm: diameters.map(round),
      kinds,
    },
    pockets: q.pockets.length,
    slots: q.slots.length,
    fillets: q.fillets.length,
    setups: q.setup_count,
    requires_5_axis: q.requires_5_axis,
    min_internal_tool_diameter_mm: q.min_internal_tool_diameter_mm ?? null,
    surface_area_mm2: round(q.total_surface_area_mm2),
    stock_volume_mm3: round(q.stock_volume_mm3),
  };
}

export function aagSummaryFromReport(aag: AagReport, graph: AagFaceNode[]): SteprsAagSummary {
  const histogram: Record<string, number> = {};
  for (const node of graph) {
    histogram[node.surface_type] = (histogram[node.surface_type] ?? 0) + 1;
  }

  return {
    face_count: aag.face_count,
    manifold_edge_count: aag.manifold_edge_count,
    concave_edge_count: aag.concave_edge_count,
    convex_edge_count: aag.convex_edge_count,
    smooth_edge_count: aag.smooth_edge_count,
    graph_node_count: graph.length,
    graph_truncated: aag.graph_truncated ?? false,
    surface_histogram: histogram,
  };
}

/** Prioritize machining-relevant faces for LLM context windows. */
export function compactAagGraph(
  graph: AagFaceNode[],
  maxNodes = 48,
): AagFaceNode[] {
  if (graph.length <= maxNodes) return graph;

  const score = (node: AagFaceNode): number => {
    let s = 0;
    if (node.surface_type === "CYLINDRICAL_SURFACE") s += 4;
    if (node.surface_type === "CONICAL_SURFACE") s += 2;
    for (const adj of node.adjacent_faces) {
      if (adj.edge_type === "CONCAVE") s += 3;
      else if (adj.edge_type === "CONVEX") s += 1;
    }
    s += Math.min(node.adjacent_faces.length, 6) * 0.25;
    return s;
  };

  return [...graph]
    .sort((a, b) => score(b) - score(a) || a.face_id - b.face_id)
    .slice(0, maxNodes)
    .sort((a, b) => a.face_id - b.face_id);
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
