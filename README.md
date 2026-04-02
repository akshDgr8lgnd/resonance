# 🎵 Resonance
**Your Music, Your Server, Your Rules.**

A sleek, fully self-hosted desktop music player that turns YouTube into a permanent, private, smart music library. Beautiful Spotify-like UI + offline-first ownership + AI-ready control.

---

## ✨ Features

### 📥 Intelligent Local Library
* Search any track or artist → instant `yt-dlp` download with perfect metadata
* iTunes-powered ID3 tagging + high-res album art (no more garbage filenames)
* Smart concurrency queue with CPU/IP throttling for massive playlist imports
* 100% offline-first — your files live on your drive forever

### 🎧 Premium Playback
* Clean, modern Electron UI with fluid queue, drag-and-drop, and gapless playback
* System tray + global hotkeys for true desktop experience

### 📊 Sound Capsule — Your Private Wrapped
* Deep local analytics: top tracks/artists, listening heatmap, streaks, total time
* All data stored in local SQLite — zero telemetry, zero cloud

### 🤖 AI-Ready MCP Bridge
* Full Model Context Protocol server so LLMs (Claude, Cursor, etc.) can natively search, play, queue radio, or download tracks
* Example: “Start a Bollywood radio from my most-completed tracks”

### 🔄 Multi-Device Handoff
* Phone can tell desktop to play or download any track instantly

---

## 🚀 Getting Started

### Prerequisites
* Node.js 20+
* [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) (must be in your PATH)
* FFmpeg (required by `yt-dlp` for merging + tagging)

### Installation

```bash
git clone [https://github.com/akshDgr8lgnd/resonance.git](https://github.com/akshDgr8lgnd/resonance.git)
cd resonance

# Install all workspaces
npm install

# Development mode (recommended first)
npm run dev
For production builds:

Bash
npm run build
npm run dist:win   # or dist:mac / dist:linux depending on your OS
The app will start with a built-in Express server + MCP endpoint on port 3939.
```



🛠️ Tech Stack
Frontend: Electron + Vite + TypeScript (renderer)

Core: TypeScript monorepo with workspaces (core, server, app)

Backend: Express + Model Context Protocol (MCP)

Database: sql.js (SQLite)

Download: yt-dlp + iTunes Search API

Build: electron-builder + tsup

🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

Fork the project.

Create your feature branch (git checkout -b feature/AmazingFeature).

Commit your changes (git commit -m 'Add some AmazingFeature').

Push to the branch (git push origin feature/AmazingFeature).

Open a Pull Request.

📝 License
Distributed under the MIT License. See LICENSE for more information.
