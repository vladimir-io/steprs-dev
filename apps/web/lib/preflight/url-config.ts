import type { MaterialId } from "./feeds";
import type { PreflightConfig } from "./engine";
import { getToolKit } from "./tool-kits";
import { MACHINES } from "./machines";
import { WORKHOLDING } from "./workholding";
import { MATERIALS } from "./feeds";
import { TOOLS } from "./tools";

const PARAM_KEYS = ["machine", "workholding", "material", "kit"] as const;

export function readUrlPreflightPatch(): Partial<PreflightConfig> | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const hasAny = PARAM_KEYS.some((k) => params.has(k));
  if (!hasAny) return null;

  const kitId = params.get("kit");
  if (kitId) {
    const kit = getToolKit(kitId);
    if (kit) {
      return {
        machineId: kit.machineId,
        workholdingId: kit.workholdingId,
        materialId: kit.materialId,
        toolIds: [...kit.toolIds],
      };
    }
  }

  const patch: Partial<PreflightConfig> = {};
  const machine = params.get("machine");
  if (machine && MACHINES.some((m) => m.id === machine)) {
    patch.machineId = machine;
  }
  const workholding = params.get("workholding");
  if (workholding && WORKHOLDING.some((w) => w.id === workholding)) {
    patch.workholdingId = workholding;
  }
  const material = params.get("material");
  if (material && MATERIALS.some((m) => m.id === material)) {
    patch.materialId = material as MaterialId;
  }
  return Object.keys(patch).length ? patch : null;
}

export function writeUrlPreflightParams(config: PreflightConfig): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.set("machine", config.machineId);
  params.set("workholding", config.workholdingId);
  params.set("material", config.materialId);
  params.delete("kit");
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}
