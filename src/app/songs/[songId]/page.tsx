"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Song, UgTabResponse } from "@/lib/models";

export default function SongDetailPage() {
  const params = useParams<{ songId: string }>();
  const searchParams = useSearchParams();
  const playlistId = searchParams.get("playlistId");

  const songId = params.songId as string;
  const [songs, , songsHydrated] = useLocalStorage<Song[]>(
    "ultimate-gig:songs",
    [],
  );
  const [tab, setTab] = useState<UgTabResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoScroll, setAutoScroll] = useState(false);
  // Scroll speed multiplier, 0.1x – 3.0x in 0.1 increments.
  // 1.0x is calibrated to feel like the old 0.3 speed.
  const [scrollSpeed, setScrollSpeed] = useLocalStorage<number>(
    "ultimate-gig:ui:tab-scroll-speed",
    1,
  );
  const [controlsCollapsed, setControlsCollapsed] = useLocalStorage<boolean>(
    "ultimate-gig:ui:tab-header-collapsed",
    false,
  );
  const [notesBySongId, setNotesBySongId] = useLocalStorage<Record<string, string>>(
    "ultimate-gig:tab-notes",
    {},
  );
  const [notesOpen, setNotesOpen] = useLocalStorage<boolean>(
    "ultimate-gig:ui:tab-notes-open",
    false,
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const song = useMemo(
    () => (songsHydrated ? songs.find((s) => s.id === songId) : undefined),
    [songs, songId, songsHydrated],
  );

  const currentNotes = notesBySongId[songId] ?? "";
  const hasNotes = currentNotes.trim().length > 0;

  const ugTabUrl = song?.ugTabUrl ?? "";

  useEffect(() => {
    if (!ugTabUrl) {
      setTab(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ug/fetch-tab", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: ugTabUrl, mode: "live" }),
        });

        if (!res.ok) {
          let message = "Failed to load tab";
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {}
          if (!cancelled) setError(message);
          return;
        }

        const data = (await res.json()) as UgTabResponse;
        if (!cancelled) setTab(data);
      } catch {
        if (!cancelled) setError("Failed to load tab");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [ugTabUrl]);

  const rawTabText = useMemo(
    () => (tab?.content ? formatWikiTabAsPlainText(tab.content) : ""),
    [tab?.content],
  );

  // Simple vertical auto-scroll for the tab text. Speed is a scalar
  // (0.1x–3.0x) applied to a base pixels-per-second value.
  useEffect(() => {
    if (!autoScroll) return undefined;

    const container = scrollContainerRef.current;
    if (!container) return undefined;

    let animationFrameId: number;
    let lastTime: number | null = null;
    let accumulator = 0; // fractional pixels carried between frames

    // Base scroll speed in pixels/second at 1.0x. This is chosen so that
    // 1.0x feels like the previous 0.3 setting (~9 px/sec).
    const basePixelsPerSecond = 9;

    const step = (timestamp: number) => {
      if (!scrollContainerRef.current) return;

      if (lastTime == null) {
        lastTime = timestamp;
      }

      const deltaMs = timestamp - lastTime;
      lastTime = timestamp;

      const pixelsPerSecond = basePixelsPerSecond * scrollSpeed;
      const deltaPx = (pixelsPerSecond * deltaMs) / 1000;

      accumulator += deltaPx;
      const wholePixels = Math.floor(accumulator);
      if (wholePixels > 0) {
        scrollContainerRef.current.scrollTop += wholePixels;
        accumulator -= wholePixels;
      }

      // Stop when we've reached the bottom.
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current;
      if (scrollTop + clientHeight >= scrollHeight) return;

      animationFrameId = window.requestAnimationFrame(step);
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, [autoScroll, scrollSpeed, rawTabText]);

  // When the header is collapsed on the song page, also hide the global
  // app header that contains "Ultimate Gig" and "Local & offline-friendly".
  useEffect(() => {
    const headerEl = document.querySelector("header");
    if (!headerEl) return undefined;

    const element = headerEl as HTMLElement;
    if (controlsCollapsed) {
      element.style.display = "none";
    } else {
      element.style.display = "";
    }

    return () => {
      // Ensure the header is restored when leaving the song page.
      element.style.display = "";
    };
  }, [controlsCollapsed]);

  // Constrain the tab section to the viewport bottom so it has a natural
  // scrollbar on the section itself.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateMaxHeight = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const available = viewportHeight - rect.top - 16; // 16px bottom offset

      if (available > 0) {
        container.style.maxHeight = `${available}px`;
      } else {
        container.style.removeProperty("max-height");
      }
    };

    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);

    return () => {
      window.removeEventListener("resize", updateMaxHeight);
    };
  }, [controlsCollapsed, notesOpen]);

  if (!songsHydrated) {
    return (
      <div className="space-y-4">
        <Link
          href={playlistId ? `/playlists/${playlistId}` : "/"}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
          Loading song…
        </div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="space-y-4">
        <Link
          href={playlistId ? `/playlists/${playlistId}` : "/"}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Song not found. It may have been removed from this device.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col space-y-6">
      <div className="space-y-2">
        <Link
          href={playlistId ? `/playlists/${playlistId}` : "/"}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {playlistId ? "Back to playlist" : "Back to playlists"}
        </Link>
        <section className="space-y-1 rounded-md border border-dashed border-zinc-300 bg-white/70 p-2 text-[11px] text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Song notes</span>
            <button
              type="button"
              onClick={() => setNotesOpen((prev) => !prev)}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {notesOpen ? "Hide notes" : hasNotes ? "Show notes" : "Add notes"}
            </button>
          </div>
          {notesOpen && (
            <textarea
              value={currentNotes}
              onChange={(event) =>
                setNotesBySongId((current) => ({
                  ...current,
                  [songId]: event.target.value,
                }))
              }
              rows={3}
              placeholder="Add reminders, cues, capo info, etc. for this tab…"
              className="mt-1 w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-800 shadow-inner outline-none focus:border-zinc-500 focus:ring-0 dark:border-zinc-700 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-400"
            />
          )}
        </section>
        {!controlsCollapsed && (
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{song.artist}</p>
            {song.ugTabType ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                Ultimate Guitar · {song.ugTabType}
              </p>
            ) : null}
            {(tab?.tuningName || tab?.tuningValue) && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                Tuning: {tab?.tuningValue || tab?.tuningName}
              </p>
            )}
          </div>
        )}
      </div>

      <section
        ref={scrollContainerRef}
        className="flex min-h-0 flex-1 w-full flex-col space-y-3 rounded-lg border border-black/5 bg-white/80 p-4 text-sm shadow-sm overflow-y-auto dark:border-white/10 dark:bg-black/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => setControlsCollapsed((prev) => !prev)}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {controlsCollapsed ? "Show header" : "Hide header"}
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
                className="h-3 w-3 rounded border-zinc-400 text-zinc-900 shadow-sm focus:ring-0 dark:border-zinc-600 dark:bg-black"
              />
              <span>Auto-scroll</span>
            </label>
            <div className="flex items-center gap-2">
              <span>Speed</span>
              <select
                value={scrollSpeed}
                onChange={(event) =>
                  setScrollSpeed(Number.parseFloat(event.target.value) || 0.1)
                }
                className="h-6 rounded border border-zinc-300 bg-white px-1 text-[11px] text-zinc-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-zinc-500"
              >
                {Array.from({ length: 30 }, (_, index) =>
                  Number(((index + 1) * 0.1).toFixed(1)),
                ).map((value) => (
                  <option key={value} value={value}>{`${value.toFixed(1)}x`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2 pb-4">
          {isLoading ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Loading tab from Ultimate Guitar…
            </p>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                You can also open this song directly on Ultimate Guitar:
              </p>
              <a
                href={song.ugTabUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {song.ugTabUrl}
              </a>
            </div>
          ) : rawTabText ? (
            <pre className="font-mono text-xs whitespace-pre text-zinc-900 dark:text-zinc-100">
              {rawTabText}
            </pre>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              No tab content available.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function formatWikiTabAsPlainText(content: string): string {
  const decoded = decodeHtmlEntities(content);

  // Strip [tab] wrappers entirely; they only define blocks in UG.
  const withoutTabTags = decoded.replace(/\[\/?tab\]/g, "");

  // Replace chord markup [ch]C[/ch] with just the chord name "C".
  const withoutChordTags = withoutTabTags.replace(/\[ch\](.+?)\[\/ch\]/g, "$1");

  // Normalize line endings to Unix style.
  return withoutChordTags.replace(/\r\n/g, "\n");
}

function decodeHtmlEntities(value: string): string {
  if (!value) return value;

  return (
    value
      // Numeric decimal entities, e.g. &#039; or &#8217;
      .replace(/&#(\d+);/g, (_match, code) => {
        const n = Number.parseInt(code, 10);
        return Number.isNaN(n) ? _match : String.fromCharCode(n);
      })
      // Numeric hex entities, e.g. &#x2019;
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
        const n = Number.parseInt(hex, 16);
        return Number.isNaN(n) ? _match : String.fromCharCode(n);
      })
      // Common named entities we expect from UG content
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}
