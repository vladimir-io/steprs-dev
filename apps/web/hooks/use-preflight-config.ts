"use client";

import { useCallback, useEffect, useRef } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import type { PreflightConfig } from "@/lib/preflight/engine";
import { DEFAULT_MACHINE_ID, MACHINES } from "@/lib/preflight/machines";
import { DEFAULT_TOOL_IDS, TOOLS } from "@/lib/preflight/tools";
import {
  DEFAULT_WORKHOLDING_ID,
  WORKHOLDING,
} from "@/lib/preflight/workholding";
import { DEFAULT_MATERIAL_ID, MATERIALS } from "@/lib/preflight/feeds";
import { MACHINING_ALLOWANCE_MM } from "@/lib/stock-sizer";
import { readUrlPreflightPatch, writeUrlPreflightParams } from "@/lib/preflight/url-config";
import { cribToConfigPatch, readCribHash } from "@/lib/preflight/share-crib";

const STORAGE_KEY = "steprs.preflightConfig";

export const DEFAULT_PREFLIGHT_CONFIG: PreflightConfig = {
  machineId: DEFAULT_MACHINE_ID,
  workholdingId: DEFAULT_WORKHOLDING_ID,
  toolIds: DEFAULT_TOOL_IDS,
  materialId: DEFAULT_MATERIAL_ID,
  stockAllowanceMm: MACHINING_ALLOWANCE_MM,
};

function sanitize(raw: unknown): PreflightConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFLIGHT_CONFIG;
  const value = raw as Partial<PreflightConfig>;
  const allowance =
    typeof value.stockAllowanceMm === "number" &&
    value.stockAllowanceMm >= 0 &&
    value.stockAllowanceMm <= 25
      ? value.stockAllowanceMm
      : DEFAULT_PREFLIGHT_CONFIG.stockAllowanceMm;
  return {
    machineId: MACHINES.some((m) => m.id === value.machineId)
      ? value.machineId!
      : DEFAULT_PREFLIGHT_CONFIG.machineId,
    workholdingId: WORKHOLDING.some((w) => w.id === value.workholdingId)
      ? value.workholdingId!
      : DEFAULT_PREFLIGHT_CONFIG.workholdingId,
    toolIds: Array.isArray(value.toolIds)
      ? value.toolIds.filter((id) => TOOLS.some((t) => t.id === id))
      : DEFAULT_PREFLIGHT_CONFIG.toolIds,
    materialId: MATERIALS.some((m) => m.id === value.materialId)
      ? value.materialId!
      : DEFAULT_PREFLIGHT_CONFIG.materialId,
    stockAllowanceMm: allowance,
  };
}

export function usePreflightConfig() {
  const [config, setConfigState, hydrated] = useLocalStorage(
    STORAGE_KEY,
    DEFAULT_PREFLIGHT_CONFIG,
    JSON.stringify,
    (raw) => sanitize(JSON.parse(raw)),
  );
  const urlApplied = useRef(false);

  useEffect(() => {
    if (!hydrated || urlApplied.current) return;
    urlApplied.current = true;

    const crib = readCribHash();
    if (crib) {
      const patch = cribToConfigPatch(crib);
      const { cribLabel: _label, ...configPatch } = patch;
      setConfigState((prev) => sanitize({ ...prev, ...configPatch }));
      writeUrlPreflightParams(sanitize({ ...DEFAULT_PREFLIGHT_CONFIG, ...configPatch }));
      return;
    }

    const patch = readUrlPreflightPatch();
    if (patch) setConfigState((prev) => sanitize({ ...prev, ...patch }));
  }, [hydrated, setConfigState]);

  const setConfig = useCallback(
    (next: PreflightConfig) => {
      const normalized = sanitize(next);
      setConfigState(normalized);
      writeUrlPreflightParams(normalized);
    },
    [setConfigState],
  );

  const updateConfig = useCallback(
    (patch: Partial<PreflightConfig>) => {
      setConfigState((prev) => {
        const next = sanitize({ ...prev, ...patch });
        writeUrlPreflightParams(next);
        return next;
      });
    },
    [setConfigState],
  );

  return { config, setConfig, updateConfig, hydrated };
}
