/**
 * Steprs handoff — one function to build LLM-ready AAG exports.
 * Karpathy rule: give the model facts first, topology second, raw graph last.
 */

import type { AagFaceNode, ParseResult } from "@steprs/ts-types";

import {
  STEPRS_API_VERSION,
  aagSummaryFromReport,
  compactAagGraph,
  machiningSummaryFromQuoting,
  type SteprsHandoff,
  type SteprsHandoffView,
} from "./types";

export const LLM_SYSTEM_PROMPT = `You are reviewing a STEP parse for CNC programming prep.

You receive a Steprs handoff: machining facts from a local ISO 10303 parse, plus a Joshi–Chang Attributed Adjacency Graph (AAG).

AAG edge classes are heuristics, not CAM-verified features:
- Concave edges often mark interior corners (pockets, bores). Confirm in CAM.
- Convex edges often mark exterior corners or bosses. Confirm in CAM.
- Smooth edges are omitted from adjacency lists (tangent-continuous splits).

Tasks:
1. Cross-check the machining summary against the AAG. Flag mismatches.
2. List likely features (bores, pockets, slots) and rough setup count.
3. Note unit risks, assemblies, or anomalies. State when the model must be verified in CAM.`;

export interface BuildHandoffOptions {
  fileName?: string;
  fixtureId?: string;
  view?: SteprsHandoffView;
  /** Max graph nodes when view=compact (default 48). */
  maxGraphNodes?: number;
}

export function aagGraphPayload(result: ParseResult): AagFaceNode[] {
  return result.aag.graph ?? [];
}

export function buildSteprsHandoff(
  result: ParseResult,
  options: BuildHandoffOptions = {},
): SteprsHandoff {
  const view = options.view ?? "compact";
  const fullGraph = aagGraphPayload(result);
  const graph =
    view === "full"
      ? fullGraph
      : compactAagGraph(fullGraph, options.maxGraphNodes ?? 48);

  const summary = machiningSummaryFromQuoting(result.quoting);
  const aag = aagSummaryFromReport(result.aag, fullGraph);
  const graphJson = JSON.stringify(graph);
  const fileName = options.fileName?.replace(/[^\w.\-()+ ]/g, "_") ?? "part.step";

  const factsBlock = formatFactsMarkdown(summary, aag, fileName, options.fixtureId);
  const promptMarkdown = [
    LLM_SYSTEM_PROMPT,
    "",
    factsBlock,
    "",
    "## Attributed adjacency graph (JSON)",
    "",
    "```json",
    graphJson,
    "```",
  ].join("\n");

  const prompt = [
    LLM_SYSTEM_PROMPT,
    "",
    factsBlock.replace(/^## /gm, "").replace(/\*\*/g, ""),
    "",
    graphJson,
  ].join("\n");

  return {
    api_version: STEPRS_API_VERSION,
    engine_version: result.engine_version,
    view,
    source: {
      file_name: fileName,
      fixture_id: options.fixtureId,
    },
    summary,
    aag,
    graph,
    graph_bytes: new TextEncoder().encode(graphJson).length,
    prompt,
    prompt_markdown: promptMarkdown,
  };
}

function formatFactsMarkdown(
  summary: ReturnType<typeof machiningSummaryFromQuoting>,
  aag: ReturnType<typeof aagSummaryFromReport>,
  fileName: string,
  fixtureId?: string,
): string {
  const holeLine =
    summary.holes.count === 0
      ? "none detected"
      : `${summary.holes.count} (${summary.holes.unique_diameters_mm.map((d) => `Ø${d}`).join(", ")})`;

  const surfaces = Object.entries(aag.surface_histogram)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");

  const lines = [
    "## Part facts",
    "",
    `**Source:** ${fileName}${fixtureId ? ` (fixture \`${fixtureId}\`)` : ""}`,
    `**Units:** ${summary.units} (confidence ${Math.round(summary.unit_confidence * 100)}%)`,
    `**Envelope (mm):** ${summary.envelope_mm.x} × ${summary.envelope_mm.y} × ${summary.envelope_mm.z}`,
    `**Holes:** ${holeLine}`,
    `**Pockets / slots / fillets:** ${summary.pockets} / ${summary.slots} / ${summary.fillets}`,
    `**Estimated setups:** ${summary.setups}${summary.requires_5_axis ? " (5-axis likely)" : ""}`,
    `**Stock volume:** ${summary.stock_volume_mm3.toLocaleString()} mm³`,
    "",
    "## AAG topology",
    "",
    `**Faces:** ${aag.face_count} · **Manifold edges:** ${aag.manifold_edge_count}`,
    `**Concave / convex / smooth:** ${aag.concave_edge_count} / ${aag.convex_edge_count} / ${aag.smooth_edge_count}`,
    `**Surfaces:** ${surfaces}`,
  ];

  if (aag.graph_truncated || aag.graph_node_count > 48) {
    lines.push(
      `**Graph export:** showing prioritized subset; full graph has ${aag.graph_node_count} nodes`,
    );
  }

  return lines.join("\n");
}

/** @deprecated Use buildSteprsHandoff().prompt */
export function buildLlmContextGraph(
  result: ParseResult,
  options?: { fileName?: string },
): string {
  return buildSteprsHandoff(result, {
    fileName: options?.fileName,
    view: "compact",
  }).prompt;
}

export function minifiedAagGraphJson(result: ParseResult): string {
  return JSON.stringify(aagGraphPayload(result));
}

export function buildAagJsonOnly(result: ParseResult, view: SteprsHandoffView = "full"): string {
  const handoff = buildSteprsHandoff(result, { view });
  return JSON.stringify(handoff.graph, null, 2);
}

export function hasLlmContextGraph(result: ParseResult | null | undefined): boolean {
  if (!result?.aag) return false;
  return (
    (result.aag.graph?.length ?? 0) > 0 ||
    result.aag.manifold_edge_count > 0 ||
    (result.quoting.holes?.length ?? 0) > 0
  );
}

export const buildAagLlmPrompt = buildLlmContextGraph;
