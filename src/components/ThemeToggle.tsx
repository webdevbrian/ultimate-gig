"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ultimate-gig:ui:theme-mode" as const;

type ThemeMode = "system" | "light" | "dark";

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Reset explicit dark class; we'll re-apply as needed.
  root.classList.remove("dark");

  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (prefersDark) root.classList.add("dark");
    }
    return;
  }

  if (mode === "dark") {
    root.classList.add("dark");
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setMode(stored);
      }
    } catch {}
    setHasHydrated(true);
  }, []);

  // Keep DOM theme in sync with the current mode and respond to system
  // theme changes when in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined") return;

    applyTheme(mode);

    if (!window.matchMedia) return undefined;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        applyTheme("system");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as ThemeMode;
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  };

  return (
    <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
      <span>Theme</span>
      <select
        value={mode}
        onChange={handleChange}
        suppressHydrationWarning
        className="h-6 rounded border border-zinc-300 bg-white px-1 text-[11px] text-zinc-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-zinc-500"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
