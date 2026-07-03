/**
 * Fixture catalog + precomputed parse snapshots for the public API.
 */

import bracketSnapshot from "@/data/api/v1/fixtures/machined-bracket.json";
import holePlateSnapshot from "@/data/api/v1/fixtures/hole-plate.json";
import mountingPlateSnapshot from "@/data/api/v1/fixtures/mounting-plate.json";
import { SAMPLE_PARTS } from "@/lib/sample-part";
import { absoluteUrl } from "@/lib/site";

import { buildSteprsHandoff } from "./steprs-handoff";
import type {
  SteprsFixtureCatalogEntry,
  SteprsFixtureSnapshot,
  SteprsHandoff,
  SteprsHandoffView,
} from "./types";
import { STEPRS_API_VERSION } from "./types";

export const FIXTURE_IDS = ["hole-plate", "mounting-plate", "machined-bracket"] as const;
export type FixtureApiId = (typeof FIXTURE_IDS)[number];

const SNAPSHOTS: Record<FixtureApiId, SteprsFixtureSnapshot> = {
  "hole-plate": holePlateSnapshot as unknown as SteprsFixtureSnapshot,
  "mounting-plate": mountingPlateSnapshot as unknown as SteprsFixtureSnapshot,
  "machined-bracket": bracketSnapshot as unknown as SteprsFixtureSnapshot,
};

export function listFixtureCatalog(): SteprsFixtureCatalogEntry[] {
  return SAMPLE_PARTS.filter((p) =>
    FIXTURE_IDS.includes(p.id as FixtureApiId),
  ).map((part) => ({
    id: part.id,
    file_name: part.fileName,
    label: part.label,
    teaser: part.teaser,
    tags: [...part.tags],
    href: `/api/v1/fixtures/${part.id}`,
    handoff_href: `/api/v1/fixtures/${part.id}/handoff`,
    aag_href: `/api/v1/fixtures/${part.id}/aag`,
  }));
}

export async function loadFixtureSnapshot(
  id: FixtureApiId,
): Promise<SteprsFixtureSnapshot | null> {
  return SNAPSHOTS[id] ?? null;
}

export function isFixtureId(value: string): value is FixtureApiId {
  return (FIXTURE_IDS as readonly string[]).includes(value);
}

export async function buildFixtureHandoff(
  id: FixtureApiId,
  view: SteprsHandoffView = "compact",
): Promise<SteprsHandoff | null> {
  const snapshot = await loadFixtureSnapshot(id);
  if (!snapshot) return null;

  const parseResult = {
    success: true,
    engine_version: snapshot.parse.engine_version,
    stats: snapshot.parse.stats,
    quoting: snapshot.parse.quoting,
    aag: snapshot.parse.aag,
    labels: {
      engine: "skipped",
      face_classifications: [],
      notes: "Fixture snapshot — labels stage omitted",
    },
  };

  return buildSteprsHandoff(parseResult, {
    fileName: snapshot.file_name,
    fixtureId: id,
    view,
  });
}

export function fixtureSummary(snapshot: SteprsFixtureSnapshot) {
  const q = snapshot.parse.quoting;
  const aag = snapshot.parse.aag;
  return {
    api_version: STEPRS_API_VERSION,
    fixture_id: snapshot.fixture_id,
    file_name: snapshot.file_name,
    label: snapshot.label,
    engine_version: snapshot.parse.engine_version,
    parse_duration_ms: snapshot.parse.stats.parse_duration_ms,
    entity_count: snapshot.parse.stats.entity_count,
    envelope_mm: q.part_envelope_mm.dimensions,
    holes: q.holes.length,
    pockets: q.pockets.length,
    slots: q.slots.length,
    aag_faces: aag.face_count,
    aag_manifold_edges: aag.manifold_edge_count,
    links: {
      self: absoluteUrl(`/api/v1/fixtures/${snapshot.fixture_id}`),
      handoff: absoluteUrl(`/api/v1/fixtures/${snapshot.fixture_id}/handoff`),
      handoff_full: absoluteUrl(
        `/api/v1/fixtures/${snapshot.fixture_id}/handoff?view=full`,
      ),
      aag: absoluteUrl(`/api/v1/fixtures/${snapshot.fixture_id}/aag`),
      step_file: absoluteUrl(`/fixtures/${snapshot.file_name}`),
    },
  };
}
