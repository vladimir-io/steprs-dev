import type { TessellatedMesh } from "@steprs/ts-types";

let worker: Worker | null = null;
let activeRequestId: string | null = null;
let preloadPromise: Promise<void> | null = null;
let supersedeTessellate: (() => void) | null = null;

/** Abort an in-flight OCCT tessellation (e.g. when replacing the open file). */
export function cancelOcctPreview(): void {
  if (supersedeTessellate) {
    supersedeTessellate();
    supersedeTessellate = null;
  }
  activeRequestId = null;
  worker?.postMessage({ type: "cancel", id: "cancel" });
}

function getWorker() {
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/occt-preview.worker.ts", import.meta.url),
    );
  }
  return worker;
}

export function occtPreviewAvailable(): boolean {
  return typeof Worker !== "undefined";
}

/** Tessellate STEP bytes with occt-import-js (OpenCascade). Output is mm. */
export async function tessellateWithOcct(bytes: ArrayBuffer): Promise<TessellatedMesh> {
  await preloadOcct();
  const w = getWorker();
  const id = crypto.randomUUID();
  activeRequestId = id;

  if (supersedeTessellate) {
    supersedeTessellate();
    supersedeTessellate = null;
  }

  return new Promise((resolve, reject) => {
    supersedeTessellate = () => {
      w.removeEventListener("message", handler);
      reject(new Error("Preview superseded"));
    };

    const handler = (event: MessageEvent) => {
      const msg = event.data as {
        type: string;
        id: string;
        mesh?: TessellatedMesh;
        message?: string;
      };
      if (msg.id !== id) return;
      w.removeEventListener("message", handler);
      if (supersedeTessellate) {
        supersedeTessellate = null;
      }
      if (activeRequestId === id) {
        activeRequestId = null;
      }
      if (msg.type === "preview_mesh" && msg.mesh) {
        resolve(msg.mesh);
      } else {
        reject(new Error(msg.message ?? "OCCT preview failed"));
      }
    };
    w.addEventListener("message", handler);
    const workerBytes = bytes.slice(0);
    w.postMessage({ type: "tessellate", id, bytes: workerBytes }, [workerBytes]);
  });
}

/** Download OCCT WASM in the preview worker so the first mesh is fast. */
export function preloadOcct(): Promise<void> {
  if (!occtPreviewAvailable()) return Promise.resolve();
  if (!preloadPromise) {
    const w = getWorker();
    const id = "preload";
    preloadPromise = new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const msg = event.data as { type: string; id: string; message?: string };
        if (msg.id !== id) return;
        w.removeEventListener("message", handler);
        if (msg.type === "ready") {
          resolve();
        } else {
          reject(new Error(msg.message ?? "OCCT preload failed"));
        }
      };
      w.addEventListener("message", handler);
      w.postMessage({ type: "init", id });
    });
  }
  return preloadPromise;
}
