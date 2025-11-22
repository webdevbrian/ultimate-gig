"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Table, useTable } from "ka-table";
import { DataType, SortingMode } from "ka-table/enums";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { Playlist, PlaylistItem, Song } from "@/lib/models";

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
  const [songsTableState, setSongsTableState] = useLocalStorage<any>(
    "ultimate-gig:ui:playlist-songs-table",
    {} as any,
  );

  const songsTable = useTable({
    onDispatch: (_action, tableState) => {
      const { data: _data, ...rest } = tableState as any;
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

  const songCount = data.length;

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
                      const row = props.rowData;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium text-zinc-900 dark:text-zinc-50">
                            <Link
                              href={`/songs/${row.songId}?playlistId=${playlistId}`}
                              className="hover:underline"
                            >
                              {row.title}
                            </Link>
                          </div>
                        </div>
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
