"use client";

import { useCallback, useEffect, useState } from "react";

import type { PreflightConfig } from "@/lib/preflight/engine";
import { DEFAULT_MACHINE_ID, MACHINES } from "@/lib/preflight/machines";
import { DEFAULT_TOOL_IDS, TOOLS } from "@/lib/preflight/tools";
import {
  DEFAULT_WORKHOLDING_ID,
  WORKHOLDING,
} from "@/lib/preflight/workholding";
import { DEFAULT_MATERIAL_ID, MATERIALS } from "@/lib/preflight/feeds";

const STORAGE_KEY = "steprs.preflightConfig";

const DEFAULT_CONFIG: PreflightConfig = {
  machineId: DEFAULT_MACHINE_ID,
  workholdingId: DEFAULT_WORKHOLDING_ID,
  toolIds: DEFAULT_TOOL_IDS,
  materialId: DEFAULT_MATERIAL_ID,
};

function sanitize(raw: unknown): PreflightConfig {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CONFIG;
  const value = raw as Partial<PreflightConfig>;
  return {
    machineId: MACHINES.some((m) => m.id === value.machineId)
      ? value.machineId!
      : DEFAULT_CONFIG.machineId,
    workholdingId: WORKHOLDING.some((w) => w.id === value.workholdingId)
      ? value.workholdingId!
      : DEFAULT_CONFIG.workholdingId,
    toolIds: Array.isArray(value.toolIds)
      ? value.toolIds.filter((id) => TOOLS.some((t) => t.id === id))
      : DEFAULT_CONFIG.toolIds,
    materialId: MATERIALS.some((m) => m.id === value.materialId)
      ? value.materialId!
      : DEFAULT_CONFIG.materialId,
  };
}

export function usePreflightConfig() {
  const [config, setConfigState] = useState<PreflightConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConfigState(sanitize(JSON.parse(stored)));
    } catch {
      /* private browsing / corrupt value */
    }
  }, []);

  const setConfig = useCallback((next: PreflightConfig) => {
    setConfigState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private browsing */
    }
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<PreflightConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* private browsing */
        }
        return next;
      });
    },
    [],
  );

  return { config, setConfig, updateConfig };
}
