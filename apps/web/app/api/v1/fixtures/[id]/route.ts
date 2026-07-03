import { NextResponse } from "next/server";

import {
  fixtureSummary,
  isFixtureId,
  loadFixtureSnapshot,
} from "@/lib/api";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isFixtureId(id)) {
    return NextResponse.json({ error: "fixture_not_found", id }, { status: 404 });
  }

  const snapshot = await loadFixtureSnapshot(id);
  if (!snapshot) {
    return NextResponse.json({ error: "snapshot_unavailable", id }, { status: 404 });
  }

  return NextResponse.json(fixtureSummary(snapshot), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
