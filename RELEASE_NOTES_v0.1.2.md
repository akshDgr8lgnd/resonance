# Resonance v0.1.2

## Highlights
- Replaced generated shelf fallback artwork with custom in-app covers for mixes, auto playlists, and time-based shelves.
- Refined the Home shelf presentation so generated sections feel like Resonance collections instead of recycled album cards.
- Rebuilt the Windows installer with the latest recommendation and curation experience.

## What Changed
### Generated Covers
- App-generated shelves now render custom SVG cover artwork instead of reusing the first track's album art.
- Mixes like `Comfort Mix`, `Discovery Mix`, `Bollywood Mix`, and `Late Night Mix` now each get their own color direction and typography.
- Updated `renderer/src/App.tsx`.

### Home Presentation
- Generated shelves now present consistent cover identity across Home cards and pinned shelves.
- Updated `renderer/src/App.tsx` and `renderer/src/styles.css`.

### Packaging
- Rebuilt the full Windows NSIS installer for the v0.1.2 desktop release.

## Validation
- Passed builds:
  - `npm run build`
  - `npm run dist:win`

## Installer
- `release/Resonance Setup 0.1.2.exe`
