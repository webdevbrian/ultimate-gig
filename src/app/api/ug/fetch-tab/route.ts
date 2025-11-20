import { NextRequest, NextResponse } from "next/server";

import type { UgTabResponse } from "@/lib/models";

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
    return NextResponse.json({ error: "Missing tab URL" }, { status: 400 });
  }

  const mode: Mode = body.mode === "live" ? "live" : "mock";

  try {
    const result =
      mode === "live" ? await fetchLiveTab(url) : buildMockResult(url);

    return NextResponse.json(result satisfies UgTabResponse);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tab content" },
      { status: 500 },
    );
  }
}

function buildMockResult(url: string): UgTabResponse {
  return {
    title: "Mock Song",
    artist: "Mock Artist",
    ugTabUrl: url,
    ugTabType: "chords",
    content:
      "[Intro]\n" +
      "[tab][ch]G[/ch]       [ch]C[/ch]       [ch]G[/ch][/tab]\n\n" +
      "[Verse]\n" +
      "[tab][ch]G[/ch]       [ch]C[/ch]       [ch]G[/ch][/tab]\n" +
      "Mock tab content loaded in mock mode.",
    tuningName: "Standard",
    tuningValue: "E A D G B E",
    chordShapes: undefined,
  };
}

type InternalTabType = "chords" | "tab" | "pro" | "other";

async function fetchLiveTab(url: string): Promise<UgTabResponse> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "UltimateGig/1.0 (+ultimate-gig-local)",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch tab page");
  }

  const html = await res.text();

  const storeMatch = html.match(
    /<div class="js-store" data-content="([^"]+)">/,
  );

  if (!storeMatch) {
    throw new Error("Could not find tab data block");
  }

  const encoded = storeMatch[1];
  const jsonText = decodeHtmlEntities(encoded);
  const data: UgTabStoreRoot = JSON.parse(jsonText);

  const pageData = data.store?.page?.data;
  const tabView = pageData?.tab_view;
  const wikiTabContent = tabView?.wiki_tab?.content;

  if (typeof wikiTabContent !== "string" || !wikiTabContent) {
    throw new Error("Missing tab content");
  }

  const tabMeta = pageData?.tab;

  const title = String(tabMeta?.song_name ?? "");
  const artist = String(tabMeta?.artist_name ?? "");
  const ugTabUrl = String(tabMeta?.tab_url ?? url);

  const typeName: string | undefined =
    (tabMeta?.type_name as string | undefined) ||
    (tabMeta?.type as string | undefined);
  const ugTabType = mapUgTypeToInternal(typeName);

  const tuningName = String(tabView?.meta?.tuning?.name ?? "");
  const tuningValue = String(tabView?.meta?.tuning?.value ?? "");

  const chordShapes: UgTabResponse["chordShapes"] = {};
  const applicature = tabView?.applicature;

  if (applicature && typeof applicature === "object") {
    for (const [name, shapes] of Object.entries(applicature)) {
      if (!Array.isArray(shapes) || shapes.length === 0) continue;
      const shape = shapes[0] as UgApplicatureShape;

      const frets = Array.isArray(shape.frets)
        ? [...shape.frets]
        : [];
      const fingers = Array.isArray(shape.fingers)
        ? [...shape.fingers]
        : [];

      while (frets.length < 6) frets.push(-1);
      while (fingers.length < 6) fingers.push(0);

      const baseFret = typeof shape.fret === "number" ? shape.fret : 1;

      const barres = Array.isArray(shape.listCapos)
        ? shape.listCapos.map((b) => ({
            fret: typeof b.fret === "number" ? b.fret : baseFret,
            startString:
              typeof b.startString === "number" ? b.startString : 0,
            lastString:
              typeof b.lastString === "number" ? b.lastString : 0,
            finger: typeof b.finger === "number" ? b.finger : 1,
          }))
        : [];

      if (!chordShapes) continue;
      chordShapes[name] = {
        name,
        baseFret,
        frets,
        fingers,
        barres,
      };
    }
  }

  return {
    title,
    artist,
    ugTabUrl,
    ugTabType,
    content: wikiTabContent,
    tuningName: tuningName || undefined,
    tuningValue: tuningValue || undefined,
    chordShapes,
  };
}

interface UgTabMeta {
  song_name?: string;
  artist_name?: string;
  tab_url?: string;
  type_name?: string;
  type?: string;
}

interface UgTabViewMetaTuning {
  name?: string;
  value?: string;
  index?: number;
}

interface UgTabViewMeta {
  tuning?: UgTabViewMetaTuning;
}

interface UgApplicatureBarre {
  fret?: number;
  startString?: number;
  lastString?: number;
  finger?: number;
}

interface UgApplicatureShape {
  id?: number | string;
  frets?: number[];
  fingers?: number[];
  fret?: number;
  listCapos?: UgApplicatureBarre[];
}

interface UgTabView {
  wiki_tab?: {
    content?: string;
  };
  meta?: UgTabViewMeta;
  applicature?: Record<string, UgApplicatureShape[]>;
}

interface UgTabPageData {
  tab?: UgTabMeta;
  tab_view?: UgTabView;
}

interface UgTabStoreRoot {
  store?: {
    page?: {
      data?: UgTabPageData;
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
