const SITE = "https://steprs.dev";

export function xIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function openXIntent(text: string): void {
  window.open(xIntentUrl(text), "_blank", "noopener,noreferrer");
}

export function buildCrashRiskTweet(opts: {
  machineLabel: string;
  checkTitle: string;
  reportUrl?: string;
}): string {
  const link = opts.reportUrl ?? SITE;
  return [
    `Just ran my latest STEP through steprs.dev — caught "${opts.checkTitle}" on my ${opts.machineLabel} before I opened CAM. 😅`,
    "Local WASM parser, zero upload.",
    link,
  ].join("\n\n");
}

export function buildScoreFlexTweet(opts: {
  score: number;
  tierLabel: string;
  machineLabel: string;
  reportUrl?: string;
}): string {
  const link = opts.reportUrl ?? SITE;
  return [
    `Rate my setup — steprs says ${opts.score}% machinability (${opts.tierLabel}) on a ${opts.machineLabel}.`,
    "100% browser-local Rust WASM. No cloud upload.",
    link,
  ].join("\n\n");
}

export function buildCribShareTweet(opts: {
  machineLabel: string;
  cribUrl: string;
  label?: string;
}): string {
  const who = opts.label ? `${opts.label}'s` : "My";
  return [
    `${who} exact tool crib on ${opts.machineLabel}:`,
    opts.cribUrl,
    "Green light on this link = my machine can cut your part.",
  ].join("\n\n");
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyImageBlob(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Web Share API with image when supported; otherwise download + X intent. */
export async function shareImageToX(
  png: Blob,
  tweet: string,
  filename = "steprs-diagnostic.png",
): Promise<"shared" | "clipboard" | "tweet-only"> {
  const file = new File([png], filename, { type: "image/png" });

  if (navigator.share) {
    try {
      const payload: ShareData = { text: tweet, files: [file] };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return "shared";
      }
    } catch {
      /* user cancelled or unsupported */
    }
  }

  const copied = await copyImageBlob(png);
  if (copied) {
    openXIntent(tweet);
    return "clipboard";
  }

  await downloadBlob(png, filename);
  openXIntent(tweet);
  return "tweet-only";
}
