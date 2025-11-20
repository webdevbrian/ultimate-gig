"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  Playlist,
  PlaylistItem,
  Song,
  UgImportResponse,
} from "@/lib/models";

type SortKey = "importedAt" | "name";

type PlaylistColumnKey = "playlist" | "imported" | "lastSynced" | "songs" | "actions";
type PlaylistColumnWidths = Record<PlaylistColumnKey, number>;

export default function Home() {
  const [playlists, setPlaylists] = useLocalStorage<Playlist[]>(
    "ultimate-gig:playlists",
    [],
  );
  const [, setSongs] = useLocalStorage<Song[]>("ultimate-gig:songs", []);
  const [, setPlaylistItems] = useLocalStorage<PlaylistItem[]>(
    "ultimate-gig:playlist-items",
    [],
  );
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [search, setSearch] = useLocalStorage<string>(
    "ultimate-gig:playlists:search",
    "",
  );
  const [sortKey, setSortKey] = useLocalStorage<SortKey>(
    "ultimate-gig:playlists:sort-key",
    "importedAt",
  );
  const [sortDir, setSortDir] = useLocalStorage<"asc" | "desc">(
    "ultimate-gig:playlists:sort-dir",
    "desc",
  );

  const [columnWidths, setColumnWidths] = useLocalStorage<PlaylistColumnWidths>(
    "ultimate-gig:playlists:column-widths",
    {
      playlist: 260,
      imported: 160,
      lastSynced: 180,
      songs: 90,
      actions: 110,
    },
  );

  const visiblePlaylists = useMemo(() => {
    let items = [...playlists];

    const query = search.trim().toLowerCase();
    if (query) {
      items = items.filter((p) => p.name.toLowerCase().includes(query));
    }

    items.sort((a, b) => {
      let aVal: string = "";
      let bVal: string = "";

      if (sortKey === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else {
        aVal = a.importedAt;
        bVal = b.importedAt;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [playlists, search, sortKey, sortDir]);

  async function handleImportSubmit(event: React.FormEvent) {
    event.preventDefault();
    const url = importUrl.trim();
    if (!url) return;

    setImportError(null);
    setIsImporting(true);

    try {
      const res = await fetch("/api/ug/import-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, mode: "live" }),
      });

      if (!res.ok) {
        let message = "Import failed";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        setImportError(message);
        return;
      }

      const data = (await res.json()) as UgImportResponse;

      const now = new Date().toISOString();
      const sourcePlaylistId = data.playlist.sourcePlaylistId;
      const existing = playlists.find(
        (p) => p.sourcePlaylistId === sourcePlaylistId,
      );
      const playlistId =
        existing?.id ||
        `pl_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      setPlaylists((current) => {
        const already = current.find(
          (p) => p.sourcePlaylistId === sourcePlaylistId,
        );
        const totalSongs = data.songs.length;

        if (already) {
          return current.map((p) =>
            p.id === already.id
              ? {
                  ...p,
                  name: data.playlist.name || p.name,
                  description:
                    data.playlist.description !== undefined
                      ? data.playlist.description
                      : p.description,
                  lastSyncedAt: now,
                  totalSongs,
                }
              : p,
          );
        }

        const newPlaylist: Playlist = {
          id: playlistId,
          source: "ultimate-guitar",
          sourcePlaylistId,
          name: data.playlist.name || "Ultimate Guitar playlist",
          description:
            data.playlist.description ||
            "Imported by URL (details to be synced)",
          importedAt: now,
          lastSyncedAt: now,
          totalSongs,
          spotifyPlaylistId: undefined,
          youtubePlaylistId: undefined,
        };

        return [newPlaylist, ...current];
      });

      setSongs((current) => {
        const existingById = new Map(current.map((s) => [s.id, s] as const));
        const next = [...current];

        for (const apiSong of data.songs) {
          if (existingById.has(apiSong.id)) continue;
          next.push({
            id: apiSong.id,
            title: apiSong.title,
            artist: apiSong.artist,
            ugTabUrl: apiSong.ugTabUrl,
            ugTabType: apiSong.ugTabType,
          });
        }

        return next;
      });

      setPlaylistItems((current) => {
        const filtered = current.filter(
          (item) => item.playlistId !== playlistId,
        );
        const next = [...filtered];

        for (const item of data.playlistItems) {
          next.push({
            id: `pi_${playlistId}_${item.position}_${item.songId}`,
            playlistId,
            position: item.position,
            songId: item.songId,
          });
        }

        return next;
      });

      setImportUrl("");
    } catch {
      setImportError("Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  function handleRemove(id: string) {
    setPlaylists((current) => current.filter((p) => p.id !== id));
  }

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
    key: PlaylistColumnKey,
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[key] ?? 120;
    const minWidth = 80;

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

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Playlists</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Import Ultimate Guitar playlists, keep them in sync locally, and prepare
          them for gigs.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-black/60">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={handleImportSubmit}
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ultimate Guitar shared playlist URL
            </label>
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.ultimate-guitar.com/user/playlist/shared?h=..."
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-black/40 dark:border-white/15 dark:bg-black dark:text-white dark:focus:border-white/60"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isImporting}
              className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {isImporting ? "Importing…" : "Import playlist"}
            </button>
          </div>
        </form>
        {importError ? (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {importError}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          This currently stores playlist metadata locally and will later sync
          song titles, tabs, and Spotify/YouTube links.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {playlists.length} playlist{playlists.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by playlist name"
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-black/40 dark:border-white/15 dark:bg-black dark:text-white dark:focus:border-white/60 sm:w-64"
            />
            <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <span>Sort by</span>
              <button
                type="button"
                onClick={() => toggleSort("importedAt")}
                className={`rounded px-2 py-1 ${
                  sortKey === "importedAt"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Imported
              </button>
              <button
                type="button"
                onClick={() => toggleSort("name")}
                className={`rounded px-2 py-1 ${
                  sortKey === "name"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Name
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-black/5 bg-white/80 text-sm shadow-sm dark:border-white/10 dark:bg-black/60">
          {visiblePlaylists.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No playlists yet. Import a playlist URL above to get started.
            </div>
          ) : (
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="bg-black/5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                <tr>
                  <th
                    className="px-4 py-2 relative"
                    style={{ width: columnWidths.playlist }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>Playlist</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("playlist", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 relative"
                    style={{ width: columnWidths.imported }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>Imported</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("imported", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 relative"
                    style={{ width: columnWidths.lastSynced }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>Last synced</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("lastSynced", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-center relative"
                    style={{ width: columnWidths.songs }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-full text-center">Songs</span>
                      <div
                        className="h-4 w-[6px] cursor-col-resize bg-zinc-300 hover:bg-zinc-500 dark:bg-zinc-600 dark:hover:bg-zinc-300"
                        onMouseDown={(event) =>
                          handleColumnResizeStart("songs", event)
                        }
                      />
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right relative"
                    style={{ width: columnWidths.actions }}
                  >
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePlaylists.map((playlist, index) => {
                  const imported = new Date(playlist.importedAt).toLocaleString();
                  const lastSynced = playlist.lastSyncedAt
                    ? new Date(playlist.lastSyncedAt).toLocaleString()
                    : "—";
                  const isLast = index === visiblePlaylists.length - 1;

                  return (
                    <tr
                      key={playlist.id}
                      className={
                        !isLast
                          ? "border-b border-black/5 dark:border-white/10"
                          : undefined
                      }
                    >
                      <td
                        className="px-4 py-3 align-top"
                        style={{ width: columnWidths.playlist }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            <Link
                              href={`/playlists/${playlist.id}`}
                              className="hover:underline"
                            >
                              {playlist.name}
                            </Link>
                          </div>
                          {playlist.description ? (
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {playlist.description}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-400"
                        style={{ width: columnWidths.imported }}
                      >
                        {imported}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-400"
                        style={{ width: columnWidths.lastSynced }}
                      >
                        {lastSynced}
                      </td>
                      <td
                        className="px-4 py-3 text-center align-top text-sm tabular-nums text-zinc-900 dark:text-zinc-50"
                        style={{ width: columnWidths.songs }}
                      >
                        {playlist.totalSongs}
                      </td>
                      <td
                        className="px-4 py-3 text-right align-top"
                        style={{ width: columnWidths.actions }}
                      >
                        <button
                          type="button"
                          onClick={() => handleRemove(playlist.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
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
