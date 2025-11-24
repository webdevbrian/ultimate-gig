"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Table, useTable } from "ka-table";
import { DataType, SortingMode, EditingMode } from "ka-table/enums";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { decodeHtmlEntities } from "@/lib/utils";
import type {
  Playlist,
  PlaylistItem,
  Song,
  UgImportResponse,
} from "@/lib/models";

type SortKey = "importedAt" | "name";

export default function Home() {
  const router = useRouter();
  const [playlists, setPlaylists] = useLocalStorage<Playlist[]>(
    "ultimate-gig:playlists",
    [],
  );
  const [songs, setSongs] = useLocalStorage<Song[]>("ultimate-gig:songs", []);
  const [, setPlaylistItems] = useLocalStorage<PlaylistItem[]>(
    "ultimate-gig:playlist-items",
    [],
  );
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useLocalStorage<string>(
    "ultimate-gig:playlists:search",
    "",
  );
  const [playlistsTableState, setPlaylistsTableState] = useLocalStorage<any>(
    "ultimate-gig:ui:playlists-table",
    {} as any,
  );

  const playlistsTable = useTable({
    onDispatch: (_action, tableState) => {
      const { data: _data, ...rest } = tableState as any;
      setPlaylistsTableState(rest);
    },
  });

  const data = useMemo(() => {
    let items = [...playlists];
    const query = search.trim().toLowerCase();
    if (query) {
      items = items.filter((p) => p.name.toLowerCase().includes(query));
    }
    return items.map((p) => ({
      ...p,
      imported: new Date(p.importedAt).toLocaleString(),
      lastSynced: p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString() : "—",
    }));
  }, [playlists, search]);

  async function handleImportSubmit(event: React.FormEvent) {
    event.preventDefault();
    const url = importUrl.trim();
    if (!url) return;

    setImportError(null);
    setIsImporting(true);

    try {
      const res = await fetch("/api/ug/import-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode: "live" }),
      });

      if (!res.ok) {
        let message = "Import failed";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {}
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
        `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
            data.playlist.description || "Imported by URL (details to be synced)",
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

  async function handleSync(playlist: Playlist) {
    if (!playlist.sourcePlaylistId) return;
    if (syncingIds.has(playlist.id)) return;

    setSyncingIds((prev) => new Set(prev).add(playlist.id));
    const url = `https://www.ultimate-guitar.com/user/playlist/shared?h=${playlist.sourcePlaylistId}`;

    try {
      const res = await fetch("/api/ug/import-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode: "live" }),
      });

      if (!res.ok) {
        console.error("Sync failed");
        return;
      }

      const data = (await res.json()) as UgImportResponse;
      const now = new Date().toISOString();

      setPlaylists((current) => {
        return current.map((p) =>
          p.id === playlist.id
            ? {
                ...p,
                name: data.playlist.name || p.name,
                description:
                  data.playlist.description !== undefined
                    ? data.playlist.description
                    : p.description,
                lastSyncedAt: now,
                totalSongs: data.songs.length,
              }
            : p,
        );
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
        const filtered = current.filter((item) => item.playlistId !== playlist.id);
        const next = [...filtered];
        for (const item of data.playlistItems) {
          next.push({
            id: `pi_${playlist.id}_${item.position}_${item.songId}`,
            playlistId: playlist.id,
            position: item.position,
            songId: item.songId,
          });
        }
        return next;
      });
    } catch (error) {
      console.error("Sync error", error);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(playlist.id);
        return next;
      });
    }
  }

  function handleRemove(id: string) {
    setPlaylists((current) => current.filter((p) => p.id !== id));
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

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
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
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-0 transition focus:border-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isImporting}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
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

      <section className="ka-table-wrapper overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-white/10 dark:bg-black/60">
        {data.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No playlists yet. Import a playlist URL above to get started.
          </div>
        ) : (
          <Table
            table={playlistsTable}
            columnReordering
            columns={[
              {
                key: "name",
                title: "Playlist",
                dataType: DataType.String,
                width: 260,
                isResizable: true,
                style: { whiteSpace: "normal" },
              },
              {
                key: "imported",
                title: "Imported",
                dataType: DataType.String,
                width: 160,
                isResizable: true,
              },
              {
                key: "lastSynced",
                title: "Last Synced",
                dataType: DataType.String,
                width: 180,
                isResizable: true,
              },
              {
                key: "totalSongs",
                title: "Songs",
                dataType: DataType.Number,
                width: 90,
                isResizable: true,
                style: { textAlign: "center" },
              },
              {
                key: "actions",
                title: "Actions",
                width: 110,
                isResizable: true,
                style: { textAlign: "right" },
              },
            ]}
            data={data}
            rowKeyField="id"
            sortingMode={SortingMode.Single}
            {...playlistsTableState}
            childComponents={{
              headCell: {
                elementAttributes: () => ({
                  className:
                    "px-4 py-2 text-left bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-white/10",
                }),
              },
              cell: {
                elementAttributes: () => ({
                  className:
                    "px-4 py-2 bg-white border-b border-zinc-100 text-sm text-zinc-900 dark:bg-zinc-900 dark:border-white/5 dark:text-zinc-100",
                }),
              },
              dataRow: {
                elementAttributes: () => ({
                  className:
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                }),
              },
              cellText: {
                content: (props) => {
                  if (props.column.key === "name") {
                    const playlist = props.rowData;
                    return (
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
                    );
                  }
                  if (props.column.key === "actions") {
                    const playlist = props.rowData;
                    return (
                      <div className="flex flex-col gap-2 items-end">
                        <button
                          type="button"
                          onClick={() => handleSync(playlist)}
                          disabled={syncingIds.has(playlist.id)}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          {syncingIds.has(playlist.id) ? "Syncing..." : "Resync"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(playlist.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  }
                  return props.value;
                },
              },
            }}
          />
        )}
      </section>
    </div>
  );
}
