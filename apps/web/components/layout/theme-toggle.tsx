"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  readStoredTheme,
  resolveTheme,
  THEME_CHANGE_EVENT,
  toggleTheme,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function subscribeTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => onStoreChange();
  mq.addEventListener("change", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getThemeSnapshot(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): ThemeMode {
  return resolveTheme(readStoredTheme());
}

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const handleToggle = useCallback(() => {
    toggleTheme();
  }, []);

  const label =
    mode === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={cn("theme-toggle", className)}
      onClick={handleToggle}
      aria-label={label}
      aria-pressed={mode === "dark"}
      title={label}
      data-mode={mode}
    >
      {mode === "dark" ? (
        <SunIcon className="theme-toggle__icon" />
      ) : (
        <MoonIcon className="theme-toggle__icon" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
