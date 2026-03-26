# Resonance Handoff

This file is a project handoff for continuing work in Claude Code or any other coding agent.

## Project Goal

Build `Resonance`, a native desktop music app for Windows and macOS inspired by Spotify desktop.

Key product intent from the user:

- Native desktop app, not Docker, not web-only
- Desktop-first, installable, background-capable application
- Spotify-like layout and feel
- Search, download, playback, library, queue, playlists, stats
- Embedded HTTP server for future Android client
- Android should be able to:
  - stream from desktop if the song exists there
  - request desktop download then stream
  - download locally on Android if desktop is unavailable

Important UX expectation from user:

- User wants the app to feel as close as possible to Spotify desktop
- Exact Spotify cloning was requested several times
- Current implementation should continue in a “very close but still distinct” direction
- Remaining work is primarily product polish and UI fidelity, not initial scaffolding

## Stack Choice

Electron + React was chosen over Tauri + React.

Reasoning used:

- simpler bundled desktop runtime for audio + embedded Node/Express server
- easier packaged local file playback
- easier shipping of background tray behavior and Electron shell patterns
- better fit for a bundled HTTP server and desktop-first workflow

The README already documents this choice.

## Repository Structure

```text
resonance/
├── app/          # Electron shell
├── renderer/     # React UI
├── core/         # Business logic
├── server/       # Express API
└── db/           # SQLite schema
```

## Current Major Files

- `C:\Spotify - Clone - Codex\app\src\main.ts`
- `C:\Spotify - Clone - Codex\app\src\preload.ts`
- `C:\Spotify - Clone - Codex\renderer\src\App.tsx`
- `C:\Spotify - Clone - Codex\renderer\src\styles.css`
- `C:\Spotify - Clone - Codex\renderer\src\store.ts`
- `C:\Spotify - Clone - Codex\core\src\search.ts`
- `C:\Spotify - Clone - Codex\core\src\download.ts`
- `C:\Spotify - Clone - Codex\core\src\library.ts`
- `C:\Spotify - Clone - Codex\core\src\types.ts`
- `C:\Spotify - Clone - Codex\server\src\index.ts`
- `C:\Spotify - Clone - Codex\db\schema.sql`

## What Has Been Implemented

### Desktop App / Packaging

- Electron desktop shell
- packaged Windows installer via `electron-builder`
- tray/background behavior
- app launches as installed desktop app
- packaged renderer works under `file://`
- main/preload packaging issues resolved
- logging to `%APPDATA%\\Resonance\\resonance.log`

### Search

- YouTube Data API search when `YOUTUBE_API_KEY` exists
- YouTube duration enrichment through `videos` endpoint
- fallback search path using iTunes Search API for real titles, artists, albums, and cover art
- fallback no longer uses fake placeholder/demo tracks for normal cases

### Download Pipeline

- `yt-dlp` integration
- auto-download of `yt-dlp` into user-data folder on first use
- safe child-process spawning without Electron `EPIPE` crash
- local cover image saving
- downloaded tracks persisted into SQLite

### Library / Playback

- local tracks view
- album grouping
- artist grouping
- bottom player with play/pause, prev/next, seek bar, volume
- session tracking hooks
- Sound Capsule page with heatmap/stats

### Embedded Server

- Express server embedded in desktop app
- pairing token / QR endpoint
- library / stream / search / download / capsule endpoints
- early hybrid Android-ready architecture support

## Important Fixes Already Done

These were real bugs encountered and fixed:

1. Packaged app `dotenv` import crash
- removed runtime packaging dependency issue

2. Packaged app workspace import crashes
- main process now uses built local dist files

3. Dynamic `require("fs")` bundling issue
- main/preload packaging changed to safe transpile path

4. Missing `sql.js` in package
- production deps included correctly

5. Black screen in packaged app
- renderer build uses relative asset paths
- file-protocol-safe routing
- correct packaged preload path

6. `EPIPE` main process crash during download
- no longer using `stdio: "inherit"` with `yt-dlp`
- errors are returned cleanly to renderer

7. `ENOTDIR, not a directory` on download
- caused by trying to write tools inside packaged app bundle
- `yt-dlp` now lives in app user-data folder

8. SQLite save bug for tracks
- `tracks` insert changed to positional params instead of broken named bindings

9. Duplicate album cards
- album grouping changed to prefer album title / album artist instead of splitting by first track artist

