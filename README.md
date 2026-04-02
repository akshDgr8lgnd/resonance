# Resonance

**Resonance** is a high-performance, Spotify-inspired desktop music player built with Electron, React, and SQLite. It provides a premium listening experience for your local media library, and now exposes a small self-hostable control plane for remote clients and MCP-compatible assistants.


## Key Features

- **High-Fidelity UI**: A pixel-perfect, dark-mode interface inspired by the world's leading music streaming service.
- **Smart Library Management**: Automatically organizes your music into Albums and Artists with intelligent cross-album deduplication.
- **Advanced Search**: Integrated metadata search via iTunes API with YouTube web search enrichment (no YouTube Data API key required).
- **Concurrency-Limited Downloads**: Professional-grade background download manager with queueing and semaphore-based concurrency control.
- **Sound Capsule**: Built-in listening analytics featuring playback heatmaps, weekly stats, and listening streaks.
- **Disk Usage Tracking**: Integrated storage counter to monitor your library's footprint.
- **Embedded Control API**: Local authenticated HTTP endpoints for library, search, download, playback state, play, and radio.
- **MCP Server Provision**: A lightweight stdio MCP bridge so local AI assistants can search, play, download, and control Resonance.
- **Cross-Platform**: Designed for Windows and macOS with native-feeling interactions.

## Tech Stack

- **Core**: TypeScript, Node.js, SQLite (via `better-sqlite3`)
- **UI**: React 18, Vite, CSS3 (Vanilla)
- **Engine**: Electron 30+
- **Media Tools**: `yt-dlp` for media acquisition, `ffmpeg` (optional) for processing.

## Getting Started

### Option 1: Download the App

If you just want to use Resonance, download the Windows `.exe` from the latest release:
- [Latest Release](https://github.com/akshDgr8lgnd/resonance/releases/latest)

### Option 2: Run from Source

1. **Prerequisites**
- [Node.js](https://nodejs.org/) (Version 20 or higher)
- `npm` (v10+) or `yarn`

2. **Environment Setup**
Create a `.env` file in the root directory:
```bash
APP_PORT=3939
```
`APP_PORT` is optional. If omitted, the app uses the default configured port.

3. **Run in Development**
```bash
npm run dev
```

## MCP Server

Resonance ships with a stdio MCP bridge in the `server` workspace. It talks to the running desktop app through the embedded local API, so self-hosters can point Claude Desktop, Open WebUI, or other MCP clients at Resonance and let them search, play, download, and inspect playback.

### Start the MCP bridge

From the repo root:
```bash
npm run build -w server
npm run mcp -w server
```

### Required environment variables

- `RESONANCE_BASE_URL`
  Default: `http://127.0.0.1:3939`
- `RESONANCE_API_TOKEN`
  Read this from Resonance inside `Settings -> Pairing`, or from the authenticated `GET /settings/pairing` response.

### Example Claude Desktop config

```json
{
  "mcpServers": {
    "resonance": {
      "command": "node",
      "args": ["C:/path/to/resonance/server/dist/mcp.js"],
      "env": {
        "RESONANCE_BASE_URL": "http://127.0.0.1:3939",
        "RESONANCE_API_TOKEN": "paste-token-here"
      }
    }
  }
}
```

### Included MCP tools

- `resonance_health`
- `resonance_library_summary`
- `resonance_search`
- `resonance_play_track`
- `resonance_playback_command`
- `resonance_playback_state`
- `resonance_download`
- `resonance_start_radio`

## Local Control API

These endpoints are served by the desktop app on the configured local port and require `Authorization: Bearer <token>` unless noted otherwise.

- `GET /health`
- `GET /library`
- `POST /search`
- `POST /download`
- `GET /download-jobs/:id`
- `GET /playback/state`
- `POST /playback/command`
- `POST /playback/play`
- `POST /playback/radio`
- `GET /capsule/history`
- `GET /settings/pairing`

## Disclaimer & Legal Notice

**Resonance is created for educational purposes and personal use only.**

1. **YouTube ToS**: This application uses `yt-dlp` to facilitate media acquisition. Users are responsible for complying with the [YouTube Terms of Service](https://www.youtube.com/t/terms), which generally prohibit downloading content.
2. **Copyright**: Ensure you have the legal right to any media you download or store within the application. The creators of Resonance do not condone or encourage copyright infringement.
3. **Trademark**: Resonance is an independent "Spotify-inspired" project. It is not affiliated with, endorsed by, or sponsored by Spotify AB.

## License

Distributed under the MIT License. See `LICENSE` for more information.
