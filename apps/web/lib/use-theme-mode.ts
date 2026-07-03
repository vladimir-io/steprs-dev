"use client";

import { useEffect, useState } from "react";

import type { ThemeMode } from "@/lib/theme";

export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const read = (): ThemeMode =>
      document.documentElement.classList.contains("dark") ? "dark" : "light";

    setMode(read());

    const observer = new MutationObserver(() => {
      setMode(read());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return mode;
}
