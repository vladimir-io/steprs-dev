/**
 * Workholding profiles — the Z-axis trap.
 *
 * Heights are approximate published base-to-jaw-top dimensions (mm).
 * A vise silently consumes gantry clearance; the Z-stack rule adds this
 * height to part + tool stickout before checking machine clearance.
 */

export interface WorkholdingProfile {
  id: string;
  label: string;
  /** Base to top of jaws. */
  heightMm: number;
  /** Maximum jaw opening. Infinity-like value for fixture plates. */
  jawOpeningMm: number;
  /** Jaw width (part length supported without overhang). */
  jawWidthMm: number;
}

export const WORKHOLDING: WorkholdingProfile[] = [
  {
    id: "smw-mod-vise-4",
    label: 'SMW Mod Vise (4")',
    heightMm: 46,
    jawOpeningMm: 98,
    jawWidthMm: 101.6,
  },
  {
    id: "kurt-dx4",
    label: 'Kurt DX4 (4")',
    heightMm: 117,
    jawOpeningMm: 101.6,
    jawWidthMm: 101.6,
  },
  {
    id: "kurt-dx6",
    label: 'Kurt DX6 (6")',
    heightMm: 158,
    jawOpeningMm: 228.6,
    jawWidthMm: 152.4,
  },
  {
    id: "low-profile-vise-3",
    label: 'Low-profile vise (3")',
    heightMm: 38,
    jawOpeningMm: 76,
    jawWidthMm: 76,
  },
  {
    id: "fixture-plate-clamps",
    label: "Fixture plate + Mitee-Bite clamps",
    heightMm: 12.7,
    jawOpeningMm: 10000,
    jawWidthMm: 10000,
  },
  {
    id: "pierson-mini-pallet",
    label: "Pierson mini pallet",
    heightMm: 25.4,
    jawOpeningMm: 10000,
    jawWidthMm: 152.4,
  },
];

export const DEFAULT_WORKHOLDING_ID = "smw-mod-vise-4";

export function getWorkholding(id: string): WorkholdingProfile | undefined {
  return WORKHOLDING.find((w) => w.id === id);
}
