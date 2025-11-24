"use client";

import Link from "next/link";
import { useState } from "react";

const subtleActionButtonClass =
  "inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

type ClearScope = "all" | "songs";

export default function SettingsPage() {
  const [feedback, setFeedback] = useState<
    | {
        scope: ClearScope;
        state: "success" | "error";
        message: string;
      }
    | null
  >(null);

  const removeKeys = (predicate: (key: string) => boolean) => {
    const keys = Object.keys(window.localStorage).filter(predicate);
    keys.forEach((key) => window.localStorage.removeItem(key));
  };

  const handleClearData = () => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(
      "This will remove all locally stored Ultimate Gig data (playlists, songs, settings). Continue?",
    );
    if (!confirmed) return;

    try {
      removeKeys((key) => key.startsWith("ultimate-gig:"));
      setFeedback({
        scope: "all",
        state: "success",
        message: "All locally stored data has been cleared. Reload or return to the dashboard to start fresh.",
      });
    } catch (error) {
      console.error("Failed to clear data", error);
      setFeedback({
        scope: "all",
        state: "error",
        message: "Unable to clear data. Please try again or clear storage manually.",
      });
    }
  };

  const handleClearSongData = () => {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(
      "This will reset play counts, last played dates, and playback tracking for all songs. Your playlists and songs will remain. Continue?",
    );
    if (!confirmed) return;

    try {
      // Reset playCount and lastPlayedAt on all songs instead of removing them
      const songsKey = "ultimate-gig:songs";
      const songsJson = window.localStorage.getItem(songsKey);
      if (songsJson) {
        const songs = JSON.parse(songsJson);
        const resetSongs = songs.map((song: Record<string, unknown>) => {
          const { playCount, lastPlayedAt, ...rest } = song;
          return rest;
        });
        window.localStorage.setItem(songsKey, JSON.stringify(resetSongs));
      }

      // Clear UI state for marking songs as played (so they can be marked again)
      removeKeys((key) => key.startsWith("ultimate-gig:ui:can-mark-played-"));

      setFeedback({
        scope: "songs",
        state: "success",
        message: "Song history reset. Play counts and last played dates have been cleared.",
      });
    } catch (error) {
      console.error("Failed to clear song data", error);
      setFeedback({
        scope: "songs",
        state: "error",
        message: "Unable to clear song data. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage Ultimate Gig preferences and locally stored data.
          </p>
        </div>
        <Link href="/" className={subtleActionButtonClass}>
          Back to dashboard
        </Link>
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Data & privacy
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Remove all locally stored playlists, songs, playback stats, and UI preferences from this device.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <div className="text-sm">
              <p className="font-medium">Clear all application data</p>
              <p className="text-xs opacity-80">
                This action cannot be undone. You&apos;ll need to re-import playlists afterwards.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearData}
              className="inline-flex w-full items-center justify-center rounded-md border border-red-500/40 bg-red-600/90 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-400"
            >
              Clear everything
            </button>
            {feedback?.scope === "all" && (
              <p
                className={`text-xs ${
                  feedback.state === "success"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-red-600 dark:text-red-300"
                }`}
              >
                {feedback.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-zinc-900 shadow-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100">
            <div className="text-sm">
              <p className="font-medium">Reset song history</p>
              <p className="text-xs opacity-80">
                Resets play counts and last played dates. Playlists and songs remain intact.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearSongData}
              className="inline-flex w-full items-center justify-center rounded-md border border-yellow-400/60 bg-yellow-500/90 px-3 py-2 text-sm font-medium text-yellow-950 shadow-sm transition hover:bg-yellow-500 dark:border-yellow-400/40 dark:bg-yellow-500/70"
            >
              Reset history
            </button>
            {feedback?.scope === "songs" && (
              <p
                className={`text-xs ${
                  feedback.state === "success"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-red-600 dark:text-red-300"
                }`}
              >
                {feedback.message}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
