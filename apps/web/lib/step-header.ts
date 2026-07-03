/** Fast HEADER + lightweight byte scan — no WASM required. */

export type InspectStatus = "pass" | "warn" | "unknown";

export interface StepHeaderReport {
  format: {
    label: string;
    ap: string | null;
    raw: string | null;
    status: InspectStatus;
  };
  units: {
    label: string;
    detected: "millimetre" | "inch" | "metre" | "unknown";
    status: InspectStatus;
    source: string;
  };
  assembly: {
    label: string;
    isAssembly: boolean;
    status: InspectStatus;
    indicators: string[];
  };
  inspectDurationMs: number;
}

const ASSEMBLY_MARKERS = [
  "NEXT_ASSEMBLY_USAGE_OCCURRENCE",
  "PRODUCT_DEFINITION_FORMATION",
  "ASSEMBLY_COMPONENT",
  "SHAPE_REPRESENTATION_RELATIONSHIP",
] as const;

const AP_PATTERN = /10303[-\s]*(\d{3})/i;
const FILE_SCHEMA_PATTERN = /FILE_SCHEMA\s*\(\s*\(?\s*'([^']+)'/i;

export function inspectStepHeader(bytes: ArrayBuffer | Uint8Array): StepHeaderReport {
  const start = performance.now();
  const text = decodeAscii(bytes, 512_000);
  const header = extractHeader(text);
  const scan = text.slice(0, Math.min(text.length, 512_000));

  const format = detectFormat(header, scan);
  const units = detectUnits(header, scan);
  const assembly = detectAssembly(scan);

  return {
    format,
    units,
    assembly,
    inspectDurationMs: performance.now() - start,
  };
}

function decodeAscii(bytes: ArrayBuffer | Uint8Array, maxBytes: number): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const len = Math.min(view.length, maxBytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += String.fromCharCode(view[i]!);
  }
  return out;
}

function extractHeader(text: string): string {
  const start = text.search(/HEADER\s*;/i);
  if (start < 0) return text.slice(0, 16_384);
  const end = text.indexOf("ENDSEC;", start);
  return end >= 0 ? text.slice(start, end) : text.slice(start, start + 16_384);
}

function detectFormat(
  header: string,
  scan: string,
): StepHeaderReport["format"] {
  const schemaMatch =
    header.match(FILE_SCHEMA_PATTERN) ?? scan.match(FILE_SCHEMA_PATTERN);
  const raw = schemaMatch?.[1]?.trim() ?? null;

  if (!raw) {
    return {
      label: "UNKNOWN",
      ap: null,
      raw: null,
      status: "unknown",
    };
  }

  const apMatch = raw.match(AP_PATTERN);
  const ap = apMatch?.[1] ?? null;
  const upper = raw.toUpperCase();

  let label = "UNKNOWN";
  if (ap === "203") label = "AP203";
  else if (ap === "214") label = "AP214";
  else if (ap === "242") label = "AP242";
  else if (upper.includes("AUTOMOTIVE_DESIGN")) label = "AP214";
  else if (ap) label = `AP${ap}`;

  const status: InspectStatus =
    label === "UNKNOWN" ? "unknown" : "pass";

  return { label, ap, raw, status };
}

function detectUnits(
  header: string,
  scan: string,
): StepHeaderReport["units"] {
  const upper = (header + scan.slice(0, 64_000)).toUpperCase();

  if (upper.includes(".MILLI.") && upper.includes(".METRE.")) {
    return {
      label: "mm",
      detected: "millimetre",
      status: "pass",
      source: "SI_UNIT(.MILLI.,.METRE.)",
    };
  }

  if (
    upper.includes("'MILLIMETRE'") ||
    upper.includes("CONVERSION_BASED_UNIT( 'MILLI'") ||
    upper.includes("CONVERSION_BASED_UNIT('MILLI'")
  ) {
    return {
      label: "mm",
      detected: "millimetre",
      status: "pass",
      source: "CONVERSION_BASED_UNIT(MILLI)",
    };
  }

  if (upper.includes(".INCH.") || upper.includes("'INCH'")) {
    return {
      label: "in",
      detected: "inch",
      status: "pass",
      source: "SI_UNIT(.INCH.)",
    };
  }

  if (upper.includes(".METRE.") || upper.includes("'METRE'")) {
    return {
      label: "m",
      detected: "metre",
      status: "warn",
      source: "SI_UNIT(.METRE.). Verify scale.",
    };
  }

  if (upper.includes("AUTOMOTIVE_DESIGN")) {
    return {
      label: "mm",
      detected: "millimetre",
      status: "pass",
      source: "AUTOMOTIVE_DESIGN (typical mm)",
    };
  }

  return {
    label: "UNKNOWN",
    detected: "unknown",
    status: "unknown",
    source: "No unit marker in header scan",
  };
}

function detectAssembly(scan: string): StepHeaderReport["assembly"] {
  const upper = scan.toUpperCase();
  const indicators: string[] = [];

  for (const marker of ASSEMBLY_MARKERS) {
    if (upper.includes(marker)) {
      indicators.push(marker);
    }
  }

  const solidCount = countOccurrences(upper, "MANIFOLD_SOLID_BREP");
  if (solidCount > 1) {
    indicators.push(`${solidCount}× MANIFOLD_SOLID_BREP`);
  }

  const isAssembly = indicators.some((i) =>
    i.includes("NEXT_ASSEMBLY") || i.includes("ASSEMBLY_COMPONENT"),
  ) || solidCount > 1;

  return {
    label: isAssembly ? "Assembly" : "Single part",
    isAssembly,
    status: isAssembly ? "warn" : "pass",
    indicators,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

export interface ImportValidation {
  overall: InspectStatus;
  issues: string[];
}

/** Cross-check header scan vs WASM geometry units before CAM import. */
export function validateImportCompatibility(
  header: StepHeaderReport,
  geometryUnit?: string,
  geometryConfidence?: number,
): ImportValidation {
  const issues: string[] = [];

  if (header.format.status === "unknown") {
    issues.push("STEP application protocol not recognized in FILE_SCHEMA.");
  }

  if (header.units.status === "unknown") {
    issues.push("No unit declaration found in header scan. CAM scale may be wrong.");
  }

  if (
    geometryUnit &&
    header.units.detected !== "unknown" &&
    geometryUnit !== header.units.detected &&
    (geometryConfidence ?? 0) >= 0.75
  ) {
    issues.push(
      `Unit mismatch: header ${header.units.label.toLowerCase()} vs geometry ${geometryUnit}.`,
    );
  }

  if (header.assembly.isAssembly) {
    issues.push("Assembly detected. Single-body CAM imports may need the correct component.");
  }

  const overall: InspectStatus =
    issues.some((i) => i.startsWith("Unit mismatch")) ? "warn"
    : issues.length > 0 ? "warn"
    : "pass";

  return { overall, issues };
}
