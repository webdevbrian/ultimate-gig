"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Table, useTable } from "ka-table";
import { DataType, SortingMode } from "ka-table/enums";
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  ChartsTooltipContainer,
  useItemTooltip,
} from "@mui/x-charts/ChartsTooltip";
import type { ChartsTooltipProps } from "@mui/x-charts/ChartsTooltip";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type {
  CachedTabEntry,
  Playlist,
  PlaylistItem,
  Song,
  UgTabResponse,
} from "@/lib/models";
import { SpotifyIcon } from "@/components/icons/SpotifyIcon";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { decodeHtmlEntities } from "@/lib/utils";

type TableStateSnapshot = Record<string, unknown>;

function adjustColor(hex: string, amount: number) {
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color.split('').map((c) => c + c).join('');
  }
  const num = parseInt(color, 16);
  if (Number.isNaN(num)) return hex;
  const clamp = (value: number) => Math.min(255, Math.max(0, value));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00ff) + amount);
  const b = clamp((num & 0x0000ff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const chartCardClass =
  "rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-gradient-to-b dark:from-[#0f172a] dark:to-[#020617] p-3";

const artistBaseColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#6366f1",
];

type ChartSongDatum = {
  id: string;
  title: string;
  artist: string;
  plays: number;
  label: string;
  color: string;
};

type ChartArtistDatum = {
  id: string;
  artist: string;
  plays: number;
  label: string;
  value: number;
  baseColor: string;
  gradientId: string;
};

type ActivityDatum = {
  date: string;
  plays: number;
  label: string;
};

function renderGradientTooltipCard(
  baseColor: string,
  header: string,
  subheader: string,
  value: string,
  isDarkMode: boolean,
) {
  const gradientStart = adjustColor(baseColor, 30);
  const gradientEnd = adjustColor(baseColor, -20);
  const primaryTextColor = isDarkMode ? "#050816" : "#020617";
  const secondaryTextColor = isDarkMode ? "rgba(5, 8, 22, 0.7)" : "rgba(2, 6, 23, 0.65)";

  return (
    <div
      style={{
        background: `linear-gradient(90deg, ${gradientStart} 0%, ${baseColor} 65%, ${gradientEnd} 100%)`,
        color: primaryTextColor,
        padding: "10px 14px",
        borderRadius: "12px",
        minWidth: "180px",
        boxShadow: `0 8px 20px ${baseColor}45`,
        border: isDarkMode
          ? "1px solid rgba(255, 255, 255, 0.25)"
          : "1px solid rgba(0, 0, 0, 0.05)",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
        {header}
      </div>
      <div
        style={{
          fontSize: "9px",
          color: secondaryTextColor,
          marginBottom: "6px",
        }}
      >
        {subheader}
      </div>
      <div style={{ fontSize: "15px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

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
  const [tabCache, setTabCache, tabCacheHydrated] = useLocalStorage<
    Record<string, CachedTabEntry>
  >("ultimate-gig:tab-cache", {});

  const hydrated = playlistsHydrated && songsHydrated && playlistItemsHydrated;

  const playlist = hydrated
    ? playlists.find((p) => p.id === playlistId)
    : undefined;

  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [songsTableState, setSongsTableState] = useLocalStorage<TableStateSnapshot>(
    "ultimate-gig:ui:playlist-songs-table",
    {},
  );
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [chartsVisible, setChartsVisible, hasChartsHydrated] = useLocalStorage<boolean>(
    `ultimate-gig:ui:charts-visible:${playlistId}`,
    true,
  );
  const subtleActionButtonClass =
    "inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
  const inlineRefreshButtonClass =
    "inline-flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800";
  const [refreshingTabIds, setRefreshingTabIds] = useState<Set<string>>(new Set());
  const [tabRefreshErrors, setTabRefreshErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

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
              title: decodeHtmlEntities(song.title),
              artist: decodeHtmlEntities(song.artist),
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

  // Get only the songs in this playlist
  const playlistSongIds = useMemo(() => {
    return new Set(
      playlistItems
        .filter((item) => item.playlistId === playlistId)
        .map((item) => item.songId)
    );
  }, [playlistItems, playlistId]);

  const playlistSongs = useMemo(() => {
    return songs.filter((song) => playlistSongIds.has(song.id));
  }, [songs, playlistSongIds]);

  // Chart data processing (filtered to this playlist)
  const chartData = useMemo(() => {
    // Filter songs that have been played (have playCount > 0)
    const playedSongs = playlistSongs.filter(song => (song.playCount || 0) > 0);

    // Top 10 played songs with colors
    const songColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];
    const topSongs: ChartSongDatum[] = playedSongs
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 10)
      .map((song, index) => ({
        id: song.id,
        title: decodeHtmlEntities(song.title),
        artist: decodeHtmlEntities(song.artist),
        plays: song.playCount || 0,
        label: `${decodeHtmlEntities(song.artist)} - ${decodeHtmlEntities(song.title)}`,
        color: songColors[index % songColors.length],
      }));

    // Top 10 played artists (aggregate by artist)
    const artistPlays = playedSongs.reduce((acc, song) => {
      const artist = decodeHtmlEntities(song.artist);
      acc[artist] = (acc[artist] || 0) + (song.playCount || 0);
      return acc;
    }, {} as Record<string, number>);

    const topArtists: ChartArtistDatum[] = Object.entries(artistPlays)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([artist, plays], index) => {
        const baseColor = artistBaseColors[index % artistBaseColors.length];
        return {
          artist,
          plays,
          id: artist,
          label: artist,
          value: plays,
          baseColor,
          gradientId: `top-artist-gradient-${index}`,
        };
      });

    const formatLocalDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Play activity over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyPlays = playedSongs
      .filter((song) => song.lastPlayedAt)
      .reduce((acc, song) => {
        if (!song.lastPlayedAt) return acc;
        const lastPlayed = new Date(song.lastPlayedAt);
        if (lastPlayed < thirtyDaysAgo) return acc;
        const dateKey = formatLocalDateKey(lastPlayed);
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Fill in missing dates with 0
    const activityData: ActivityDatum[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const dateStr = formatLocalDateKey(date);
      activityData.push({
        date: dateStr,
        plays: dailyPlays[dateStr] || 0,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }

    return {
      topSongs,
      topArtists,
      activityData,
      totalPlays: playedSongs.reduce((sum, song) => sum + (song.playCount || 0), 0),
      totalPlayedSongs: playedSongs.length,
    };
  }, [playlistSongs]);

  const topSongsChartHeight = Math.max(150, chartData.topSongs.length * 26);
  const chartSectionTextClass = isDarkMode ? "text-white" : "text-black";
  const activityPanelBackground = isDarkMode
    ? "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)"
    : "#ffffff";
  const activityAxisLabelColor = isDarkMode ? "#94a3b8" : "#111827";
  const activityAxisLineColor = isDarkMode ? "#1e293b" : "#d4d4d8";
  const activityGridColor = isDarkMode ? "#1f2937" : "#e5e7eb";
  const activityLegendColor = isDarkMode ? "#eab308" : "#a16207";

  const handleSongBarClick = useCallback((_event: React.MouseEvent<SVGElement>, { dataIndex }: { dataIndex?: number }) => {
    if (dataIndex != null && chartData.topSongs[dataIndex]) {
      const songId = chartData.topSongs[dataIndex].id;
      router.push(`/songs/${songId}?playlistId=${playlistId}`);
    }
  }, [chartData.topSongs, router, playlistId]);

  const handleRefreshTab = useCallback(
    async (song: Song) => {
      if (!song.ugTabUrl) return;
      const songId = song.id;

      setRefreshingTabIds((prev) => new Set(prev).add(songId));
      setTabRefreshErrors((prev) => {
        const next = { ...prev };
        delete next[songId];
        return next;
      });

      try {
        const res = await fetch("/api/ug/fetch-tab", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: song.ugTabUrl, mode: "live" }),
        });

        if (!res.ok) {
          let message = "Refresh failed";
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {}
          throw new Error(message);
        }

        const data = (await res.json()) as UgTabResponse;
        setTabCache((current) => ({
          ...current,
          [songId]: {
            songId,
            ugTabUrl: song.ugTabUrl,
            cachedAt: new Date().toISOString(),
            tab: data,
          },
        }));
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : "Refresh failed";
        setTabRefreshErrors((prev) => ({ ...prev, [songId]: message }));
      } finally {
        setRefreshingTabIds((prev) => {
          const next = new Set(prev);
          next.delete(songId);
          return next;
        });
      }
    },
    [setTabCache],
  );

  const handleArtistFilter = useCallback(
    (artistName: string) => {
      setSearch(artistName);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    },
    [],
  );

  const TopSongsTooltip = useMemo(() => {
    const Component = (tooltipProps: ChartsTooltipProps) => {
      const tooltipItem = useItemTooltip<'bar'>();
      const dataIndex = tooltipItem?.identifier?.dataIndex;
      const song = dataIndex != null ? chartData.topSongs[dataIndex] : undefined;
      const playsValue = tooltipItem?.formattedValue ?? (song ? `${song.plays} plays` : "");

      return (
        <ChartsTooltipContainer {...tooltipProps}>
          {song
            ? renderGradientTooltipCard(song.color, song.artist, song.title, playsValue, isDarkMode)
            : null}
        </ChartsTooltipContainer>
      );
    };

    Component.displayName = "TopSongsTooltip";
    return Component;
  }, [chartData.topSongs, isDarkMode]);

  const TopArtistsTooltip = useMemo(() => {
    const Component = (tooltipProps: ChartsTooltipProps) => {
      const tooltipItem = useItemTooltip<'pie'>();
      const dataIndex = tooltipItem?.identifier?.dataIndex;
      const artist = dataIndex != null ? chartData.topArtists[dataIndex] : undefined;
      const playsValue = tooltipItem?.formattedValue ?? (artist ? `${artist.plays} plays` : "");

      return (
        <ChartsTooltipContainer {...tooltipProps}>
          {artist
            ? renderGradientTooltipCard(
                artist.baseColor,
                artist.artist,
                "Total plays",
                playsValue,
                isDarkMode,
              )
            : null}
        </ChartsTooltipContainer>
      );
    };

    Component.displayName = "TopArtistsTooltip";
    return Component;
  }, [chartData.topArtists, isDarkMode]);

  const ActivityTooltip = useMemo(() => {
    const Component = (tooltipProps: ChartsTooltipProps) => {
      const tooltipItem = useItemTooltip<'line'>();
      const dataIndex = tooltipItem?.identifier?.dataIndex;
      const activityPoint = dataIndex != null ? chartData.activityData[dataIndex] : undefined;
      const playsValue = tooltipItem?.formattedValue ?? (activityPoint ? `${activityPoint.plays} plays` : "");

      return (
        <ChartsTooltipContainer {...tooltipProps}>
          {activityPoint
            ? renderGradientTooltipCard(
                "#facc15",
                activityPoint.label,
                "Daily plays",
                playsValue,
                isDarkMode,
              )
            : null}
        </ChartsTooltipContainer>
      );
    };

    Component.displayName = "ActivityTooltip";
    return Component;
  }, [chartData.activityData, isDarkMode]);

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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
        <Link href="/" className={`${subtleActionButtonClass} self-start md:self-auto`}>
          Back to playlists
        </Link>
      </div>

      {/* Charts Section */}
      {chartData.totalPlays > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Performance Overview</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {chartData.totalPlays} total plays across {chartData.totalPlayedSongs} songs in this playlist
              </p>
            </div>
            {hasChartsHydrated && (
              <button
                type="button"
                onClick={() => setChartsVisible(!chartsVisible)}
                className="inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {chartsVisible ? "Hide charts" : "Show charts"}
              </button>
            )}
          </div>

          {hasChartsHydrated && chartsVisible && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Top Played Songs */}
              {chartData.topSongs.length > 0 && (
                <div className={`${chartCardClass} ${chartSectionTextClass}`}>
                  <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                    Top 10 Played Songs
                  </h3>
                  <div className="flex flex-col gap-3" style={{ width: '100%' }}>
                    <div style={{ width: '100%', height: `${topSongsChartHeight}px` }}>
                      <svg width="0" height="0" aria-hidden="true" focusable="false">
                        <defs>
                          {chartData.topSongs.map((song, index) => {
                            const start = adjustColor(song.color, 35);
                            const end = adjustColor(song.color, -15);
                            return (
                              <linearGradient id={`top-song-gradient-${index}`} key={song.id} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={start} stopOpacity={0.95} />
                                <stop offset="70%" stopColor={song.color} stopOpacity={1} />
                                <stop offset="100%" stopColor={end} stopOpacity={1} />
                              </linearGradient>
                            );
                          })}
                        </defs>
                      </svg>
                      <BarChart
                        dataset={chartData.topSongs}
                        xAxis={[{
                          scaleType: 'linear',
                          min: 0,
                          max: Math.max(...chartData.topSongs.map(s => s.plays)) + 1,
                          tickMinStep: 1
                        }]}
                        yAxis={[{
                          scaleType: 'band',
                          dataKey: 'label',
                          tickLabelStyle: { display: 'none' }
                        }]}
                        series={[{
                          dataKey: 'plays',
                          valueFormatter: (value) => `${value} plays`
                        }]}
                        layout="horizontal"
                        height={topSongsChartHeight - 60}
                        margin={{ left: 0, right: 10, top: 10, bottom: 10 }}
                        onItemClick={handleSongBarClick}
                        slots={{ tooltip: TopSongsTooltip }}
                        slotProps={{ tooltip: { trigger: 'item' } }}
                        sx={{
                          width: '100%',
                          marginLeft: '-20px',
                          '& .MuiChartsLegend-root': {
                            display: 'none !important'
                          },
                          '& .MuiBarElement-root': {
                            cursor: 'pointer',
                            filter: 'drop-shadow(0px 1px 6px rgba(250, 204, 21, 0.35))'
                          },
                          '& .MuiChartsAxis-tickLabel': {
                            fill: isDarkMode ? '#ffffff !important' : '#000000 !important',
                            fontSize: '11px !important'
                          },
                          '& .MuiChartsAxis-line': {
                            stroke: isDarkMode ? '#ffffff !important' : '#000000 !important'
                          },
                          '& .MuiChartsAxis-tick': {
                            stroke: isDarkMode ? '#ffffff !important' : '#000000 !important'
                          },
                          ...Object.fromEntries(
                            chartData.topSongs.map((song, index) => [
                              `& .MuiBarElement-series-auto-generated-id-0:nth-of-type(${index + 1})`,
                              { fill: `url(#top-song-gradient-${index}) !important` }
                            ])
                          )
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '8px',
                        maxWidth: '100%',
                        padding: '0 8px'
                      }}
                    >
                      {chartData.topSongs.map((song) => (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px'
                          }}
                          className="text-black dark:text-white"
                        >
                          <div
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '3px',
                              backgroundImage: `linear-gradient(90deg, ${adjustColor(song.color, 35)} 0%, ${song.color} 60%, ${adjustColor(song.color, -15)} 100%)`,
                              boxShadow: `0 0 6px ${song.color}66`
                            }}
                          />
                          <span>{song.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Top Played Artists */}
              {chartData.topArtists.length > 0 && (
                <div className={`${chartCardClass} ${chartSectionTextClass}`}>
                  <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                    Top 10 Played Artists
                  </h3>
                  <div style={{ width: '100%', height: '260px' }}>
                    <svg width="0" height="0" aria-hidden="true" focusable="false">
                      <defs>
                        {chartData.topArtists.map((artist) => {
                          const start = adjustColor(artist.baseColor, 25);
                          const end = adjustColor(artist.baseColor, -15);
                          return (
                            <linearGradient id={artist.gradientId} key={artist.id} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={start} stopOpacity={0.95} />
                              <stop offset="70%" stopColor={artist.baseColor} stopOpacity={1} />
                              <stop offset="100%" stopColor={end} stopOpacity={1} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                    </svg>
                    <PieChart
                      series={[{
                        data: chartData.topArtists.map((artist) => ({
                          ...artist,
                          color: `url(#${artist.gradientId})`
                        })),
                        highlightScope: { fade: 'global', highlight: 'item' },
                        faded: { additionalRadius: -5, color: 'gray' },
                        valueFormatter: (value) => `${value.value} plays`
                      }]}
                      width={270}
                      height={260}
                      margin={{ top: 20, bottom: 20, left: 20, right: 20 }}
                      slots={{ tooltip: TopArtistsTooltip }}
                      slotProps={{
                        tooltip: { trigger: 'item' }
                      }}
                      sx={{
                        '& .MuiChartsLegend-root': {
                          display: 'none !important'
                        },
                        '& .MuiPieArc-root': {
                          filter: 'drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.15))',
                          cursor: 'default'
                        }
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: '8px',
                      maxWidth: '100%',
                      padding: '0 8px'
                    }}
                  >
                    {chartData.topArtists.map((artist) => (
                      <div
                        key={artist.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px'
                        }}
                        className="text-black dark:text-white"
                      >
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '3px',
                            backgroundImage: `linear-gradient(90deg, ${adjustColor(artist.baseColor, 35)} 0%, ${artist.baseColor} 60%, ${adjustColor(artist.baseColor, -20)} 100%)`,
                            boxShadow: `0 0 6px ${artist.baseColor}66`
                          }}
                        />
                        <span>{artist.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 30-Day Activity */}
              {chartData.activityData.some(d => d.plays > 0) && (
                <div className={`${chartCardClass} ${chartSectionTextClass}`}>
                  <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                    30-Day Play Activity
                  </h3>
                  <div
                    style={{
                      width: '100%',
                      height: '220px',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      background: activityPanelBackground
                    }}
                  >
                    <svg width="0" height="0" aria-hidden="true" focusable="false">
                      <defs>
                        <linearGradient id="activity-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#facc15" stopOpacity={0.7} />
                          <stop offset="60%" stopColor="#ca8a04" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <LineChart
                      dataset={chartData.activityData}
                      xAxis={[{
                        scaleType: 'point',
                        dataKey: 'label',
                        tickLabelStyle: {
                          fill: activityAxisLabelColor,
                          fontSize: 11
                        }
                      }]}
                      yAxis={[{
                        tickNumber: 4,
                        valueFormatter: (value: number) => value >= 1000 ? `${Math.round(value / 1000)}K` : `${value}`,
                        tickLabelStyle: {
                          fill: activityAxisLabelColor,
                          fontSize: 11
                        }
                      }]}
                      series={[
                        {
                          dataKey: 'plays',
                          color: '#facc15',
                          curve: 'linear',
                          showMark: true,
                          area: true,
                          valueFormatter: (value) => `${value} plays`
                        },
                      ]}
                      height={220}
                      margin={{ left: 20, right: 20, top: 10, bottom: 20 }}
                      slotProps={{
                        area: {
                          style: { fill: 'url(#activity-gradient)' }
                        },
                        tooltip: { trigger: 'item' }
                      }}
                      slots={{ tooltip: ActivityTooltip }}
                      sx={{
                        width: '100%',
                        marginLeft: '-10px',
                        '& .MuiLineElement-root': {
                          strokeWidth: 3,
                          filter: 'drop-shadow(0px 0px 6px rgba(250, 204, 21, 0.4))'
                        },
                        '& .MuiChartsAxis-line': {
                          stroke: `${activityAxisLineColor} !important`
                        },
                        '& .MuiChartsAxis-tick': {
                          stroke: `${activityAxisLineColor} !important`
                        },
                        '& .MuiChartsGrid-line': {
                          stroke: activityGridColor,
                          strokeDasharray: '4 4'
                        },
                        '& .MuiChartsLegend-root': {
                          color: activityLegendColor
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 pb-8">
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
              ref={searchInputRef}
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
                    if (props.column.key === "artist") {
                      const row = props.rowData as (typeof data)[number];
                      return (
                        <button
                          type="button"
                          onClick={() => handleArtistFilter(row.artist)}
                          className="text-left text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-200 dark:hover:text-white"
                        >
                          {row.artist}
                        </button>
                      );
                    }
                    if (props.column.key === "title") {
                      const row = props.rowData as (typeof data)[number];
                      const isRefreshing = refreshingTabIds.has(row.songId);
                      const refreshError = tabRefreshErrors[row.songId];
                      const cachedEntry = tabCacheHydrated ? tabCache[row.songId] : undefined;
                      const cachedAt = cachedEntry?.cachedAt
                        ? new Date(cachedEntry.cachedAt).toLocaleString()
                        : null;
                      return (
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
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
                            <button
                              type="button"
                              onClick={() => handleRefreshTab(row.song)}
                              disabled={isRefreshing || !row.song.ugTabUrl}
                              className={inlineRefreshButtonClass}
                            >
                              {isRefreshing ? (
                                <>
                                  <svg
                                    className="h-3 w-3 animate-spin"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="3"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                                    />
                                  </svg>
                                  Refreshing
                                </>
                              ) : (
                                <>Refresh tab</>
                              )}
                            </button>
                          </div>
                          {cachedAt ? (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              Cached {cachedAt}
                            </span>
                          ) : null}
                          {refreshError ? (
                            <span className="text-[10px] text-red-600 dark:text-red-400">
                              {refreshError}
                            </span>
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
