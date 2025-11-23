"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hasHydrated, setHasHydrated] = useState(false);
  const defaultRef = useRef(defaultValue);

  useEffect(() => {
    defaultRef.current = defaultValue;
  }, [defaultValue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored != null) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(defaultRef.current);
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

  const syncFromStorage = useCallback(
    (event: StorageEvent | null) => {
      if (typeof window === "undefined") return;
      if (event && event.key !== key) return;
      try {
        const stored = window.localStorage.getItem(key);
        if (stored == null) {
          setValue(defaultRef.current);
        } else {
          setValue(JSON.parse(stored) as T);
        }
      } catch {
      }
    },
    [key],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => syncFromStorage(event);
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [syncFromStorage]);

  return [value, setValue, hasHydrated] as const;
}
