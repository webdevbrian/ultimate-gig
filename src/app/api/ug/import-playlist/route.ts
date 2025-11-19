import { NextRequest, NextResponse } from "next/server";

import type { UgImportResponse } from "@/lib/models";

type Mode = "mock" | "live";

interface RequestBody {
  url: string;
  mode?: Mode;
}

export async function POST(request: NextRequest) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Missing playlist URL" }, { status: 400 });
  }

  let sourcePlaylistId: string;
  try {
    const parsed = new URL(url);
    sourcePlaylistId =
      parsed.searchParams.get("h") ||
      parsed.searchParams.get("id") ||
      parsed.pathname ||
      url;
  } catch {
    return NextResponse.json({ error: "Invalid playlist URL" }, { status: 400 });
  }

  const mode: Mode = body.mode === "live" ? "live" : "mock";

  try {
    const result =
      mode === "live"
        ? await fetchLivePlaylist(url, sourcePlaylistId)
        : buildMockResult(sourcePlaylistId);

    return NextResponse.json(result satisfies UgImportResponse);
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to import playlist" },
      { status: 500 },
    );
  }
}

function buildMockResult(sourcePlaylistId: string): UgImportResponse {
  const songs: UgImportResponse["songs"] = [
    {
      id: "14322",
      title: "Take It Easy",
      artist: "Eagles",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/eagles/take-it-easy-chords-14322",
      ugTabType: "chords",
    },
    {
      id: "1738371",
      title: "Free Fallin",
      artist: "Tom Petty",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/tom-petty/free-fallin-chords-1738371",
      ugTabType: "chords",
    },
    {
      id: "1171108",
      title: "Simple Man",
      artist: "Lynyrd Skynyrd",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/lynyrd-skynyrd/simple-man-chords-1171108",
      ugTabType: "chords",
    },
    {
      id: "459333",
      title: "Three Little Birds",
      artist: "Bob Marley",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/bob-marley/three-little-birds-chords-459333",
      ugTabType: "chords",
    },
    {
      id: "135023",
      title: "Drift Away",
      artist: "Uncle Kracker",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/uncle-kracker/drift-away-chords-135023",
      ugTabType: "chords",
    },
    {
      id: "2166139",
      title: "Turn The Page",
      artist: "Bob Seger & The Silver Bullet Band",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/bob-seger-the-silver-bullet-band/turn-the-page-chords-2166139",
      ugTabType: "chords",
    },
    {
      id: "983702",
      title: "Otherside",
      artist: "Red Hot Chili Peppers",
      ugTabUrl:
        "https://tabs.ultimate-guitar.com/tab/red-hot-chili-peppers/otherside-chords-983702",
      ugTabType: "chords",
    },
  ];

  const playlistItems: UgImportResponse["playlistItems"] = songs.map(
    (song, index) => ({
      position: index + 1,
      songId: song.id,
    }),
  );

  return {
    playlist: {
      sourcePlaylistId,
      name: "Request List",
      description: "Find one on this list, and request it!",
    },
    songs,
    playlistItems,
  };
}

async function fetchLivePlaylist(
  url: string,
  sourcePlaylistId: string,
): Promise<UgImportResponse> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "UltimateGig/1.0 (+ultimate-gig-local)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch playlist page");
  }

  const html = await res.text();

  const storeMatch = html.match(
    /<div class="js-store" data-content="([^"]+)">/,
  );

  if (!storeMatch) {
    throw new Error("Could not find playlist data block");
  }

  const encoded = storeMatch[1];
  const jsonText = decodeHtmlEntities(encoded);
  const data: UgStoreRoot = JSON.parse(jsonText);

  const songbook = data.store?.page?.data?.songbook;
  if (!songbook || !Array.isArray(songbook.tabs)) {
    throw new Error("Unexpected playlist data shape");
  }

  const songs: UgImportResponse["songs"] = (songbook.tabs ?? [])
    .map((entry) => entry.tab)
    .filter((tab): tab is UgTab => Boolean(tab && tab.tab_url))
    .map((tab) => {
      const typeName: string | undefined = tab.type_name || tab.type;
      const ugTabType = mapUgTypeToInternal(typeName);

      return {
        id: String(tab.id),
        title: String(tab.song_name ?? ""),
        artist: String(tab.artist_name ?? ""),
        ugTabUrl: String(tab.tab_url ?? ""),
        ugTabType,
      };
    });

  const playlistItems: UgImportResponse["playlistItems"] = songs.map(
    (song, index) => ({
      position: index + 1,
      songId: song.id,
    }),
  );

  const description: string | undefined =
    typeof songbook.description === "string" && songbook.description.trim()
      ? songbook.description
      : undefined;

  return {
    playlist: {
      sourcePlaylistId,
      name: String(songbook.name ?? "Ultimate Guitar playlist"),
      description,
    },
    songs,
    playlistItems,
  };
}

type InternalTabType = UgImportResponse["songs"][number]["ugTabType"];

interface UgTab {
  id: number | string;
  song_name?: string;
  artist_name?: string;
  tab_url?: string;
  type_name?: string;
  type?: string;
}

interface UgSongbook {
  name?: string;
  description?: string;
  tabs?: { tab?: UgTab }[];
}

interface UgStoreRoot {
  store?: {
    page?: {
      data?: {
        songbook?: UgSongbook;
      };
    };
  };
}

function mapUgTypeToInternal(typeName: string | undefined): InternalTabType {
  const t = (typeName || "").toLowerCase();

  if (t.includes("chord")) return "chords";
  if (t.includes("pro")) return "pro";
  if (t.includes("tab")) return "tab";
  return "other";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
