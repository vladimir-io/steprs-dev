/** Errors injected by third-party browser extensions — not from steprs. */
export function isBenignExtensionError(error: unknown): boolean {
  if (!error) return false;

  const err = error instanceof Error ? error : new Error(String(error));
  const blob = `${err.name}\n${err.message}\n${err.stack ?? ""}`;

  if (/UnavailableError/i.test(err.name) || /UnavailableError/i.test(err.message)) {
    if (
      /Honey\.safariextension|Honey\.app|chrome-extension|moz-extension|safari-extension/i.test(
        blob,
      )
    ) {
      return true;
    }
    // Rejections often ship without a useful stack — still extension noise.
    if (!/steprs|step-parser|steprs_core|apps\/web/i.test(blob)) {
      return true;
    }
  }

  if (/Honey\.safariextension|Honey\.app/i.test(blob)) {
    return true;
  }

  return false;
}

export function isAppError(error: unknown): boolean {
  if (!error) return false;
  const err = error instanceof Error ? error : new Error(String(error));
  const blob = `${err.name}\n${err.message}\n${err.stack ?? ""}`;
  return /steprs|step-parser|steprs_core|apps\/web|webpack|turbopack/i.test(blob);
}
