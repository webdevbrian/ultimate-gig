"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Table, useTable } from "ka-table";
import { DataType, SortingMode, EditingMode } from "ka-table/enums";
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  ChartsTooltipContainer,
  useItemTooltip,
} from "@mui/x-charts/ChartsTooltip";
import type { ChartsTooltipProps } from "@mui/x-charts/ChartsTooltip";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { decodeHtmlEntities } from "@/lib/utils";
import type {
  Playlist,
  PlaylistItem,
  Song,
  UgImportResponse,
} from "@/lib/models";

type SortKey = "importedAt" | "name";

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
          : "1px solid rgba(2, 6, 23, 0.08)",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {header}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "2px", color: secondaryTextColor }}>
        {subheader}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, lineHeight: "28px", marginTop: "10px" }}>
        {value}
      </div>
    </div>
  );
}

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

  // Dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Charts visibility toggle
  const [chartsVisible, setChartsVisible] = useLocalStorage<boolean>(
    "ultimate-gig:ui:charts-visible",
    true,
  );

  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

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

  // Chart data processing
  const chartData = useMemo(() => {
    // Filter songs that have been played (have playCount > 0)
    const playedSongs = songs.filter(song => (song.playCount || 0) > 0);

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

    // Play activity over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyPlays = playedSongs
      .filter(song => song.lastPlayedAt && new Date(song.lastPlayedAt) >= thirtyDaysAgo)
      .reduce((acc, song) => {
        if (!song.lastPlayedAt) return acc;
        const date = new Date(song.lastPlayedAt).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + (song.playCount || 0);
        return acc;
      }, {} as Record<string, number>);

    // Fill in missing dates with 0
    const activityData: ActivityDatum[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
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
  }, [songs]);

  const topSongsChartHeight = Math.max(150, chartData.topSongs.length * 26);
  const chartSectionTextClass = isDarkMode ? "text-white" : "text-black";
  const activityPanelBackground = isDarkMode
    ? "linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)"
    : "#ffffff";
  const activityAxisLabelColor = isDarkMode ? "#94a3b8" : "#111827";
  const activityAxisLineColor = isDarkMode ? "#1e293b" : "#d4d4d8";
  const activityGridColor = isDarkMode ? "#1f2937" : "#e5e7eb";
  const activityLegendColor = isDarkMode ? "#eab308" : "#a16207";

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

  const handleSongBarClick = useCallback(
    (_event: React.SyntheticEvent | null, params?: { dataIndex?: number | null }) => {
      if (params?.dataIndex == null) return;
      const song = chartData.topSongs[params.dataIndex];
      if (song) {
        router.push(`/songs/${song.id}`);
      }
    },
    [chartData.topSongs, router],
  );

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
      {/* Charts Section */}
      {chartData.totalPlays > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Performing Overview</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {chartData.totalPlays} total plays across {chartData.totalPlayedSongs} songs
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChartsVisible(!chartsVisible)}
              className="inline-flex items-center justify-center rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {chartsVisible ? "Hide charts" : "Show charts"}
            </button>
          </div>

          {chartsVisible && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Played Songs */}
            <div className={`${chartCardClass} ${chartSectionTextClass}`}>
              <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                Top 10 Played Songs
              </h3>
              {chartData.topSongs.length > 0 ? (
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
                        tickNumber: Math.max(...chartData.topSongs.map(s => s.plays)) + 2
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
                          filter: 'drop-shadow(0px 1px 6px rgba(250, 204, 21, 0.35))'
                        },
                        '& .MuiChartsAxis-tickLabel': {
                          fill: '#000000 !important',
                          fontSize: '11px !important'
                        },
                        '& .MuiChartsAxis-line': {
                          stroke: '#000000 !important'
                        },
                        '& .MuiChartsAxis-tick': {
                          stroke: '#000000 !important'
                        },
                        '& line': {
                          stroke: '#000000 !important'
                        },
                        '& path': {
                          stroke: '#000000 !important'
                        },
                        '& text': {
                          fill: '#000000 !important'
                        },
                        '.dark &': {
                          '& .MuiChartsAxis-tickLabel': {
                            fill: '#ffffff !important'
                          },
                          '& .MuiChartsAxis-line': {
                            stroke: '#ffffff !important'
                          },
                          '& .MuiChartsAxis-tick': {
                            stroke: '#ffffff !important'
                          },
                          '& line': {
                            stroke: '#ffffff !important'
                          },
                          '& path': {
                            stroke: '#ffffff !important'
                          },
                          '& text': {
                            fill: '#ffffff !important'
                          }
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
                    {chartData.topSongs.map((song, index) => (
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
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No played songs yet
                </p>
              )}
            </div>

            {/* Top Played Artists */}
            <div className={`${chartCardClass} ${chartSectionTextClass}`}>
              <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                Top 10 Played Artists
              </h3>
              {chartData.topArtists.length > 0 ? (
                <div className="flex flex-col gap-3" style={{ width: '100%' }}>
                  <div style={{ width: '100%', height: '240px' }}>
                    <svg width="0" height="0" aria-hidden="true" focusable="false">
                      <defs>
                        {chartData.topArtists.map((artist) => {
                          const start = adjustColor(artist.baseColor, 35);
                          const end = adjustColor(artist.baseColor, -20);
                          return (
                            <linearGradient id={artist.gradientId} key={artist.id} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={start} />
                              <stop offset="70%" stopColor={artist.baseColor} />
                              <stop offset="100%" stopColor={end} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                    </svg>
                    <PieChart
                      series={[
                        {
                          data: chartData.topArtists.map((artist) => ({
                            ...artist,
                            color: `url(#${artist.gradientId})`
                          })),
                          highlightScope: { fade: 'global', highlight: 'item' },
                          innerRadius: 35,
                          outerRadius: 80,
                        },
                      ]}
                      width={300}
                      height={200}
                      margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      slots={{ tooltip: TopArtistsTooltip }}
                      slotProps={{ tooltip: { trigger: 'item' } }}
                      sx={{
                        width: '100%',
                        '& .MuiChartsLegend-root': {
                          display: 'none !important'
                        },
                        '& text': {
                          fill: '#000000 !important'
                        },
                        '.dark &': {
                          '& text': {
                            fill: '#ffffff !important'
                          }
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
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No played artists yet
                </p>
              )}
            </div>

            {/* Play Activity Over Time */}
            <div className={`${chartCardClass} ${chartSectionTextClass}`}>
              <h3 className="text-sm font-medium text-black dark:text-white mb-2">
                30 Day Play Activity
              </h3>
              {chartData.activityData.some(d => d.plays > 0) ? (
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
                        markSize: 3,
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
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No recent activity
                </p>
              )}
            </div>
            </div>
          )}
        </section>
      )}

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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-0 transition focus:border-ring sm:w-64"
            />
          </div>
        </div>

        <div className="ka-table-wrapper overflow-hidden rounded-lg border border-border bg-card text-sm shadow-sm">
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
        </div>
      </section>
    </div>
  );
}
