"use client";

import { useEffect } from "react";

import { HexWordmark } from "@/components/brand/hex-wordmark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <HexWordmark variant="loader" animate={false} size="md" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          The app hit an unexpected error. Your STEP files were not uploaded.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="btn-variant-default rounded-full px-5 py-2.5 text-sm font-medium"
      >
        Try again
      </button>
    </div>
  );
}
