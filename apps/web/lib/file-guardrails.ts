import { isStepFile } from "@/lib/cad-formats";

/** Hard limit — enforced in UI, worker, and API paths. */
export const MAX_PARSE_FILE_BYTES = 50 * 1024 * 1024;

/** Fast boundary probe before reading the full file. */
export const PREFLIGHT_PROBE_BYTES = 500;

/** Deeper text scan when DATA; is not in the first 500 bytes. */
const STEP_DEEP_PROBE_BYTES = 16_384;

export type FileValidationResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; reason: string };

export type PreflightResult =
  | { ok: true }
  | { ok: false; reason: string };

export function maxUploadLabelMb(): number {
  return MAX_PARSE_FILE_BYTES / (1024 * 1024);
}

export function sanitizeDisplayFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  return cleaned || "file";
}

function asciiPreview(view: Uint8Array): string {
  let text = "";
  for (let i = 0; i < view.length; i++) {
    const c = view[i]!;
    text += c >= 32 && c <= 126 ? String.fromCharCode(c) : " ";
  }
  return text;
}

/** Scan the first ~500 bytes for ISO-10303-21 structure before WASM parse. */
export function preflightStepBytes(bytes: ArrayBuffer): PreflightResult {
  if (bytes.byteLength < 12) {
    return { ok: false, reason: "File is too small to be a STEP file." };
  }

  const view = new Uint8Array(
    bytes,
    0,
    Math.min(bytes.byteLength, PREFLIGHT_PROBE_BYTES),
  );
  const head = asciiPreview(view);

  if (/^\s*solid\s/m.test(head)) {
    return {
      ok: false,
      reason: "This looks like STL text, not STEP. Export ISO-10303-21 (.stp) from your CAD app.",
    };
  }

  if (!/ISO-10303-21/i.test(head)) {
    return {
      ok: false,
      reason:
        "Not ISO-10303-21. Open a .step or .stp export from your CAD app. IGES, STL, and mesh formats are unsupported.",
    };
  }

  if (!/HEADER\s*;/i.test(head)) {
    return {
      ok: false,
      reason: "Missing STEP HEADER section. The file may be truncated or corrupt.",
    };
  }

  const hasDataInHead = /DATA\s*;/i.test(head);
  if (!hasDataInHead && bytes.byteLength <= PREFLIGHT_PROBE_BYTES) {
    return {
      ok: false,
      reason:
        "No DATA section in file header. Re-export STEP from your CAD system and try again.",
    };
  }

  return { ok: true };
}

export function looksLikeStepContent(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(
    bytes,
    0,
    Math.min(bytes.byteLength, STEP_DEEP_PROBE_BYTES),
  );
  if (view.length < 12) return false;

  const text = asciiPreview(view);

  return (
    /ISO-10303-21/i.test(text) &&
    /HEADER\s*;/i.test(text) &&
    /ENDSEC\s*;/i.test(text) &&
    /DATA\s*;/i.test(text)
  );
}

export function validateFileSize(file: File): PreflightResult {
  if (file.size === 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (file.size > MAX_PARSE_FILE_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the ${maxUploadLabelMb()} MB limit. Split the assembly or export a smaller body.`,
    };
  }
  return { ok: true };
}

export async function validateStepFile(file: File): Promise<FileValidationResult> {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.ok) {
    return sizeCheck;
  }

  if (!isStepFile(file.name)) {
    return { ok: false, reason: "Not a STEP file (.step / .stp)." };
  }

  const preflightSlice = await file
    .slice(0, PREFLIGHT_PROBE_BYTES)
    .arrayBuffer();
  const preflight = preflightStepBytes(preflightSlice);
  if (!preflight.ok) {
    return preflight;
  }

  const bytes = await file.arrayBuffer();

  if (!looksLikeStepContent(bytes)) {
    return {
      ok: false,
      reason:
        "File has a .step extension but does not contain a valid ISO-10303-21 DATA section. Export STEP from your CAD app and try again.",
    };
  }

  return { ok: true, bytes };
}