## Current UI Direction

The current renderer is a Spotify-inspired desktop shell with:

- left navigation panel
- left library rail
- sticky top header
- large gradient hero sections
- media shelves/cards
- track table layout
- bottom player

Files:

- `C:\Spotify - Clone - Codex\renderer\src\App.tsx`
- `C:\Spotify - Clone - Codex\renderer\src\styles.css`

This is significantly more polished than the initial MVP, but the user still feels it is not close enough to Spotify desktop.

## User Feedback Still Outstanding

The user says:

- “still not spotify exactly”
- there are still imperfections they find hard to enumerate one by one

Interpretation:

- visual polish is still the main gap
- product structure is mostly there
- fidelity issues are now mostly spacing, visual language, hierarchy, control design, and density

## Next Best Work Items

These are the highest-value next steps for continuing the UI polish.

### 1. Make the shell feel more authentic

- replace text placeholders like `Play`, `<<`, `>>` with proper iconography
- refine header spacing and sticky behavior
- tune sidebar density and library row proportions
- make collection list and quick cards look more premium

### 2. Improve player fidelity

- more Spotify-like transport control sizing
- center emphasis on play button
- better progress bar styling
- track actions: like, queue, device, volume icon, mute state
- richer now-playing metadata area

### 3. Improve list/table interactions

- hover-only row actions
- selected row state
- subtle separators instead of obvious card blocks
- context-menu affordances
- less bulky rows

### 4. Improve album and artist pages

- stronger hero headers with cover art and metadata
- better soundtrack/compilation artist handling
- separate album artist vs track artist rendering
- optional dominant-color gradient based on cover art

### 5. Improve library semantics

- actual playlist CRUD UI
- pinned collections and recent searches
- sortable library sections
- library search/filter inside sidebar

### 6. Improve search experience

- actual preview behavior or remove fake preview button
- better grouping by tracks/albums/artists
- search skeletons closer to final list layout

## Known Technical Caveats

1. Renderer currently has a `Preview` button in search that tries to construct a temporary track object with empty `filePath`.
- `playTrack` currently guards against empty `filePath`, so this won’t actually play.
- This should either become a real preview stream feature or be removed.

2. The current UI is closer in structure than in micro-detail.
- Needs another dedicated design pass.

3. There are some duplicate-dependency warnings during packaging from `electron-builder`.
- Packaging still succeeds.

4. No official vector icon system is being used in the renderer yet.
- This is a major reason the app still feels “off”.

## Commands

### Dev

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

### Build

```powershell
npm run build
```

### Package Windows

```powershell
npm run dist:win
```

### Run packaged app directly

```powershell
.\release\win-unpacked\Resonance.exe
```

## Built Outputs

- `C:\Spotify - Clone - Codex\release\Resonance Setup 0.1.0.exe`
- `C:\Spotify - Clone - Codex\release\win-unpacked\Resonance.exe`

## Logs

Packaged app runtime log:

- `C:\Users\G634JZR\AppData\Roaming\Resonance\resonance.log`

## Verification Already Performed

Repeatedly verified during development:

- `npm run build`
- `npm run dist:win`
- packaged app launch from `release\\win-unpacked\\Resonance.exe`
- search fallback returns real metadata for songs like `mast magan`
- download saves track and cover art into local media storage

## Suggested First Steps For Claude Code

1. Open:
- `C:\Spotify - Clone - Codex\renderer\src\App.tsx`
- `C:\Spotify - Clone - Codex\renderer\src\styles.css`

2. Focus the next pass on UI fidelity, not architecture.

3. Replace text-based controls with icons and refine spacing first.

4. Remove or properly implement the current search `Preview` behavior.

5. Keep branding as `Resonance`; do not use Spotify branding or logo.

6. Preserve all packaging/runtime fixes already made in:
- `C:\Spotify - Clone - Codex\app\src\main.ts`
- `C:\Spotify - Clone - Codex\core\src\download.ts`
- `C:\Spotify - Clone - Codex\core\src\search.ts`

## Short Status Summary

Resonance is no longer a broken scaffold.

It is now:

- installable
- packaged
- background-capable
- searchable
- able to download tracks
- able to save cover art
- able to browse songs/albums/artists
- equipped with an embedded server

What remains is mainly:

- deeper desktop-player polish
- stronger Spotify-like feel while staying distinct
- better UI control fidelity
- playlist and library refinement
