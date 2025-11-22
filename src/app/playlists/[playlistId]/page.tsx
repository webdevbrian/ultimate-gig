"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Table, useTable } from "ka-table";
import { DataType, SortingMode } from "ka-table/enums";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Playlist, PlaylistItem, Song } from "@/lib/models";
import { SpotifyIcon } from "@/components/icons/SpotifyIcon";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";

type TableStateSnapshot = Record<string, unknown>;

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = params.playlistId as string;

  const [playlists, , playlistsHydrated] = useLocalStorage<Playlist[]>(
    "ultimate-gig:playlists",
    [],
  );
  const [songs, , songsHydrated] = useLocalStorage<Song[]>(
    "ultimate-gig:songs",
    [],
  );
  const [playlistItems, , playlistItemsHydrated] = useLocalStorage<PlaylistItem[]>(
    "ultimate-gig:playlist-items",
    [],
  );

  const hydrated = playlistsHydrated && songsHydrated && playlistItemsHydrated;

  const playlist = hydrated
    ? playlists.find((p) => p.id === playlistId)
    : undefined;

  const [search, setSearch] = useState("");
  const [songsTableState, setSongsTableState] = useLocalStorage<TableStateSnapshot>(
    "ultimate-gig:ui:playlist-songs-table",
    {},
  );
  const subtleActionButtonClass =
    "inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  const songsTable = useTable({
    onDispatch: (_action, tableState) => {
      const { data: _data, ...rest } = (tableState as unknown) as TableStateSnapshot & {
        data?: unknown;
      };
      void _data;
      setSongsTableState(rest);
    },
  });

  const data = useMemo(() => {
    const bySongId = new Map(songs.map((song) => [song.id, song] as const));

    let rows = playlistItems
      .filter((item) => item.playlistId === playlistId)
      .map((item) => {
        const song = bySongId.get(item.songId);
        return song
          ? {
              position: item.position,
              song,
              title: song.title,
              artist: song.artist,
              playCount: song.playCount || 0,
              lastPlayedAt: song.lastPlayedAt,
              id: `${song.id}-${item.position}`, // Unique row key
              songId: song.id,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((row) => {
        const title = row.song.title.toLowerCase();
        const artist = row.song.artist.toLowerCase();
        return title.includes(query) || artist.includes(query);
      });
    }

    return rows;
  }, [playlistItems, playlistId, songs, search]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Link href="/" className={subtleActionButtonClass}>
          Back to playlists
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
          Loading playlist
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="space-y-4">
        <Link href="/" className={subtleActionButtonClass}>
          Back to playlists
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Playlist not found. It may have been removed from this device.
        </div>
      </div>
    );
  }

  const songCount = data.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/" className={subtleActionButtonClass}>
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
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-zinc-400 dark:border-white/15 dark:bg-black dark:text-white dark:focus:border-white/60 sm:w-72"
            />
          </div>
        </div>

        <div className="ka-table-wrapper overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-white/10 dark:bg-black/60">
          {data.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No songs in this playlist yet. Once synced from Ultimate Guitar,
              songs will appear here.
            </div>
          ) : (
            <Table
              table={songsTable}
              columnReordering
              columns={[
                {
                  key: "position",
                  title: "#",
                  dataType: DataType.Number,
                  width: 60,
                  isResizable: true,
                  style: { textAlign: "center" },
                },
                {
                  key: "artist",
                  title: "Artist",
                  dataType: DataType.String,
                  width: 220,
                  isResizable: true,
                },
                {
                  key: "title",
                  title: "Title",
                  dataType: DataType.String,
                  width: 260,
                  isResizable: true,
                },
                {
                  key: "playCount",
                  title: "Popularity",
                  dataType: DataType.Number,
                  width: 90,
                  isResizable: true,
                  style: { textAlign: "center" },
                },
                {
                  key: "lastPlayedAt",
                  title: "Last Played",
                  dataType: DataType.String,
                  width: 140,
                  isResizable: true,
                },
              ]}
              data={data}
              rowKeyField="id"
              sortingMode={SortingMode.Single}
              {...songsTableState}
              childComponents={{
                headCell: {
                  elementAttributes: () => ({
                    className:
                      "px-4 py-2 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-white/10",
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
                    if (props.column.key === "title") {
                      const row = props.rowData as (typeof data)[number];
                      return (
                        <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
                          <Link
                            href={`/songs/${row.songId}?playlistId=${playlistId}`}
                            className="hover:underline"
                          >
                            {row.title}
                          </Link>
                          {row.song.spotifyTrackId ? (
                            <Link
                              href={`https://open.spotify.com/track/${row.song.spotifyTrackId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 transition hover:text-[#1DB954]"
                              aria-label={`Open ${row.title} on Spotify`}
                            >
                              <SpotifyIcon className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          ) : null}
                          {row.song.youtubeUrl ? (
                            <Link
                              href={row.song.youtubeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 transition hover:text-[#FF0000]"
                              aria-label={`Open ${row.title} on YouTube`}
                            >
                              <YoutubeIcon className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          ) : null}
                        </div>
                      );
                    }
                    if (props.column.key === "lastPlayedAt") {
                      const row = props.rowData as (typeof data)[number];
                      if (!row.lastPlayedAt) return <span className="text-zinc-400">Never</span>;
                      const date = new Date(row.lastPlayedAt);
                      return (
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      );
                    }
                    return props.value;
                  },
                },
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
