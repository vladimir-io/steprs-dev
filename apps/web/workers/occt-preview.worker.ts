/// <reference lib="webworker" />

/** occt-import-js (OpenCascade) — quality STEP tessellation in a dedicated worker. */

import { OCCT_TESSELLATION_PARAMS } from "../lib/preview/occt-params";
import { occtResultToMesh } from "../lib/preview/occt-mesh";

declare function occtimportjs(options?: {
  locateFile?: (path: string) => string;
}): Promise<{
  ReadStepFile: (
    buf: Uint8Array,
    params: typeof OCCT_TESSELLATION_PARAMS | null,
  ) => { success?: boolean; meshes?: unknown[] };
}>;

let occtReady: Awaited<ReturnType<typeof occtimportjs>> | null = null;
let activeTessellateId: string | null = null;

async function getOcct() {
  if (!occtReady) {
    const occtBase = `${self.location.origin}/occt/`;
    importScripts(`${occtBase}occt-import-js.js`);
    occtReady = await occtimportjs({
      locateFile: (filePath: string) => `${occtBase}${filePath}`,
    });
  }
  return occtReady;
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    id: string;
    bytes?: ArrayBuffer;
  };

  if (msg.type === "init") {
    try {
      await getOcct();
      self.postMessage({ type: "ready", id: msg.id });
    } catch (err) {
      self.postMessage({
        type: "preview_error",
        id: msg.id,
        message: err instanceof Error ? err.message : "OCCT init failed",
      });
    }
    return;
  }

  if (msg.type === "cancel") {
    activeTessellateId = null;
    return;
  }

  if (msg.type !== "tessellate" || !msg.bytes?.byteLength) {
    return;
  }

  activeTessellateId = msg.id;

  try {
    const occt = await getOcct();
    if (activeTessellateId !== msg.id) return;

    const result = occt.ReadStepFile(
      new Uint8Array(msg.bytes),
      OCCT_TESSELLATION_PARAMS,
    );
    if (activeTessellateId !== msg.id) return;

    if (!result.success || !result.meshes?.length) {
      throw new Error("OCCT returned no geometry");
    }

    const mesh = occtResultToMesh(result as Parameters<typeof occtResultToMesh>[0]);
    if (mesh.triangle_count === 0) {
      throw new Error("OCCT mesh is empty");
    }
    if (activeTessellateId !== msg.id) return;

    const transfers: Transferable[] = [];
    if (mesh.positions instanceof Float32Array) transfers.push(mesh.positions.buffer);
    if (mesh.normals instanceof Float32Array) transfers.push(mesh.normals.buffer);
    if (mesh.indices instanceof Uint32Array) transfers.push(mesh.indices.buffer);

    self.postMessage({ type: "preview_mesh", id: msg.id, mesh }, transfers);
  } catch (err) {
    if (activeTessellateId !== msg.id) return;
    self.postMessage({
      type: "preview_error",
      id: msg.id,
      message: err instanceof Error ? err.message : "OCCT preview failed",
    });
  }
};
