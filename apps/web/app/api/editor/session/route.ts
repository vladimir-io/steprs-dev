import { editorApiDisabledResponse } from "@/lib/editor/api-guard";

/** Proprietary geometry editor — not shipped in the public repository. */
export async function POST() {
  return editorApiDisabledResponse();
}
