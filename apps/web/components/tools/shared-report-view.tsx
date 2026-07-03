"use client";

import { Button } from "@/components/ui/button";
import { getMachine } from "@/lib/preflight/machines";
import { getWorkholding } from "@/lib/preflight/workholding";
import { getMaterial } from "@/lib/preflight/feeds";
import { getMachinabilityTier } from "@/lib/preflight/machinability-tier";
import { clearShareHash, type SharedReportPayload } from "@/lib/preflight/share-report";
import { cn, formatNumber } from "@/lib/utils";
import type { CheckStatus } from "@/lib/preflight/engine";

const STATUS_LABEL: Record<CheckStatus, string> = {
  fail: "Fail",
  warn: "Review",
  info: "Note",
  pass: "OK",
};

interface SharedReportViewProps {
  payload: SharedReportPayload;
  onCheckOwnFile: () => void;
}

export function SharedReportView({
  payload,
  onCheckOwnFile,
}: SharedReportViewProps) {
  const machine = getMachine(payload.machineId);
  const workholding = getWorkholding(payload.workholdingId);
  const material = getMaterial(payload.materialId);
  const tier = getMachinabilityTier(payload.machinabilityScore);
  const env = payload.envelope;
  const sorted = [env.x, env.y, env.z].sort((a, b) => b - a);

  const handleOwnFile = () => {
    clearShareHash();
    onCheckOwnFile();
  };

  return (
    <div className="shared-report">
      <div className="shared-report__hero">
        <p className="shared-report__eyebrow">Shared pre-flight report</p>
        <h2 className="shared-report__title">
          {payload.fileName ?? "STEP diagnostic"}
        </h2>
        <p className="shared-report__meta">
          {machine?.label ?? payload.machineId} · {workholding?.label ?? payload.workholdingId} ·{" "}
          {material?.label ?? payload.materialId} · machinability{" "}
          {tier.score}% ({tier.label})
        </p>
        <p className="shared-report__envelope">
          Envelope {formatNumber(sorted[0]!, 1)} × {formatNumber(sorted[1]!, 1)} ×{" "}
          {formatNumber(sorted[2]!, 1)} mm
          {payload.deepestPocketMm != null && (
            <> · deepest pocket {formatNumber(payload.deepestPocketMm, 1)} mm</>
          )}
        </p>
      </div>

      <ul className="preflight-panel__checks">
        {payload.checks.map((check, i) => (
          <li
            key={`${check.rule}-${i}`}
            className={cn("preflight-check", `preflight-check--${check.status}`)}
          >
            <div className="preflight-check__head">
              <span className="preflight-check__title">{check.title}</span>
              <span className="preflight-check__state">
                {STATUS_LABEL[check.status]}
              </span>
            </div>
            <p className="preflight-check__detail">{check.detail}</p>
          </li>
        ))}
      </ul>

      <p className="shared-report__note">
        No CAD file was uploaded to view this link. Geometry metrics were
        serialized into the URL on the sender&apos;s machine.
      </p>

      <Button type="button" variant="glow" size="lg" onClick={handleOwnFile}>
        Check your own STEP file
      </Button>
    </div>
  );
}
