"use client";

const CHUNK_LOAD_PATTERN =
  /Failed to load chunk|ChunkLoadError|Loading chunk \d+ failed|Importing a module script failed|async loader/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error instanceof Error ? error : new Error(String(error));
  const blob = `${err.name}\n${err.message}\n${err.stack ?? ""}`;
  return CHUNK_LOAD_PATTERN.test(blob);
}

type PreviewCanvasModule = typeof import("@/components/parser/preview-canvas");

let cachedModule: PreviewCanvasModule | null = null;

export function resetPreviewCanvasModuleCache(): void {
  cachedModule = null;
}

async function importWithRetry(triesLeft: number): Promise<PreviewCanvasModule> {
  try {
    const mod = await import("@/components/parser/preview-canvas");
    cachedModule = mod;
    return mod;
  } catch (error) {
    if (triesLeft > 0 && isChunkLoadError(error)) {
      cachedModule = null;
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return importWithRetry(triesLeft - 1);
    }
    throw error;
  }
}

/** Shared dynamic import for the Three.js preview — retries transient chunk failures. */
export async function importPreviewCanvas(): Promise<PreviewCanvasModule> {
  if (cachedModule) return cachedModule;
  return importWithRetry(2);
}

export async function loadPreviewCanvasComponent() {
  const mod = await importPreviewCanvas();
  return { default: mod.PreviewCanvas };
}
