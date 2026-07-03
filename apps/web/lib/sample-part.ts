/** Bundled demo parts served from public/fixtures. */

export interface SamplePart {
  id: string;
  path: string;
  fileName: string;
  label: string;
  teaser: string;
  tags: readonly string[];
}

export const SAMPLE_PARTS = [
  {
    id: "hole-plate",
    path: "/fixtures/hole-plate.stp",
    fileName: "hole-plate.stp",
    label: "NIST CTC-01 Plate",
    teaser:
      "NIST MBE combined test case (ASME1 RD); 10 bored holes on the calibration plate.",
    tags: ["Calibration", "Bores"],
  },
  {
    id: "mounting-plate",
    path: "/fixtures/mounting-plate.step",
    fileName: "mounting-plate.step",
    label: "Machined Mounting Plate",
    teaser: "Fixture plate with 26 holes, nested pockets, and fillet radii.",
    tags: ["Billet stock", "Pockets"],
  },
  {
    id: "machined-bracket",
    path: "/fixtures/machined-bracket.step",
    fileName: "machined-bracket.step",
    label: "3-Axis Mounting Bracket",
    teaser: "Bracket with deep pockets, slots, and undercuts for setup review.",
    tags: ["Multi-setup", "Pockets"],
  },
] as const satisfies readonly SamplePart[];

export type SamplePartId = (typeof SAMPLE_PARTS)[number]["id"];

/** @deprecated Use SAMPLE_PARTS */
export const SAMPLE_PART = SAMPLE_PARTS[0]!;

const cache = new Map<string, ArrayBuffer>();

/** Warm browser cache for all demo fixtures. */
export async function prefetchSampleParts(): Promise<void> {
  await Promise.all(SAMPLE_PARTS.map((part) => prefetchSamplePart(part)));
}

export async function prefetchSamplePart(
  sample: SamplePart = SAMPLE_PARTS[0]!,
): Promise<void> {
  if (cache.has(sample.id)) return;
  const response = await fetch(sample.path);
  if (!response.ok) return;
  cache.set(sample.id, await response.arrayBuffer());
}

export function getSamplePart(id: SamplePartId): SamplePart | undefined {
  return SAMPLE_PARTS.find((part) => part.id === id);
}

export async function fetchSampleFile(sample: SamplePart): Promise<File> {
  const cached = cache.get(sample.id);
  if (cached) {
    return new File([cached.slice(0)], sample.fileName, {
      type: "application/step",
    });
  }

  const response = await fetch(sample.path);
  if (!response.ok) {
    throw new Error("Sample fixture unavailable");
  }
  const bytes = await response.arrayBuffer();
  cache.set(sample.id, bytes);
  return new File([bytes.slice(0)], sample.fileName, {
    type: "application/step",
  });
}
