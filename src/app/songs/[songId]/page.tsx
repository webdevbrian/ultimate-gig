"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SpotifyIcon } from "@/components/icons/SpotifyIcon";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { ChordDisplay } from "@/components/chords/ChordDisplay";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { PlaylistItem, Song, UgTabResponse } from "@/lib/models";
import { decodeHtmlEntities } from "@/lib/utils";

export default function SongDetailPage() {
  const params = useParams<{ songId: string }>();
  const searchParams = useSearchParams();
  const playlistId = searchParams.get("playlistId");

  const songId = params.songId as string;
  const [songs, setSongs, songsHydrated] = useLocalStorage<Song[]>(
    "ultimate-gig:songs",
    [],
  );
  const [playlistItems, , playlistItemsHydrated] = useLocalStorage<PlaylistItem[]>(
    "ultimate-gig:playlist-items",
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
  const [tabFontSize, setTabFontSize] = useLocalStorage<number>(
    "ultimate-gig:ui:tab-font-size",
    12,
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
  const [mediaLinkOpen, setMediaLinkOpen] = useLocalStorage<boolean>(
    "ultimate-gig:ui:media-link-open",
    false,
  );
  const [chordsVisible, setChordsVisible] = useLocalStorage<boolean>(
    "ultimate-gig:ui:chords-visible",
    true,
  );
  const [chordScale] = useLocalStorage<number>("ultimate-gig:ui:chord-scale", 1);
  const [mediaLinkInput, setMediaLinkInput] = useState("");
  const [mediaStatus, setMediaStatus] = useState<
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | null
  >(null);
  const [justMarkedAsPlayed, setJustMarkedAsPlayed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionObserverRef = useRef<ResizeObserver | null>(null);
  const subtleActionButtonClass =
    "inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  const updateScrollContainerHeight = useCallback(() => {
    if (typeof window === "undefined") return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportOffsetTop = viewport?.offsetTop ?? 0;
    const available = viewportHeight + viewportOffsetTop - rect.top - 16;

    if (available > 0) {
      container.style.height = `${available}px`;
      container.style.maxHeight = `${available}px`;
    } else {
      container.style.removeProperty("height");
      container.style.removeProperty("max-height");
    }
  }, []);

  const setScrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      if (node) {
        updateScrollContainerHeight();
      }
    },
    [updateScrollContainerHeight],
  );

  const setSectionRef = useCallback(
    (node: HTMLElement | null) => {
      if (sectionObserverRef.current) {
        sectionObserverRef.current.disconnect();
        sectionObserverRef.current = null;
      }

      if (node && typeof window !== "undefined" && "ResizeObserver" in window) {
        const observer = new ResizeObserver(() => {
          updateScrollContainerHeight();
        });
        observer.observe(node);
        sectionObserverRef.current = observer;
        updateScrollContainerHeight();
      }
    },
    [updateScrollContainerHeight],
  );

  const song = useMemo(
    () => (songsHydrated ? songs.find((s) => s.id === songId) : undefined),
    [songs, songId, songsHydrated],
  );

  const playlistSongs = useMemo(() => {
    if (!playlistId || !songsHydrated || !playlistItemsHydrated) return [];

    const bySongId = new Map(songs.map((s) => [s.id, s] as const));

    return playlistItems
      .filter((item) => item.playlistId === playlistId)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((item) => {
        const playlistSong = bySongId.get(item.songId);
        return playlistSong ? { item, song: playlistSong } : null;
      })
      .filter((entry): entry is { item: PlaylistItem; song: Song } => entry != null);
  }, [playlistId, playlistItems, playlistItemsHydrated, songs, songsHydrated]);

  const currentPlaylistIndex = playlistSongs.findIndex((entry) => entry.song.id === songId);
  const previousPlaylistSong =
    currentPlaylistIndex > 0 ? playlistSongs[currentPlaylistIndex - 1] : undefined;
  const nextPlaylistSong =
    currentPlaylistIndex >= 0 && currentPlaylistIndex < playlistSongs.length - 1
      ? playlistSongs[currentPlaylistIndex + 1]
      : undefined;
  const playlistQuery = playlistId ? `?playlistId=${encodeURIComponent(playlistId)}` : "";

  const currentNotes = notesBySongId[songId] ?? "";
  const hasNotes = currentNotes.trim().length > 0;
  const hasMediaLink = Boolean(song?.spotifyTrackId || song?.youtubeUrl);

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

  useEffect(() => {
    if (!song) return;
    const nextValue = song.spotifyTrackId
      ? `https://open.spotify.com/track/${song.spotifyTrackId}`
      : song.youtubeUrl
        ? song.youtubeUrl
        : "";
    setMediaLinkInput(nextValue);
    setMediaStatus(null);
  }, [song?.spotifyTrackId, song?.youtubeUrl, song]);

  // Reset the "just marked as played" flag when song changes
  useEffect(() => {
    setJustMarkedAsPlayed(false);
  }, [songId]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const handleSaveMediaLink = (overrideValue?: string) => {
    if (!song) return;
    const value = (overrideValue ?? mediaLinkInput).trim();

    if (!value) {
      setSongs((current) =>
        current.map((entry) =>
          entry.id === song.id
            ? { ...entry, spotifyTrackId: undefined, youtubeUrl: undefined }
            : entry,
        ),
      );
      setMediaStatus({ type: "success", message: "Streaming link cleared." });
      return;
    }

    const parsed = parseMediaLink(value);
    if (!parsed) {
      setMediaStatus({
        type: "error",
        message: "Enter a valid Spotify track URL/URI or YouTube link.",
      });
      return;
    }

    setSongs((current) =>
      current.map((entry) => {
        if (entry.id !== song.id) return entry;
        if (parsed.type === "spotify") {
          return { ...entry, spotifyTrackId: parsed.trackId };
        }
        return { ...entry, youtubeUrl: parsed.url };
      }),
    );

    setMediaStatus({
      type: "success",
      message: `Link saved for ${parsed.type === "spotify" ? "Spotify" : "YouTube"}.`,
    });
  };

  const handleClearMediaLink = () => {
    setMediaLinkInput("");
    setMediaStatus(null);
    handleSaveMediaLink("");
  };

  const handleMarkAsPlayed = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!song) return;

    // Only allow unmarking if it was marked in this session
    if (justMarkedAsPlayed) {
      // Unmark - reset count and timestamp
      setSongs((current) =>
        current.map((entry) =>
          entry.id === song.id
            ? {
                ...entry,
                playCount: Math.max(0, (entry.playCount || 0) - 1),
                lastPlayedAt: (entry.playCount || 0) > 1 ? entry.lastPlayedAt : undefined,
              }
            : entry,
        ),
      );
      setJustMarkedAsPlayed(false);
    } else {
      // Mark as played - increment count and set timestamp
      setSongs((current) =>
        current.map((entry) =>
          entry.id === song.id
            ? {
                ...entry,
                playCount: (entry.playCount || 0) + 1,
                lastPlayedAt: new Date().toISOString(),
              }
            : entry,
        ),
      );
      setJustMarkedAsPlayed(true);

      // Capture button position before async import
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      // Trigger confetti from the button position
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 50,
          spread: 60,
          origin: { x, y },
          colors: ['#10b981', '#34d399', '#6ee7b7'],
        });
      });
    }
  };

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

    window.addEventListener("resize", updateScrollContainerHeight);
    return () => {
      window.removeEventListener("resize", updateScrollContainerHeight);
    };
  }, [updateScrollContainerHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handler = () => updateScrollContainerHeight();
    viewport.addEventListener("resize", handler);
    viewport.addEventListener("scroll", handler);

    return () => {
      viewport.removeEventListener("resize", handler);
      viewport.removeEventListener("scroll", handler);
    };
  }, [updateScrollContainerHeight]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    updateScrollContainerHeight();
    const rafId = window.requestAnimationFrame(updateScrollContainerHeight);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    controlsCollapsed,
    notesOpen,
    mediaLinkOpen,
    chordsVisible,
    chordScale,
    rawTabText,
    isLoading,
    song?.id,
    tab?.chordShapes,
    updateScrollContainerHeight,
  ]);

  useEffect(() => {
    return () => {
      sectionObserverRef.current?.disconnect();
    };
  }, []);

  const increaseFontSize = () => {
    setTabFontSize((current) => {
      const value = Number.isFinite(current) ? current : 12;
      return Math.min(24, value + 1);
    });
  };

  const decreaseFontSize = () => {
    setTabFontSize((current) => {
      const value = Number.isFinite(current) ? current : 12;
      return Math.max(6, value - 1);
    });
  };

  if (!songsHydrated) {
    return (
      <div className="space-y-4">
        <Link
          href={playlistId ? `/playlists/${playlistId}` : "/"}
          className={subtleActionButtonClass}
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
          className={subtleActionButtonClass}
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {previousPlaylistSong ? (
              <Link
                href={`/songs/${previousPlaylistSong.song.id}${playlistQuery}`}
                className={subtleActionButtonClass}
              >
                {`Previous: ${decodeHtmlEntities(previousPlaylistSong.song.artist)} | ${decodeHtmlEntities(previousPlaylistSong.song.title)}`}
              </Link>
            ) : null}
            {nextPlaylistSong ? (
              <Link
                href={`/songs/${nextPlaylistSong.song.id}${playlistQuery}`}
                className={subtleActionButtonClass}
              >
                {`Next: ${decodeHtmlEntities(nextPlaylistSong.song.artist)} | ${decodeHtmlEntities(nextPlaylistSong.song.title)}`}
              </Link>
            ) : null}
          </div>
          <div className="ml-auto">
            {playlistId ? (
              <Link href={`/playlists/${playlistId}`} className={subtleActionButtonClass}>
                Back to playlist
              </Link>
            ) : (
              <Link href="/" className={subtleActionButtonClass}>
                Back to playlists
              </Link>
            )}
          </div>
        </div>
        {!controlsCollapsed && (
          <>
            <section className="space-y-1 rounded-md border border-dashed border-zinc-300 bg-white/70 p-2 text-[11px] text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Song notes</span>
                <button
                  type="button"
                  onClick={() => setNotesOpen((prev) => !prev)}
                  className={subtleActionButtonClass}
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
            <section className="space-y-1 rounded-md border border-dashed border-zinc-300 bg-white/70 p-2 text-[11px] text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Streaming link</span>
                <button
                  type="button"
                  onClick={() => setMediaLinkOpen((prev) => !prev)}
                  className={subtleActionButtonClass}
                >
                  {mediaLinkOpen ? "Hide link" : hasMediaLink ? "Show link" : "Add link"}
                </button>
              </div>
              {mediaLinkOpen && (
                <>
                  {hasMediaLink && (
                    <div className="flex flex-wrap items-center gap-2">
                      {song?.spotifyTrackId ? (
                        <Link
                          href={`https://open.spotify.com/track/${song.spotifyTrackId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-medium text-zinc-500 transition hover:text-[#1DB954]"
                        >
                          Open on Spotify
                        </Link>
                      ) : null}
                      {song?.youtubeUrl ? (
                        <Link
                          href={song.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-medium text-zinc-500 transition hover:text-[#FF0000]"
                        >
                          Open on YouTube
                        </Link>
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={mediaLinkInput}
                      onChange={(event) => setMediaLinkInput(event.target.value)}
                      placeholder="Paste Spotify or YouTube link"
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-800 shadow-inner outline-none focus:border-zinc-500 focus:ring-0 dark:border-zinc-700 dark:bg-black dark:text-zinc-50 dark:focus:border-zinc-400"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveMediaLink()}
                        className={subtleActionButtonClass}
                      >
                        Save
                      </button>
                      {hasMediaLink && (
                        <button
                          type="button"
                          onClick={() => handleClearMediaLink()}
                          className={subtleActionButtonClass}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {mediaStatus ? (
                    <p
                      className={
                        mediaStatus.type === "error"
                          ? "text-xs text-red-600 dark:text-red-400"
                          : "text-xs text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {mediaStatus.message}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Examples: https://open.spotify.com/track/… or https://youtu.be/…
                    </p>
                  )}
                </>
              )}
            </section>
          </>
        )}
        {!controlsCollapsed && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{decodeHtmlEntities(song.title)}</h1>
              <div className="flex items-center gap-2">
                {song.spotifyTrackId ? (
                  <Link
                    href={`https://open.spotify.com/track/${song.spotifyTrackId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 transition hover:text-[#1DB954]"
                    aria-label="Open on Spotify"
                  >
                    <SpotifyIcon className="h-5 w-5" aria-hidden="true" />
                  </Link>
                ) : null}
                {song.youtubeUrl ? (
                  <Link
                    href={song.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 transition hover:text-[#FF0000]"
                    aria-label="Open on YouTube"
                  >
                    <YoutubeIcon className="h-5 w-5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{decodeHtmlEntities(song.artist)}</p>
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
        ref={setSectionRef}
        className="flex min-h-0 flex-1 w-full flex-col space-y-3 rounded-lg border border-black/5 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-black/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setControlsCollapsed((prev) => !prev)}
              className={subtleActionButtonClass}
            >
              {controlsCollapsed ? "Show header" : "Hide header"}
            </button>
            {tab?.chordShapes && Object.keys(tab.chordShapes).length > 0 && (
              <button
                type="button"
                onClick={() => setChordsVisible((prev) => !prev)}
                className={subtleActionButtonClass}
              >
                {chordsVisible ? "Hide chords" : "Show chords"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Font
              </span>
              <button
                type="button"
                onClick={decreaseFontSize}
                className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                -
              </button>
              <button
                type="button"
                onClick={increaseFontSize}
                className="flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoScroll((prev) => !prev)}
              className={subtleActionButtonClass}
            >
              {autoScroll ? "Stop auto-scroll" : "Start auto-scroll"}
            </button>
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

            <button
              type="button"
              onClick={handleMarkAsPlayed}
              className={`inline-flex items-center justify-center rounded border px-2 py-0.5 text-[11px] font-medium shadow-sm transition ${
                justMarkedAsPlayed
                  ? "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  : "border-emerald-500 bg-white text-emerald-600 hover:bg-emerald-50 dark:border-emerald-600 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
              }`}
            >
              {justMarkedAsPlayed ? "Unmark played" : "Mark as played"}
            </button>
          </div>
        </div>

        {/* Chord diagrams section */}
        {tab?.chordShapes && Object.keys(tab.chordShapes).length > 0 && chordsVisible && (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white/70 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
            <ChordDisplay chordShapes={tab.chordShapes} isDark={isDarkMode} />
          </div>
        )}

        <div
          ref={setScrollContainerRef}
          className="flex-1 overflow-y-auto pt-2 pb-4"
        >
          {isLoading ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Loading tab from Ultimate Guitar…
            </p>
          ) : error ? (
            <div className="space-y-3">
              {song?.ugTabType === "pro" ? (
                <>
                  <div className="space-y-2 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Guitar Pro Tab
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      This is a Guitar Pro tab that requires special software to view.
                      Guitar Pro tabs include interactive features like playback, tempo control, and multi-track arrangements.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={song.ugTabUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      Open on Ultimate Guitar
                    </a>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      You&apos;ll need a Guitar Pro subscription or the Guitar Pro software to view this tab
                    </p>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : rawTabText ? (
            <pre
              className="font-mono whitespace-pre text-zinc-900 dark:text-zinc-100"
              style={{ fontSize: `${tabFontSize || 12}px`, lineHeight: 1.4 }}
            >
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


type MediaLinkInfo =
  | { type: "spotify"; trackId: string; url: string }
  | { type: "youtube"; videoId: string; url: string };

function extractSpotifyTrackId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const directIdMatch = trimmed.match(/^[0-9A-Za-z]{22}$/);
  if (directIdMatch) return trimmed;

  const trackUrlMatch = trimmed.match(/track[/:]([0-9A-Za-z]{22})/);
  if (trackUrlMatch) return trackUrlMatch[1];

  const uriMatch = trimmed.match(/spotify:track:([0-9A-Za-z]{22})/);
  if (uriMatch) return uriMatch[1];

  return undefined;
}

function extractYoutubeVideoId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host.includes("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v") ?? undefined;
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] ?? undefined;
      }
    }
    if (host.includes("youtu.be")) {
      return url.pathname.slice(1) || undefined;
    }
  } catch {
    const match = trimmed.match(/youtu(?:\.be|be\.com)\/([0-9A-Za-z_-]{11})/);
    if (match) return match[1];
  }

  const directIdMatch = trimmed.match(/^[0-9A-Za-z_-]{11}$/);
  if (directIdMatch) return trimmed;
  return undefined;
}

function parseMediaLink(value: string): MediaLinkInfo | null {
  const spotifyId = extractSpotifyTrackId(value);
  if (spotifyId) {
    return {
      type: "spotify",
      trackId: spotifyId,
      url: `https://open.spotify.com/track/${spotifyId}`,
    };
  }

  const youtubeId = extractYoutubeVideoId(value);
  if (youtubeId) {
    return {
      type: "youtube",
      videoId: youtubeId,
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
    };
  }

  return null;
}
