import type { ParseResult } from "@steprs/ts-types";

/** Ingest and parse quality notes for the Schema panel. */
export function parseQualityNotes(result: ParseResult): string[] {
  const notes: string[] = [];
  const skipped = result.stats.entities_skipped ?? 0;
  if (skipped > 0) {
    notes.push(
      `${skipped.toLocaleString()} STEP record(s) skipped during ingest — hole and stock counts may be incomplete.`,
    );
  }
  if (result.stats.warnings?.length) {
    notes.push(...result.stats.warnings);
  }
  return notes;
}

export function parseNeedsReview(result: ParseResult): boolean {
  return parseQualityNotes(result).length > 0;
}
