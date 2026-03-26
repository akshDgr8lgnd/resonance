# Resonance v0.1.1

## Highlights
- Improved Library track row alignment for cleaner, consistent column layout.
- Reworked Settings tab to focus on storage folder access with a `Show Folder` action.
- Added desktop bridge APIs to fetch/open the songs media folder from the renderer.
- Hardened Electron main-process runtime behavior around `EPIPE` errors in dev.

## What Changed
### Library UI
- Fixed track table row width behavior so track metadata lines up correctly.
- Updated styles in `renderer/src/styles.css`.

### Settings Tab
- Removed previous settings sections and replaced with a single `Library Folder` section.
- Added folder path display and `Show Folder` button.
- Added renderer-side loading/error handling for folder path and folder-open actions.
- Updated `renderer/src/App.tsx` and `renderer/src/vite-env.d.ts`.

### Electron/Main Process
- Added IPC handlers:
  - `library:folder-path`
  - `library:open-folder`
- Ensured media folder exists before returning/opening path.
- Added stdout/stderr `EPIPE` guards to avoid dev-time main-process crashes.
- Updated `app/src/main.ts` and `app/src/preload.ts`.

## Validation
- Passed type checks:
  - `npm run typecheck -w app`
  - `npm run typecheck -w renderer`

## Notes
- If Settings does not reflect changes immediately, fully restart Electron (`npm run dev` after closing running app processes) so preload/main updates are reloaded.
