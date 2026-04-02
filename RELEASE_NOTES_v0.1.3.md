# Resonance v0.1.3

## Highlights

- Added a self-hostable MCP bridge so external AI tools can search, play, download, and control Resonance.
- Added local playback control endpoints for play, transport commands, playback state, and radio.
- Refreshed the README with MCP setup, local API details, and a clearer self-hosting story.
- Included the updated branding assets and installer metadata for the new build.

## MCP Tools

- `resonance_health`
- `resonance_library_summary`
- `resonance_search`
- `resonance_play_track`
- `resonance_playback_command`
- `resonance_playback_state`
- `resonance_download`
- `resonance_start_radio`

## Validation

- `npm run typecheck -w server`
- `npm run typecheck -w app`
- `npm run typecheck -w renderer`
- `npm run build -w server`
- `npm run build -w app`
- `npm run build -w renderer`
- MCP stdio initialize + tools/list handshake against `server/dist/mcp.js`
