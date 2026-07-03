import type { BoundingBox, UnitMetadata } from "@steprs/ts-types";

/** Standard 1/8" machining allowance per side (inch procurement convention). */
export const MACHINING_ALLOWANCE_IN = 0.125;
export const MACHINING_ALLOWANCE_MM = MACHINING_ALLOWANCE_IN * 25.4;

/** Common aluminum plate / billet catalog sizes (inches). */
export const STANDARD_BILLET_IN = [
  0.5, 0.625, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8, 10, 12, 14, 16,
  18, 20, 24,
] as const;

/** Common metric block sizes (mm). */
export const STANDARD_BILLET_MM = [
  6, 8, 10, 12, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 75, 80, 100, 125, 150, 160, 200,
  250, 300, 400, 500,
] as const;

export interface StockDimensions {
  x: number;
  y: number;
  z: number;
}

export interface StockSizeReport {
  /** Part envelope sorted L × W × H (longest axis first). */
  rawMm: StockDimensions;
  rawIn: StockDimensions;
  withAllowanceMm: StockDimensions;
  withAllowanceIn: StockDimensions;
  billetMm: StockDimensions;
  billetIn: StockDimensions;
  billetLabelMm: string;
  billetLabelIn: string;
  allowancePerSideIn: number;
  allowancePerSideMm: number;
  /** Part envelope volume (finished part bounding box). */
  partVolumeMm3: number;
  /** Catalog billet volume after allowance + snap-up. */
  stockVolumeMm3: number;
  stockVolumeIn3: number;
  preferredUnit: "inch" | "millimetre";
}

const MM_PER_IN = 25.4;

/** Shop convention: longest dimension first (L × W × H). */
export function sortStockDimensions(d: StockDimensions): StockDimensions {
  const sorted = [d.x, d.y, d.z].sort((a, b) => b - a);
  return { x: sorted[0]!, y: sorted[1]!, z: sorted[2]! };
}

export function sizeStock(
  bbox: BoundingBox,
  units: UnitMetadata,
): StockSizeReport {
  const rawMm = sortStockDimensions(bbox.dimensions);
  const rawIn = {
    x: rawMm.x / MM_PER_IN,
    y: rawMm.y / MM_PER_IN,
    z: rawMm.z / MM_PER_IN,
  };

  const withAllowanceMm = {
    x: rawMm.x + 2 * MACHINING_ALLOWANCE_MM,
    y: rawMm.y + 2 * MACHINING_ALLOWANCE_MM,
    z: rawMm.z + 2 * MACHINING_ALLOWANCE_MM,
  };
  const withAllowanceIn = {
    x: rawIn.x + 2 * MACHINING_ALLOWANCE_IN,
    y: rawIn.y + 2 * MACHINING_ALLOWANCE_IN,
    z: rawIn.z + 2 * MACHINING_ALLOWANCE_IN,
  };

  const preferredUnit: "inch" | "millimetre" =
    units.detected_unit === "inch" ? "inch" : "millimetre";

  const billetIn = {
    x: snapUp(withAllowanceIn.x, STANDARD_BILLET_IN),
    y: snapUp(withAllowanceIn.y, STANDARD_BILLET_IN),
    z: snapUp(withAllowanceIn.z, STANDARD_BILLET_IN),
  };
  const billetMm = {
    x: snapUp(withAllowanceMm.x, STANDARD_BILLET_MM),
    y: snapUp(withAllowanceMm.y, STANDARD_BILLET_MM),
    z: snapUp(withAllowanceMm.z, STANDARD_BILLET_MM),
  };

  return {
    rawMm,
    rawIn,
    withAllowanceMm,
    withAllowanceIn,
    billetMm,
    billetIn,
    billetLabelMm: formatTriple(billetMm, "mm"),
    billetLabelIn: formatTriple(billetIn, "in"),
    allowancePerSideIn: MACHINING_ALLOWANCE_IN,
    allowancePerSideMm: MACHINING_ALLOWANCE_MM,
    partVolumeMm3: rawMm.x * rawMm.y * rawMm.z,
    stockVolumeMm3: billetMm.x * billetMm.y * billetMm.z,
    stockVolumeIn3: billetIn.x * billetIn.y * billetIn.z,
    preferredUnit,
  };
}

function snapUp(value: number, catalog: readonly number[]): number {
  for (const size of catalog) {
    if (size >= value - 1e-9) return size;
  }
  return catalog[catalog.length - 1]!;
}

function formatTriple(d: StockDimensions, unit: "mm" | "in"): string {
  const decimals = unit === "mm" ? 0 : 3;
  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return "0";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };
  return `${fmt(d.x)} × ${fmt(d.y)} × ${fmt(d.z)} ${unit}`;
}

export function formatInches(
  value: number | undefined | null,
  decimals = 3,
): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
