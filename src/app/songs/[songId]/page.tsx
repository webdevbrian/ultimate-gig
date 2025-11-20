"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Song, UgTabResponse } from "@/lib/models";

export default function SongDetailPage() {
  const params = useParams<{ songId: string }>();
  const searchParams = useSearchParams();
  const playlistId = searchParams.get("playlistId");

  const songId = params.songId as string;
  const [songs] = useLocalStorage<Song[]>("ultimate-gig:songs", []);
  const [tab, setTab] = useState<UgTabResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const song = useMemo(
    () => songs.find((s) => s.id === songId),
    [songs, songId],
  );

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
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={playlistId ? `/playlists/${playlistId}` : "/"}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {playlistId ? "Back to playlist" : "Back to playlists"}
        </Link>
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
      </div>

      <section className="space-y-3 rounded-lg border border-black/5 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-black/60">
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
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
