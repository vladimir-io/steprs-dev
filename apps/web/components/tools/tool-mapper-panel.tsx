"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapHolesToTools } from "@/lib/tool-mapper";
import { formatNumber } from "@/lib/utils";
import type { MachiningHole, ParseResult } from "@steprs/ts-types";

interface ToolMapperPanelProps {
  result: ParseResult | null;
  isParsing: boolean;
  hoveredHoleId?: number | null;
  onHoverHole?: (holeId: number | null) => void;
}

function holeKindLabel(kind: string): string {
  switch (kind) {
    case "through":
      return "Through";
    case "blind_flat":
      return "Blind · flat bottom";
    case "blind_drill_point":
      return "Blind · drill point";
    default:
      return kind.replaceAll("_", " ");
  }
}

export function ToolMapperPanel({
  result,
  isParsing,
  hoveredHoleId = null,
  onHoverHole,
}: ToolMapperPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const holes = useMemo(
    () => result?.quoting?.holes ?? [],
    [result?.quoting?.holes],
  );
  const report = holes.length ? mapHolesToTools(holes) : null;

  const sortedHoles = useMemo(
    () => [...holes].sort((a, b) => a.diameter_mm - b.diameter_mm || a.id - b.id),
    [holes],
  );

  const handleCopy = useCallback(async () => {
    if (!report?.copyText) return;
    try {
      await navigator.clipboard.writeText(report.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2500);
    }
  }, [report?.copyText]);

  const setHover = useCallback(
    (holeId: number | null) => {
      onHoverHole?.(holeId);
    },
    [onHoverHole],
  );

  if (isParsing) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted">
          Scanning cylindrical features…
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted">
          Drop a STEP file to map hole diameters to nearest catalog drills and endmills.
        </CardContent>
      </Card>
    );
  }

  if (!report || report.totalHoles === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted">
          No cylindrical holes detected in this file.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted" data-testid="hole-count-summary">
          {report.totalHoles} holes · {report.uniqueDiameters} unique Ø ·{" "}
          {formatNumber(result.stats.parse_duration_ms, 0)} ms
        </p>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? "Copied" : copyFailed ? "Copy failed" : "Copy sheet"}
        </Button>
      </div>

      <Card className="tool-mapper-holes">
        <CardHeader className="tool-mapper-holes__header">
          <div>
            <CardTitle>Holes</CardTitle>
            <CardDescription>
              Nearest standard drill or endmill within ±0.15 mm. Confirm tap drill,
              depth, and clearance in CAM. Hover to highlight.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="tool-mapper-holes__list">
          <ul className="tool-hole-list" role="list">
            {sortedHoles.map((hole) => (
              <HoleListItem
                key={hole.id}
                hole={hole}
                active={hoveredHoleId === hole.id}
                onHover={() => setHover(hole.id)}
                onLeave={() => setHover(null)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="tool-mapper-cutter">
        <CardHeader className="tool-mapper-cutter__header">
          <CardTitle>Cutter map</CardTitle>
          <CardDescription>
            Standard drills and endmills for each unique hole diameter
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="tool-mapper-table-wrap">
            <table className="tool-mapper-table tool-mapper-cutter__table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2.5 font-normal">Qty</th>
                  <th className="py-2.5 font-normal">Diameter</th>
                  <th className="py-2.5 font-normal">Hole type</th>
                  <th className="py-2.5 font-normal">Depth</th>
                  <th className="py-2.5 font-normal">Nearest catalog tool</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.diameterMm}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2.5 stat-value">{row.count}×</td>
                    <td className="py-2.5">
                      <span className="stat-value text-foreground">
                        {formatNumber(row.diameterMm, 2)} mm
                      </span>
                      <span className="ml-2 stat-value text-muted">
                        ({formatNumber(row.diameterIn, 3)}&quot;)
                      </span>
                    </td>
                    <td className="py-2.5 text-muted">
                      {row.holeKinds.join(", ")}
                    </td>
                    <td className="py-2.5 text-muted">{row.depthNote}</td>
                    <td className="py-2.5 text-foreground">{row.toolNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <details className="tool-mapper-copy">
        <summary className="tool-mapper-copy__summary">Copy-ready sheet</summary>
        <pre className="tool-mapper-copy__body">{report.copyText}</pre>
      </details>
    </div>
  );
}

function HoleListItem({
  hole,
  active,
  onHover,
  onLeave,
}: {
  hole: MachiningHole;
  active: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`tool-hole-row${active ? " tool-hole-row--active" : ""}`}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onFocus={onHover}
        onBlur={onLeave}
      >
        <span className="tool-hole-row__id">#{hole.id}</span>
        <span className="tool-hole-row__dia">
          ⌀{formatNumber(hole.diameter_mm, 2)} mm
        </span>
        <span className="tool-hole-row__kind">{holeKindLabel(hole.kind)}</span>
        {hole.depth_mm != null && (
          <span className="tool-hole-row__depth">
            {hole.kind === "through"
              ? `${formatNumber(hole.depth_mm, 1)} mm span`
              : `${formatNumber(hole.depth_mm, 1)} mm deep`}
          </span>
        )}
      </button>
    </li>
  );
}
