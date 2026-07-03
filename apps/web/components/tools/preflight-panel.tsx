"use client";

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePreflightConfig } from "@/hooks/use-preflight-config";
import {
  compareGcodeToModel,
  deepestModelPocketMm,
} from "@/lib/preflight/gcode-scan";
import {
  runPreflight,
  type CheckStatus,
  type PreflightCheck,
} from "@/lib/preflight/engine";
import { MACHINES } from "@/lib/preflight/machines";
import { TOOLS } from "@/lib/preflight/tools";
import { WORKHOLDING } from "@/lib/preflight/workholding";
import { MATERIALS } from "@/lib/preflight/feeds";
import {
  buildSharePayload,
  shareUrlFromPayload,
} from "@/lib/preflight/share-report";
import { cribUrlFromConfig } from "@/lib/preflight/share-crib";
import { buildCribShareTweet, openXIntent } from "@/lib/preflight/x-share";
import { TOOL_KITS, toolKitToConfig } from "@/lib/preflight/tool-kits";
import { MACHINING_ALLOWANCE_MM } from "@/lib/stock-sizer";
import { cn } from "@/lib/utils";
import { CrashRiskCard } from "./crash-risk-card";
import { MachinabilityBadge } from "./machinability-badge";
import type { ParseResult } from "@steprs/ts-types";

interface PreflightPanelProps {
  result: ParseResult | null;
  isParsing: boolean;
  fileName?: string;
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

export function PreflightPanel({ result, isParsing, fileName }: PreflightPanelProps) {
  const { config, updateConfig, setConfig } = usePreflightConfig();
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [cribMsg, setCribMsg] = useState<string | null>(null);
  const [gcodeCheck, setGcodeCheck] = useState<PreflightCheck | null>(null);

  const machine = MACHINES.find((m) => m.id === config.machineId);

  const report = useMemo(() => {
    if (!result?.quoting) return null;
    return runPreflight(result, config);
  }, [result, config]);

  const handleShare = useCallback(async () => {
    if (!report || !result) return;
    const payload = buildSharePayload(report, config, result, fileName);
    const url = shareUrlFromPayload(payload);
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
    } catch {
      setShareMsg(url);
    }
    window.setTimeout(() => setShareMsg(null), 4000);
  }, [report, config, result, fileName]);

  const handleShareCrib = useCallback(async () => {
    const url = cribUrlFromConfig(config, machine?.label);
    try {
      await navigator.clipboard.writeText(url);
      setCribMsg("Tool crib link copied");
    } catch {
      setCribMsg(url);
    }
    window.setTimeout(() => setCribMsg(null), 4000);
  }, [config, machine?.label]);

  const handleShareCribToX = useCallback(() => {
    const url = cribUrlFromConfig(config, machine?.label);
    openXIntent(
      buildCribShareTweet({
        machineLabel: machine?.label ?? config.machineId,
        cribUrl: url,
        label: machine?.label,
      }),
    );
  }, [config, machine?.label]);

  const handleGcodeFile = useCallback(
    async (file: File) => {
      if (!result?.quoting) return;
      const text = await file.text();
      const modelDeep = deepestModelPocketMm(
        result.quoting.pockets,
        result.quoting.holes,
      );
      const check = compareGcodeToModel(text, modelDeep);
      if (!check) return;
      setGcodeCheck({
        rule: "pocket-reach",
        status: check.status,
        title: check.title,
        detail: check.detail,
      });
    },
    [result],
  );

  if (isParsing) {
    return <p className="workbench-panel-empty">Running pre-flight checks…</p>;
  }

  if (!result?.quoting) {
    return (
      <p className="workbench-panel-empty">
        Drop a STEP file to check machine fit and tool reach before CAM.
      </p>
    );
  }

  const sortedChecks = report
    ? [...report.checks, ...(gcodeCheck ? [gcodeCheck] : [])].sort(
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
        {report && machine && (
          <MachinabilityBadge
            score={report.machinabilityScore}
            machineLabel={machine.label}
            fileName={fileName}
            reportUrl={
              report.counts.fail > 0 || report.counts.warn > 0
                ? shareUrlFromPayload(
                    buildSharePayload(report, config, result!, fileName),
                  )
                : undefined
            }
          />
        )}
        {report && report.counts.fail > 0 && machine && (
          <CrashRiskCard
            checks={report.checks}
            machineLabel={machine.label}
            machinabilityScore={report.machinabilityScore}
            fileName={fileName}
            reportUrl={shareUrlFromPayload(
              buildSharePayload(report, config, result!, fileName),
            )}
          />
        )}
        {report && (
          <p className="preflight-panel__score" data-testid="preflight-score">
            {report.counts.fail > 0
              ? `${report.counts.fail} blocker${report.counts.fail === 1 ? "" : "s"}`
              : report.counts.warn > 0
                ? `${report.counts.warn} to review`
                : "Ready for CAM"}
          </p>
        )}
      </div>

      <label className="preflight-panel__field">
        <span>Shop kit</span>
        <select
          defaultValue=""
          onChange={(e) => {
            const kit = TOOL_KITS.find((k) => k.id === e.target.value);
            if (kit) setConfig(toolKitToConfig(kit));
            e.target.value = "";
          }}
        >
          <option value="">Load preset…</option>
          {TOOL_KITS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

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
              updateConfig({ materialId: e.target.value as typeof config.materialId })
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

      <label className="preflight-panel__slider">
        <span>
          Stock allowance +{config.stockAllowanceMm.toFixed(1)} mm/side
        </span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={config.stockAllowanceMm}
          onChange={(e) =>
            updateConfig({ stockAllowanceMm: Number.parseFloat(e.target.value) })
          }
        />
        <span className="preflight-panel__slider-hint">
          Default {MACHINING_ALLOWANCE_MM.toFixed(1)} mm (1/8&quot;). Moves billet
          fit and Z-stack.
        </span>
      </label>

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
                  LOC {tool.fluteLengthMm} mm
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      <details className="preflight-panel__crib">
        <summary>Check G-code depth (.nc, .gcode, .tap)</summary>
        <p className="preflight-panel__gcode-hint">
          Compares deepest programmed Z against the model. Catches post-processor
          unit mistakes before a crash.
        </p>
        <input
          type="file"
          accept=".nc,.gcode,.tap,.NGC,.GCODE,.TAP"
          className="preflight-panel__gcode-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleGcodeFile(file);
            e.target.value = "";
          }}
        />
      </details>

      <ul className="preflight-panel__checks" data-testid="preflight-checks">
        {sortedChecks.map((check, i) => (
          <CheckRow key={`${check.rule}-${check.title}-${i}`} check={check} />
        ))}
      </ul>

      {report && (report.counts.fail > 0 || report.counts.warn > 0) && (
        <div className="preflight-panel__share">
          <Button type="button" variant="outline" size="sm" onClick={handleShare}>
            Share diagnostic link
          </Button>
          {shareMsg && <p className="preflight-panel__share-msg">{shareMsg}</p>}
        </div>
      )}

      <div className="preflight-panel__share preflight-panel__share--crib">
        <Button type="button" variant="outline" size="sm" onClick={handleShareCrib}>
          Copy tool crib link
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleShareCribToX}>
          Post crib to X
        </Button>
        {cribMsg && <p className="preflight-panel__share-msg">{cribMsg}</p>}
      </div>

      <p className="preflight-panel__note">
        Catalog dimensions — verify on your machine. Not a simulation; check in
        CAM.
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
