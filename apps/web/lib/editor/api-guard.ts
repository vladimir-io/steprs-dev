import { NextResponse } from "next/server";

const EDITOR_UNAVAILABLE =
  "Geometry editor is proprietary and not available in the public steprs-dev repository. See docs/PRIVATE_EDITOR.md.";

/** Editor APIs always return 503 in the public open-core repository. */
export function editorApiDisabledResponse() {
  return NextResponse.json({ error: EDITOR_UNAVAILABLE }, { status: 503 });
}
