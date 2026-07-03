"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildAagJsonOnly } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

interface AagPanelProps {
  result: ParseResult | null;
  isParsing: boolean;
  fileName?: string;
}

export function AagPanel({ result, isParsing, fileName }: AagPanelProps) {
  const [showJson, setShowJson] = useState(false);

  const aag = result?.aag;
  const graph = aag?.graph ?? [];
  const holeCount = result?.quoting?.holes?.length ?? 0;
  const pocketCount = result?.quoting?.pockets?.length ?? 0;
  const hasRichGraph =
    (aag?.manifold_edge_count ?? 0) > 0 &&
    (aag?.concave_edge_count ?? 0) + (aag?.convex_edge_count ?? 0) > 0;

  const jsonPreview = useMemo(() => {
    if (!result) return "";
    return buildAagJsonOnly(result, "compact");
  }, [result]);

  if (isParsing) {
    return (
      <p className="workbench-panel-empty">Building attributed adjacency graph…</p>
    );
  }

  if (!result?.aag) {
    return (
      <p className="workbench-panel-empty">
        Drop a STEP file to extract face adjacency for pocket and slot hints.
      </p>
    );
  }

  if (aag!.face_count === 0) {
    return (
      <div className="aag-panel">
        <p className="workbench-panel-empty">
          No B-rep faces found in this file. AAG requires manifold solid geometry.
        </p>
        <p className="aag-panel__note">
          steprs still parsed schema, stock envelope, and any cylindrical features.
          Check <strong>Header</strong> and <strong>Holes</strong> tabs.
        </p>
      </div>
    );
  }

  return (
    <div className="aag-panel">
      <header className="aag-panel__hero">
        <p className="aag-panel__eyebrow">No coordinates · Joshi–Chang AAG</p>
        <p className="aag-panel__statline">
          {formatNumber(aag!.face_count, 0)} faces ·{" "}
          {formatNumber(aag!.manifold_edge_count, 0)} manifold edges
          {aag!.adjacency_edge_count > 0 && (
            <span className="aag-panel__sub">
              {" "}
              · {formatNumber(aag!.adjacency_edge_count, 0)} topology edges
            </span>
          )}
        </p>
        <p className="aag-panel__legend">
          <span className="aag-panel__chip aag-panel__chip--concave">Concave</span>
          often interior corners ·{" "}
          <span className="aag-panel__chip aag-panel__chip--convex">Convex</span>
          often exterior · verify in CAM
        </p>
      </header>

      {!hasRichGraph && (
        <div className="aag-panel__alert" role="status">
          <p>
            <strong>Limited AAG edges on this file.</strong> Concave/convex classification needs
            shared manifold edges between faces. Your part still has actionable data:
          </p>
          <ul>
            {holeCount > 0 && (
              <li>
                <strong>{holeCount}</strong> machining hole
                {holeCount === 1 ? "" : "s"}. Open <strong>Holes</strong> for drill list
              </li>
            )}
            {pocketCount > 0 && (
              <li>
                <strong>{pocketCount}</strong> pocket
                {pocketCount === 1 ? "" : "s"} detected from planar faces
              </li>
            )}
            <li>
              Stock billet sizing and header check are on other tabs. Export a triage
              report from the header menu
            </li>
          </ul>
        </div>
      )}

      <dl className="aag-panel__grid">
        <div className="aag-panel__row">
          <dt>Concave edges</dt>
          <dd>{formatNumber(aag!.concave_edge_count, 0)}</dd>
        </div>
        <div className="aag-panel__row">
          <dt>Convex edges</dt>
          <dd>{formatNumber(aag!.convex_edge_count, 0)}</dd>
        </div>
        <div className="aag-panel__row">
          <dt>Smooth (omitted)</dt>
          <dd>{formatNumber(aag!.smooth_edge_count, 0)}</dd>
        </div>
        <div className="aag-panel__row">
          <dt>Graph nodes</dt>
          <dd>
            {formatNumber(graph.length || aag!.face_count, 0)}
            {aag!.graph_truncated && aag!.graph_total_faces != null && (
              <span className="aag-panel__sub">
                {" "}
                · truncated from {formatNumber(aag!.graph_total_faces, 0)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <p className="aag-panel__note">
        Processed on this machine only. Handoff is topology and machining facts.
        Verify final toolpaths in CAM.
        {fileName ? ` (${fileName})` : ""}
      </p>

      <div className="aag-panel__actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={graph.length === 0 && aag!.face_count === 0}
          onClick={() => setShowJson((v) => !v)}
        >
          {showJson ? "Hide graph preview" : "Preview raw AAG graph"}
        </Button>
      </div>

      {showJson && (
        <pre className="aag-panel__json" aria-label="AAG JSON preview">
          {jsonPreview.length > 48_000
            ? `${jsonPreview.slice(0, 48_000)}\n… [truncated preview]`
            : jsonPreview}
        </pre>
      )}

      {graph.length > 0 && (
        <details className="aag-panel__table-wrap">
          <summary>Face adjacency ({graph.length})</summary>
          <div className="aag-panel__table-scroll">
            <table className="aag-panel__table">
              <thead>
                <tr>
                  <th>Face</th>
                  <th>Surface</th>
                  <th>Neighbors</th>
                </tr>
              </thead>
              <tbody>
                {graph.slice(0, 120).map((node) => (
                  <tr key={node.face_id}>
                    <td>#{node.face_id}</td>
                    <td>{node.surface_type}</td>
                    <td>
                      {node.adjacent_faces.length === 0 ? (
                        <span className="aag-panel__muted">-</span>
                      ) : (
                        node.adjacent_faces.map((adj) => (
                          <span
                            key={`${adj.face_id}-${adj.edge_curve_id}`}
                            className={
                              adj.edge_type === "CONCAVE"
                                ? "aag-panel__edge aag-panel__edge--concave"
                                : "aag-panel__edge aag-panel__edge--convex"
                            }
                          >
                            →{adj.face_id} ({adj.edge_type.toLowerCase()})
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {graph.length > 120 && (
              <p className="aag-panel__muted">
                Showing first 120 faces. Use the Export/Copy menu for the full JSON graph.
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
