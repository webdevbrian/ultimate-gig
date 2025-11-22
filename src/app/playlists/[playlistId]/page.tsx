"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Playlist, PlaylistItem, Song } from "@/lib/models";

type SortKey = "position" | "title" | "artist";

type SongColumnKey = "position" | "artist" | "title";
type SongColumnWidths = Record<SongColumnKey, number>;

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId as string;

  const [playlists] = useLocalStorage<Playlist[]>(
    "ultimate-gig:playlists",
    [],
  );
  const [songs] = useLocalStorage<Song[]>("ultimate-gig:songs", []);
  const [playlistItems] = useLocalStorage<PlaylistItem[]>(
    "ultimate-gig:playlist-items",
    [],
  );

  const playlist = playlists.find((p) => p.id === playlistId);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [columnWidths, setColumnWidths] = useLocalStorage<SongColumnWidths>(
    "ultimate-gig:playlist-songs:column-widths",
    {
      position: 60,
      artist: 220,
      title: 260,
    },
  );

  const rows = useMemo(() => {
    const bySongId = new Map(songs.map((song) => [song.id, song] as const));

    return playlistItems
      .filter((item) => item.playlistId === playlistId)
      .map((item) => {
        const song = bySongId.get(item.songId);
        return song
          ? {
              position: item.position,
              song,
            }
          : null;
      })
      .filter((row): row is { position: number; song: Song } => row != null);
  }, [playlistItems, playlistId, songs]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((row) => {
        const title = row.song.title.toLowerCase();
        const artist = row.song.artist.toLowerCase();
        return title.includes(query) || artist.includes(query);
      });
    }

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      if (sortKey === "position") {
        aVal = a.position;
        bVal = b.position;
      } else if (sortKey === "title") {
        aVal = a.song.title.toLowerCase();
        bVal = b.song.title.toLowerCase();
      } else {
        aVal = a.song.artist.toLowerCase();
        bVal = b.song.artist.toLowerCase();
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, search, sortKey, sortDir]);

  function toggleSort(nextKey: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === nextKey) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return nextKey;
    });
  }

  function handleColumnResizeStart(
    key: SongColumnKey,
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[key] ?? 120;
    const minWidth = 40;

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(minWidth, Math.round(startWidth + deltaX));
      setColumnWidths((current) => ({
        ...current,
        [key]: nextWidth,
      }));
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  if (!playlist) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
           Back to playlists
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Playlist not found. It may have been removed from this device.
        </div>
      </div>
    );
  }

  const songCount = rows.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to playlists
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {playlist.name || "Playlist"}
          </h1>
          {playlist.description ? (
            <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              {playlist.description}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {songCount} song{songCount === 1 ? "" : "s"} · Imported {" "}
            {new Date(playlist.importedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Songs
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or artist"
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-black/40 dark:border-white/15 dark:bg-black dark:text-white dark:focus:border-white/60 sm:w-72"
            />
            <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <span>Sort by</span>
              <button
                type="button"
                onClick={() => toggleSort("position")}
                className={`rounded px-2 py-1 ${
                  sortKey === "position"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Original order
              </button>
              <button
                type="button"
                onClick={() => toggleSort("title")}
                className={`rounded px-2 py-1 ${
                  sortKey === "title"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Title
              </button>
              <button
                type="button"
                onClick={() => toggleSort("artist")}
                className={`rounded px-2 py-1 ${
                  sortKey === "artist"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Artist
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-black/5 bg-white/80 text-sm shadow-sm dark:border-white/10 dark:bg-black/60">
          {filteredRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No songs in this playlist yet. Once synced from Ultimate Guitar,
              songs will appear here.
            </div>
          ) : (
            <table className="min-w-full table-fixed border-separate border-spacing-0">
              <thead className="bg-black/5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                <tr>
                  <th
                    className="px-4 py-2 relative"
                    style={{ width: columnWidths.position }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>#</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("position", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 relative"
                    style={{ width: columnWidths.artist }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>Artist</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("artist", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2"
                    style={{ width: columnWidths.title }}
                  >
                    Title
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const isLast = index === filteredRows.length - 1;
                  return (
                    <tr
                      key={`${row.song.id}-${row.position}`}
                      className={
                        !isLast
                          ? "border-b border-black/5 dark:border-white/10"
                          : undefined
                      }
                    >
                      <td
                        className="px-4 py-3 align-top text-xs tabular-nums text-zinc-600 dark:text-zinc-400"
                        style={{ width: columnWidths.position }}
                      >
                        {row.position}
                      </td>
                      <td
                        className="px-4 py-3 align-top text-sm text-zinc-700 dark:text-zinc-300"
                        style={{ width: columnWidths.artist }}
                      >
                        {row.song.artist}
                      </td>
                      <td
                        className="px-4 py-3 align-top"
                        style={{ width: columnWidths.title }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            <Link href={`/songs/${row.song.id}?playlistId=${playlistId}`} className="hover:underline">{row.song.title}</Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
