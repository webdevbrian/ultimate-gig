export type PlaylistSource = "ultimate-guitar";

export interface Playlist {
  id: string;
  source: PlaylistSource;
  sourcePlaylistId?: string;
  name: string;
  description?: string;
  importedAt: string;
  lastSyncedAt?: string;
  totalSongs: number;
  spotifyPlaylistId?: string;
  youtubePlaylistId?: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  position: number;
  songId: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  ugTabUrl: string;
  ugTabType?: "chords" | "tab" | "pro" | "other";
  spotifyTrackId?: string;
  youtubeUrl?: string;
  playCount?: number;
  lastPlayedAt?: string;
}

export interface TabSettings {
  songId: string;
  fontSize: number;
  transpose: number;
  autoScrollEnabled: boolean;
  autoScrollSpeed: number;
  notes: string;
  theme: "light" | "dark" | "system";
}

export interface PlaybackState {
  currentSongId?: string;
  previouslyPlayedSongIds: string[];
  upNextSongIds: string[];
}

export interface UgImportResponse {
  playlist: {
    sourcePlaylistId: string;
    name: string;
    description?: string;
  };
  songs: {
    id: string;
    title: string;
    artist: string;
    ugTabUrl: string;
    ugTabType: "chords" | "tab" | "pro" | "other";
  }[];
  playlistItems: {
    position: number;
    songId: string;
  }[];
}

export interface UgChordBarre {
  fret: number;
  startString: number;
  lastString: number;
  finger: number;
}

export interface UgChordShape {
  name: string;
  baseFret: number;
  frets: number[];
  fingers: number[];
  barres: UgChordBarre[];
}

export interface UgTabResponse {
  title: string;
  artist: string;
  ugTabUrl: string;
  ugTabType: "chords" | "tab" | "pro" | "other";
  content: string;
  tuningName?: string;
  tuningValue?: string;
  chordShapes?: Record<string, UgChordShape>;
}

export interface CachedTabEntry {
  songId: string;
  ugTabUrl: string;
  cachedAt: string;
  tab: UgTabResponse;
}
