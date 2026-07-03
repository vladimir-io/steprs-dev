import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import type { MaterialId } from "./feeds";
import type { PreflightConfig } from "./engine";

export const CRIB_HASH_PREFIX = "crib=";

export interface SharedCribPayload {
  v: 1;
  machineId: string;
  workholdingId: string;
  materialId: MaterialId;
  toolIds: string[];
  stockAllowanceMm: number;
  label?: string;
}

export function buildCribPayload(
  config: PreflightConfig,
  label?: string,
): SharedCribPayload {
  return {
    v: 1,
    machineId: config.machineId,
    workholdingId: config.workholdingId,
    materialId: config.materialId,
    toolIds: [...config.toolIds],
    stockAllowanceMm: config.stockAllowanceMm,
    label,
  };
}

export function encodeCribPayload(payload: SharedCribPayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeCribPayload(encoded: string): SharedCribPayload | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const raw = JSON.parse(json) as SharedCribPayload;
    if (raw.v !== 1 || !Array.isArray(raw.toolIds)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function cribUrlFromConfig(
  config: PreflightConfig,
  label?: string,
  baseUrl?: string,
): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://steprs.dev");
  const hash = `${CRIB_HASH_PREFIX}${encodeCribPayload(buildCribPayload(config, label))}`;
  return `${origin}/crib#${hash}`;
}

export function readCribHash(): SharedCribPayload | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith(CRIB_HASH_PREFIX)) return null;
  return decodeCribPayload(hash.slice(CRIB_HASH_PREFIX.length));
}

export function cribToConfigPatch(
  payload: SharedCribPayload,
): Partial<PreflightConfig> & { cribLabel?: string } {
  return {
    machineId: payload.machineId,
    workholdingId: payload.workholdingId,
    materialId: payload.materialId,
    toolIds: payload.toolIds,
    stockAllowanceMm: payload.stockAllowanceMm,
    cribLabel: payload.label,
  };
}
