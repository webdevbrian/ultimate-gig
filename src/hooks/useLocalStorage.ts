"use client";

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored != null) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(defaultValue);
      }
    } catch {
    } finally {
      setHasHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }, [key, value, hasHydrated]);

  return [value, setValue] as const;
}
