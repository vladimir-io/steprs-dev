import { NextResponse } from "next/server";

import { listFixtureCatalog } from "@/lib/api";
import { STEPRS_API_VERSION } from "@/lib/api/types";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return NextResponse.json(
    {
      api_version: STEPRS_API_VERSION,
      fixtures: listFixtureCatalog(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
