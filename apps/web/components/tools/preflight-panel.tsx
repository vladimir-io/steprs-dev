"use client";

import { useMemo } from "react";

import { usePreflightConfig } from "@/hooks/use-preflight-config";
import {
  runPreflight,
  type CheckStatus,
  type PreflightCheck,
} from "@/lib/preflight/engine";
import { MACHINES } from "@/lib/preflight/machines";
import { TOOLS } from "@/lib/preflight/tools";
import { WORKHOLDING } from "@/lib/preflight/workholding";
import { MATERIALS, type MaterialId } from "@/lib/preflight/feeds";
import { cn } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

interface PreflightPanelProps {
  result: ParseResult | null;
  isParsing: boolean;
}

const STATUS_ORDER: Record<CheckStatus, number> = {
  fail: 0,
  warn: 1,
  info: 2,
  pass: 3,
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  fail: "Fail",
  warn: "Review",
  info: "Note",
  pass: "OK",
};

export function PreflightPanel({ result, isParsing }: PreflightPanelProps) {
  const { config, updateConfig } = usePreflightConfig();

  const report = useMemo(() => {
    if (!result?.quoting) return null;
    return runPreflight(result, config);
  }, [result, config]);

  if (isParsing) {
    return <p className="workbench-panel-empty">Running pre-flight checks…</p>;
  }

  if (!result?.quoting) {
    return (
      <p className="workbench-panel-empty">
        Drop a STEP file to check it against your machine, vise, and tool crib
        before opening CAM.
      </p>
    );
  }

  const sortedChecks = report
    ? [...report.checks].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      )
    : [];

  const toggleTool = (id: string) => {
    const next = config.toolIds.includes(id)
      ? config.toolIds.filter((t) => t !== id)
      : [...config.toolIds, id];
    updateConfig({ toolIds: next });
  };

  return (
    <div className="preflight-panel">
      <div className="preflight-panel__hero">
        <p className="preflight-panel__eyebrow">
          Pick machine, vise, tools — see what fails before CAM
        </p>
        {report && (
          <p className="preflight-panel__score" data-testid="preflight-score">
            {report.counts.fail > 0
              ? `${report.counts.fail} blocker${report.counts.fail === 1 ? "" : "s"}`
              : report.counts.warn > 0
                ? `${report.counts.warn} to review`
                : "Ready for CAM"}
            <span className="preflight-panel__score-sub">
              {" "}
              · machinability {report.machinabilityScore}/100
            </span>
          </p>
        )}
      </div>

      <div className="preflight-panel__setup">
        <label className="preflight-panel__field">
          <span>Machine</span>
          <select
            value={config.machineId}
            onChange={(e) => updateConfig({ machineId: e.target.value })}
          >
            {MACHINES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="preflight-panel__field">
          <span>Workholding</span>
          <select
            value={config.workholdingId}
            onChange={(e) => updateConfig({ workholdingId: e.target.value })}
          >
            {WORKHOLDING.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="preflight-panel__field">
          <span>Material</span>
          <select
            value={config.materialId}
            onChange={(e) =>
              updateConfig({ materialId: e.target.value as MaterialId })
            }
          >
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="preflight-panel__crib">
        <summary>
          Tool crib ({config.toolIds.length} of {TOOLS.length})
        </summary>
        <ul>
          {TOOLS.map((tool) => (
            <li key={tool.id}>
              <label>
                <input
                  type="checkbox"
                  checked={config.toolIds.includes(tool.id)}
                  onChange={() => toggleTool(tool.id)}
                />
                <span>{tool.label}</span>
                <span className="preflight-panel__crib-spec">
                  LOC {tool.fluteLengthMm} · OAL {tool.oalMm} mm
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      <ul className="preflight-panel__checks" data-testid="preflight-checks">
        {sortedChecks.map((check, i) => (
          <CheckRow key={`${check.rule}-${i}`} check={check} />
        ))}
      </ul>

      <p className="preflight-panel__note">
        Catalog dimensions — check against your actual machine and tools. Not a
        simulation; verify in CAM.
      </p>
    </div>
  );
}

function CheckRow({ check }: { check: PreflightCheck }) {
  return (
    <li
      className={cn(
        "preflight-check",
        `preflight-check--${check.status}`,
      )}
    >
      <div className="preflight-check__head">
        <span className="preflight-check__title">{check.title}</span>
        <span className="preflight-check__state">
          {STATUS_LABEL[check.status]}
        </span>
      </div>
      <p className="preflight-check__detail">{check.detail}</p>
    </li>
  );
}
