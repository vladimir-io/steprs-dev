"use client";

import { useEffect } from "react";

import { isBenignExtensionError } from "@/lib/benign-extension-errors";

/** PayPal Honey and similar extensions throw UnavailableError into the page — ignore them. */
export function ExtensionErrorGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!isBenignExtensionError(event.error)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("[steprs] Ignored browser extension error:", event.error);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isBenignExtensionError(event.reason)) return;
      event.preventDefault();
      console.warn("[steprs] Ignored browser extension rejection:", event.reason);
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
