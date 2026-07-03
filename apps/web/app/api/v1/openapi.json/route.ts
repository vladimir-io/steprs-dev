import { NextResponse } from "next/server";

import { buildOpenApiSpec } from "@/lib/api";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
