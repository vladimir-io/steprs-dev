"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hydration-safe localStorage sync. Server and first client paint use
 * `initialValue`; stored value applies after mount only.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  serialize: (value: T) => string = JSON.stringify,
  deserialize: (raw: string) => T = JSON.parse,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [stored, setStored] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setStored(deserialize(raw));
    } catch {
      /* private browsing */
    }
    setHydrated(true);
  }, [key, deserialize]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, serialize(value));
        } catch {
          /* private browsing */
        }
        return value;
      });
    },
    [key, serialize],
  );

  return [stored, setValue, hydrated];
}
