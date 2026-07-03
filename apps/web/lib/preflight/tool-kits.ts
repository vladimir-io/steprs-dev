import type { MaterialId } from "./feeds";
import type { PreflightConfig } from "./engine";

export interface ToolKit {
  id: string;
  label: string;
  machineId: string;
  workholdingId: string;
  materialId: MaterialId;
  toolIds: string[];
}

/** One-click shop presets — catalog LOC/OAL baked in via tool IDs. */
export const TOOL_KITS: ToolKit[] = [
  {
    id: "carbide-starter",
    label: "Carbide 3D starter",
    machineId: "shapeoko-4-standard",
    workholdingId: "smw-mod-vise-4",
    materialId: "aluminum-6061",
    toolIds: ["em-flat-3.175", "em-flat-6.35", "drill-4", "drill-6.35"],
  },
  {
    id: "shapeoko-xxl",
    label: "Shapeoko XXL kit",
    machineId: "shapeoko-4-xxl",
    workholdingId: "fixture-plate-clamps",
    materialId: "mdf",
    toolIds: ["em-flat-6.35", "em-flat-12.7", "drill-6.35"],
  },
  {
    id: "tormach-operator",
    label: "Tormach operator",
    machineId: "tormach-770m",
    workholdingId: "kurt-dx4",
    materialId: "aluminum-6061",
    toolIds: [
      "em-flat-6.35",
      "em-flat-9.525",
      "em-flat-6.35-lr",
      "drill-6",
      "drill-8",
      "drill-6.35",
    ],
  },
  {
    id: "langmuir-mr1",
    label: "Langmuir MR-1",
    machineId: "langmuir-mr1",
    workholdingId: "kurt-dx4",
    materialId: "steel-1018",
    toolIds: ["em-flat-6.35", "em-flat-8", "drill-6", "drill-8"],
  },
];

export function getToolKit(id: string): ToolKit | undefined {
  return TOOL_KITS.find((k) => k.id === id);
}

export function toolKitToConfig(kit: ToolKit): PreflightConfig {
  return {
    machineId: kit.machineId,
    workholdingId: kit.workholdingId,
    materialId: kit.materialId,
    toolIds: [...kit.toolIds],
    stockAllowanceMm: 3.175,
  };
}
