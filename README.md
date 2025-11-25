
<img width="256" height="256" alt="icon" src="https://github.com/user-attachments/assets/e4cc283f-bbc0-4f64-9bf6-9916bdfb75db" />

# Ultimate Gig

Ultimate Gig is a local-first playlist and tab manager built on top of Ultimate Guitar. It lets you import UG playlists, keep them offline on your device, and view, annotate, and auto-scroll tabs during live sets.

The app is designed to be:

- **Local & offline-friendly** – data lives in your browser via `localStorage`.
- **Fast to use on stage** – compact UI, keyboard-friendly, and dark-mode aware.
- **Opinionated for gigs** – notes per song, auto-scroll, and a focused tab view.

---

## Core Features

- **Playlist import from Ultimate Guitar**
  - Paste a UG playlist URL and import its songs.
  - Playlists, songs, and playlist items are stored locally so you can work offline.

- **Dashboard** (`/`)
  - Table of imported playlists with sortable, resizable, and re-orderable columns.
  - Search playlists by name.
  - Actions to resync or remove playlists from the device.

- **Playlist detail / setlist view** (`/playlists/[playlistId]`)
  - Shows all songs in a playlist with search by title or artist.
  - Column reordering + resizing with layout persisted to `localStorage`.
  - Play count and last played date columns for tracking progress.
  - Quick links to Spotify and YouTube for each song (when available).
  - Links into the song/tab view for each track.
  - **Per-playlist charts & statistics**:
    - **Top 10 Played Songs** – horizontal bar chart with custom legends (click to navigate to song).
    - **Top 10 Played Artists** – donut chart with aggregated play counts from playlist songs.
    - **30-Day Play Activity** – area chart with gradient fill tracking daily plays.
    - Toggle to hide/show charts for a cleaner view.

- **Song / tab view** (`/songs/[songId]`)
  - Renders the Ultimate Guitar tab content as plain text.
  - **Mark as played** button to track play count and last played timestamp.
  - Adjustable font size (+/- controls, persisted per device).
  - Optional auto-scroll with configurable speed (0.1x – 3.0x).
  - Per-song notes panel (for cues, capo info, reminders, etc.).
  - Displays tuning information and tab type (chords, tab, pro).
  - Ability to collapse the header for a focused performance view.
  - Tab container height is constrained to the viewport with its own scrollbar.

- **Streaming links**
  - Add Spotify track links (URL, URI, or track ID) to any song.
  - Add YouTube video links (supports youtube.com, youtu.be, Shorts).
  - Quick-access icons in song view and playlist table rows.

- **Settings** (`/settings`)
  - **Clear all data** – removes playlists, songs, stats, and preferences.
  - **Reset song history** – clears play counts and last played dates while keeping playlists and songs intact.

- **Theme support**
  - Light / dark / system theme toggle.
  - Theme preference persisted in `localStorage`.
  - Tables and the tab view respect the active theme.

---

## Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Tailwind CSS + CSS variables for theming
- **Tables**: [ka-table](https://ka-table.com/) for playlists and songs
- **Charts**: [MUI X Charts](https://mui.com/x/react-charts/) for dashboard visualizations
- **State persistence**: Custom `useLocalStorage` React hook

The app is intentionally local-first: there is no external database. All user data (playlists, songs, notes, layout preferences) is stored in the browser.

---

## Getting Started

### Prerequisites

- Node.js 18+ (or a reasonably recent LTS)
- npm (or your preferred package manager)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The main entry points are:

- `src/app/page.tsx` – playlists overview
- `src/app/playlists/[playlistId]/page.tsx` – playlist detail / songs table
- `src/app/songs/[songId]/page.tsx` – song tab view

---

## Data & Persistence

Ultimate Gig stores data in `localStorage` using a small set of well-named keys (for example: playlists, songs, playlist items, tab notes, UI preferences). This means:

- Your data stays on your device.
- Clearing browser storage will remove the app data.
- Multiple browsers/devices do not share state automatically.

The custom `useLocalStorage` hook handles hydration and keeps React state in sync with `localStorage`.

---

## Ultimate Guitar Integration

The app integrates with Ultimate Guitar via internal API routes:

- `/api/ug/import-playlist` – import a playlist and its songs by URL.
- `/api/ug/fetch-tab` – fetch the tab content for a specific song.

These routes hide the integration details from the UI layer and return typed responses used throughout the app.

---

## Development Notes

- **Tables**: ka-table is used in controlled mode with `useTable`, and table layouts (column order, widths, sorting) are persisted to `localStorage`.
- **Theming**: `ThemeToggle` manages the theme by writing CSS variables (`--background`, `--foreground`) on the document root.
- **Layouts**: The song tab view uses a flexbox layout and a dynamic `max-height` on the tab container so it stays pinned to the bottom of the viewport with its own scrollbar.

---

## License

This project is currently closed-source for commercial use. Please contact the author before redistributing or using it in production.
