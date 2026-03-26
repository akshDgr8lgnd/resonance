# Resonance

**Resonance** is a high-performance, Spotify-inspired desktop music player built with Electron, React, and SQLite. It provides a premium listening experience for your local media library, combining modern aesthetics with powerful tools for library management and listening analytics.

![App Preview](https://via.placeholder.com/800x450.png?text=Resonance+Music+Player)

## Key Features

- **High-Fidelity UI**: A pixel-perfect, dark-mode interface inspired by the world's leading music streaming service.
- **Smart Library Management**: Automatically organizes your music into Albums and Artists with intelligent cross-album deduplication.
- **Advanced Search**: Integrated metadata search via iTunes API with YouTube-backed media enrichment.
- **Concurrency-Limited Downloads**: Professional-grade background download manager with queueing and semaphore-based concurrency control.
- **Sound Capsule**: Built-in listening analytics featuring playback heatmaps, weekly stats, and listening streaks.
- **Disk Usage Tracking**: Integrated storage counter to monitor your library's footprint.
- **Cross-Platform**: Designed for Windows and macOS with native-feeling interactions.
- **Ready for Mobile**: Embedded HTTP server and IPC bridge prepared for pairing with a companion Android client.

## Tech Stack

- **Core**: TypeScript, Node.js, SQLite (via `better-sqlite3`)
- **UI**: React 18, Vite, CSS3 (Vanilla)
- **Engine**: Electron 30+
- **Media Tools**: `yt-dlp` for media acquisition, `ffmpeg` (optional) for processing.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 20 or higher)
- `npm` (v10+) or `yarn`

### Configuration

1. **YouTube API Key**: 
   To enable search, you need a Google Cloud API Key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project.
   - Enable the **YouTube Data API v3**.
   - Go to **Credentials** and create an **API Key**.
   - Paste this key into your `.env` file.

2. **Environment Setup**
   Create a `.env` file in the root directory:
   ```bash
   YOUTUBE_API_KEY=your_key_here
   APP_PORT=3939
   ```

3. **Run in Development**
   ```bash
   npm run dev
   ```

## Disclaimer & Legal Notice

**Resonance is created for educational purposes and personal use only.**

1. **YouTube ToS**: This application uses `yt-dlp` to facilitate media acquisition. Users are responsible for complying with the [YouTube Terms of Service](https://www.youtube.com/t/terms), which generally prohibit downloading content.
2. **Copyright**: Ensure you have the legal right to any media you download or store within the application. The creators of Resonance do not condone or encourage copyright infringement.
3. **Trademark**: Resonance is an independent "Spotify-inspired" project. It is not affiliated with, endorsed by, or sponsored by Spotify AB.

## License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for the love of music and clean code.*
