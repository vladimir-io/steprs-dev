import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import type { MaterialId } from "./feeds";
import type { PreflightCheck, PreflightConfig, PreflightReport } from "./engine";
import type { ParseResult } from "@steprs/ts-types";

export const SHARE_HASH_PREFIX = "report=";

export interface SharedReportPayload {
  v: 1;
  machineId: string;
  workholdingId: string;
  materialId: MaterialId;
  toolIds: string[];
  stockAllowanceMm: number;
  envelope: { x: number; y: number; z: number };
  machinabilityScore: number;
  checks: PreflightCheck[];
  fileName?: string;
  deepestPocketMm?: number;
  createdAt: number;
}

export function buildSharePayload(
  report: PreflightReport,
  config: PreflightConfig,
  result: ParseResult,
  fileName?: string,
): SharedReportPayload {
  const env = result.quoting.part_envelope_mm.dimensions;
  const deepestPocketMm = deepestPocketDepth(result);
  const shareChecks = report.checks.filter(
    (c) => c.status === "fail" || c.status === "warn",
  );

  return {
    v: 1,
    machineId: config.machineId,
    workholdingId: config.workholdingId,
    materialId: config.materialId,
    toolIds: config.toolIds,
    stockAllowanceMm: config.stockAllowanceMm,
    envelope: { x: env.x, y: env.y, z: env.z },
    machinabilityScore: report.machinabilityScore,
    checks: shareChecks.length > 0 ? shareChecks : report.checks.slice(0, 8),
    fileName,
    deepestPocketMm,
    createdAt: Date.now(),
  };
}

export function encodeSharePayload(payload: SharedReportPayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSharePayload(encoded: string): SharedReportPayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const raw = JSON.parse(json) as SharedReportPayload;
    if (raw.v !== 1 || !Array.isArray(raw.checks)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function shareUrlFromPayload(payload: SharedReportPayload, baseUrl?: string): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://steprs.dev");
  const hash = `${SHARE_HASH_PREFIX}${encodeSharePayload(payload)}`;
  return `${origin}/preflight#${hash}`;
}

export function readShareHash(): SharedReportPayload | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  return decodeSharePayload(hash.slice(SHARE_HASH_PREFIX.length));
}

export function clearShareHash(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

function deepestPocketDepth(result: ParseResult): number | undefined {
  const pockets = result.quoting.pockets;
  if (!pockets.length) return undefined;
  return Math.max(...pockets.map((p) => p.depth_mm));
}
