/**
 * Machine envelope profiles for the CAM Pre-Flight check.
 *
 * Travels are published manufacturer specs (mm). `zClearanceMm` is the
 * usable table-to-spindle-nose (or gantry) clearance and is intentionally
 * conservative — verify against your own machine before trusting a tight fit.
 */

export type MachineCategory = "router" | "desktop" | "prosumer_mill" | "vmc";

export interface MachineProfile {
  id: string;
  label: string;
  category: MachineCategory;
  travelMm: { x: number; y: number; z: number };
  /** Conservative usable clearance under the spindle at max Z. */
  zClearanceMm: number;
  spindleMaxRpm: number;
  /** True 3-axis only; flags requires_5_axis parts as not machinable here. */
  axes: 3 | 5;
}

export const MACHINES: MachineProfile[] = [
  {
    id: "shapeoko-4-standard",
    label: "Shapeoko 4 Standard",
    category: "router",
    travelMm: { x: 444, y: 444, z: 101 },
    zClearanceMm: 101,
    spindleMaxRpm: 30000,
    axes: 3,
  },
  {
    id: "shapeoko-4-xxl",
    label: "Shapeoko 4 XXL",
    category: "router",
    travelMm: { x: 838, y: 838, z: 101 },
    zClearanceMm: 101,
    spindleMaxRpm: 30000,
    axes: 3,
  },
  {
    id: "shapeoko-hdm",
    label: "Shapeoko HDM",
    category: "router",
    travelMm: { x: 660, y: 640, z: 140 },
    zClearanceMm: 140,
    spindleMaxRpm: 24000,
    axes: 3,
  },
  {
    id: "onefinity-woodworker",
    label: "Onefinity Woodworker X-35",
    category: "router",
    travelMm: { x: 816, y: 816, z: 133 },
    zClearanceMm: 133,
    spindleMaxRpm: 30000,
    axes: 3,
  },
  {
    id: "nomad-3",
    label: "Carbide 3D Nomad 3",
    category: "desktop",
    travelMm: { x: 203, y: 203, z: 76 },
    zClearanceMm: 76,
    spindleMaxRpm: 24000,
    axes: 3,
  },
  {
    id: "bantam-desktop",
    label: "Bantam Tools Desktop CNC",
    category: "desktop",
    travelMm: { x: 178, y: 229, z: 89 },
    zClearanceMm: 89,
    spindleMaxRpm: 28000,
    axes: 3,
  },
  {
    id: "pocketnc-v2",
    label: "PocketNC V2-50",
    category: "desktop",
    travelMm: { x: 128, y: 116, z: 90 },
    zClearanceMm: 90,
    spindleMaxRpm: 50000,
    axes: 5,
  },
  {
    id: "langmuir-mr1",
    label: "Langmuir MR-1",
    category: "prosumer_mill",
    travelMm: { x: 521, y: 406, z: 216 },
    zClearanceMm: 216,
    spindleMaxRpm: 10000,
    axes: 3,
  },
  {
    id: "tormach-440",
    label: "Tormach PCNC 440",
    category: "prosumer_mill",
    travelMm: { x: 254, y: 159, z: 254 },
    zClearanceMm: 254,
    spindleMaxRpm: 10000,
    axes: 3,
  },
  {
    id: "tormach-770m",
    label: "Tormach 770M",
    category: "prosumer_mill",
    travelMm: { x: 356, y: 191, z: 330 },
    zClearanceMm: 330,
    spindleMaxRpm: 10400,
    axes: 3,
  },
  {
    id: "tormach-1100mx",
    label: "Tormach 1100MX",
    category: "prosumer_mill",
    travelMm: { x: 457, y: 279, z: 413 },
    zClearanceMm: 413,
    spindleMaxRpm: 10000,
    axes: 3,
  },
  {
    id: "haas-mini-mill",
    label: "Haas Mini Mill",
    category: "vmc",
    travelMm: { x: 406, y: 305, z: 254 },
    zClearanceMm: 254,
    spindleMaxRpm: 6000,
    axes: 3,
  },
  {
    id: "generic-vmc-40-taper",
    label: "Generic VMC (40-Taper)",
    category: "vmc",
    travelMm: { x: 762, y: 406, z: 508 },
    zClearanceMm: 508,
    spindleMaxRpm: 12000,
    axes: 3,
  },
];

export const DEFAULT_MACHINE_ID = "shapeoko-4-standard";

export function getMachine(id: string): MachineProfile | undefined {
  return MACHINES.find((m) => m.id === id);
}
