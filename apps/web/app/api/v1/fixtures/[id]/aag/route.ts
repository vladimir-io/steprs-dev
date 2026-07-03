import { NextResponse } from "next/server";

import { buildFixtureHandoff, isFixtureId } from "@/lib/api";
import type { SteprsHandoffView } from "@/lib/api/types";

export const dynamic = "force-static";
export const revalidate = 86400;

function parseView(value: string | null): SteprsHandoffView {
  return value === "compact" ? "compact" : "full";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isFixtureId(id)) {
    return NextResponse.json({ error: "fixture_not_found", id }, { status: 404 });
  }

  const view = parseView(new URL(request.url).searchParams.get("view"));
  const handoff = await buildFixtureHandoff(id, view);
  if (!handoff) {
    return NextResponse.json({ error: "snapshot_unavailable", id }, { status: 404 });
  }

  return NextResponse.json(handoff.graph, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Steprs-Graph-Bytes": String(handoff.graph_bytes),
      "X-Steprs-View": handoff.view,
    },
  });
}
