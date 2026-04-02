import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } from "electron";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDatabase,
  CapsuleService,
  DownloadJobService,
  DownloadService,
  LibraryService,
  QueueService,
  SearchService,
  SettingsService,
  SyncService,
  RecommendationService,
  CurationService
} from "../../core/dist/index.js";
import { createServer } from "../../server/dist/index.js";

let mainWindow: BrowserWindow | null = null;
let miniPlayerWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(moduleDir, "..");
const workspaceRoot = path.resolve(appRoot, "..");
const iconPath = path.join(appRoot, "assets", process.platform === "win32" ? "icon.ico" : "icon.svg");
const trayPath = path.join(appRoot, "assets", "tray.svg");
const logPath = path.join(app.getPath("userData"), "resonance.log");

const logLine = (message: string) => {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Ignore logging failures so the app can still start.
  }
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown error";
};

const loadLocalEnv = () => {
  const envPath = path.join(workspaceRoot, ".env");
  if (!fs.existsSync(envPath)) return;

  const entries = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const entry of entries) {
    const line = entry.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const createFallbackIcon = () =>
  nativeImage.createFromDataURL(
    "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
          <rect width="256" height="256" rx="72" fill="#0b120d"/>
          <rect x="18" y="18" width="220" height="220" rx="58" fill="#1b3124" opacity="0.92"/>
          <circle cx="128" cy="128" r="78" fill="#09110c"/>
          <circle cx="128" cy="128" r="62" fill="none" stroke="#1db954" stroke-width="12"/>
          <circle cx="128" cy="128" r="40" fill="none" stroke="#7cf2a8" stroke-width="10"/>
          <circle cx="128" cy="128" r="15" fill="#c6ffdb"/>
          <path d="M57 93c19-17 42-26 71-26s52 9 71 26" fill="none" stroke="#1db954" stroke-width="10" stroke-linecap="round"/>
          <path d="M67 174c16 14 36 21 61 21s45-7 61-21" fill="none" stroke="#7cf2a8" stroke-width="10" stroke-linecap="round"/>
        </svg>`
      )
  );

const createAssetIcon = (assetPath: string) => {
  try {
    if (!fs.existsSync(assetPath)) return createFallbackIcon();
    if (assetPath.endsWith(".svg")) {
      const svg = fs.readFileSync(assetPath, "utf8");
      return nativeImage.createFromDataURL(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    }
    return nativeImage.createFromPath(assetPath);
  } catch {
    return createFallbackIcon();
  }
};

const getAppIcon = () => {
  const image = createAssetIcon(iconPath);
  return image.isEmpty() ? createFallbackIcon() : image;
};

const getTrayIcon = () => {
  const image = createAssetIcon(trayPath);
  return image.isEmpty() ? createFallbackIcon().resize({ width: 20, height: 20 }) : image.resize({ width: 20, height: 20 });
};
const getArtworkCacheRoot = () => path.join(app.getPath("userData"), "artwork-cache");

const sanitizeArtworkKey = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "item";
};

type ItunesArtworkResult = {
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
};

type LyricsPayload = {
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
};

type LyricsResponse = {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
};

type PlaybackState = {
  track: {
    id: string;
    title: string;
    artists: string[];
    album: string | null;
    coverPath: string | null;
    duration: number;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
};

type PlaybackOpenPayload = {
  trackId: string;
  queueTrackIds?: string[];
};

let playbackState: PlaybackState = {
  track: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85
};


const lookupArtworkUrl = async (kind: "album" | "artist", name: string, artist?: string | null) => {
  const term = kind === "album" ? `${name} ${artist ?? ""}`.trim() : name.trim();
  if (!term) return null;

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", kind === "album" ? "song" : "musicTrack");
  url.searchParams.set("limit", "12");

  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = (await response.json()) as { results?: ItunesArtworkResult[] };
  const results = payload.results ?? [];
  if (!results.length) return null;

  const loweredName = name.toLowerCase();
  const loweredArtist = artist?.toLowerCase() ?? null;
  const scored = results
    .map((result) => {
      let score = 0;
      const resultArtist = result.artistName?.toLowerCase() ?? "";
      const resultAlbum = result.collectionName?.toLowerCase() ?? "";
      if (kind === "album") {
        if (resultAlbum === loweredName) score += 5;
        else if (resultAlbum.includes(loweredName)) score += 3;
        if (loweredArtist && resultArtist.includes(loweredArtist)) score += 4;
      } else if (resultArtist === loweredName) {
        score += 5;
      } else if (resultArtist.includes(loweredName)) {
        score += 3;
      }
      return { result, score };
    })
    .sort((a, b) => b.score - a.score);

  const artworkUrl = scored[0]?.result.artworkUrl100 ?? scored[0]?.result.artworkUrl60 ?? null;
  return artworkUrl ? artworkUrl.replace(/100x100bb|60x60bb/g, "512x512bb") : null;
};

const cacheArtwork = async (kind: "album" | "artist", name: string, artist?: string | null) => {
  const key = `${kind}-${sanitizeArtworkKey(name)}-${sanitizeArtworkKey(artist ?? "")}`;
  const cacheRoot = getArtworkCacheRoot();
  fs.mkdirSync(cacheRoot, { recursive: true });

  const existing = fs.readdirSync(cacheRoot).find((file) => file.startsWith(`${key}.`));
  if (existing) {
    return path.join(cacheRoot, existing);
  }

  const artworkUrl = await lookupArtworkUrl(kind, name, artist);
  if (!artworkUrl) return null;

  try {
    const response = await fetch(artworkUrl);
    if (!response.ok) return null;
    const extension = artworkUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() ?? "jpg";
    const filePath = path.join(cacheRoot, `${key}.${extension}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
};

const getLyricsCacheRoot = () => path.join(app.getPath("userData"), "lyrics-cache");

const fetchLyricsFromLrcLib = async (payload: LyricsPayload): Promise<LyricsResponse | null> => {
  const title = payload.title.trim();
  const artist = payload.artist.trim();
  if (!title || !artist) return null;

  const baseUrl = "https://lrclib.net/api";
  const queryUrl = new URL(`${baseUrl}/get`);
  queryUrl.searchParams.set("track_name", title);
  queryUrl.searchParams.set("artist_name", artist);
  if (payload.album) queryUrl.searchParams.set("album_name", payload.album);
  if (payload.duration) queryUrl.searchParams.set("duration", String(Math.round(payload.duration)));

  try {
    const directResponse = await fetch(queryUrl);
    if (directResponse.ok) {
      const directPayload = await directResponse.json() as LyricsResponse;
      if (directPayload.syncedLyrics || directPayload.plainLyrics || directPayload.instrumental) {
        return directPayload;
      }
    }
  } catch {
    // Fall through to search.
  }

  try {
    const searchUrl = new URL(`${baseUrl}/search`);
    searchUrl.searchParams.set("track_name", title);
    searchUrl.searchParams.set("artist_name", artist);
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return null;
    const matches = await searchResponse.json() as LyricsResponse[];
    return matches.find((item) => item.syncedLyrics || item.plainLyrics) ?? matches[0] ?? null;
  } catch {
    return null;
  }
};

const fetchPlainLyricsFallback = async (payload: LyricsPayload): Promise<string | null> => {
  const title = payload.title.trim();
  const artist = payload.artist.trim();
  if (!title || !artist) return null;

  try {
    const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (!response.ok) return null;
    const data = await response.json() as { lyrics?: string };
    const lyrics = data.lyrics?.trim();
    return lyrics ? lyrics : null;
  } catch {
    return null;
  }
};

const cacheLyrics = async (payload: LyricsPayload) => {
  const cacheRoot = getLyricsCacheRoot();
  fs.mkdirSync(cacheRoot, { recursive: true });
  const key = `v2-${sanitizeArtworkKey(payload.title)}-${sanitizeArtworkKey(payload.artist)}`;
  const filePath = path.join(cacheRoot, `${key}.json`);

  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as LyricsResponse;
    } catch {
      // Ignore corrupted cache and refetch.
    }
  }

  const primaryLyrics = await fetchLyricsFromLrcLib(payload);
  const fallbackPlainLyrics = await fetchPlainLyricsFallback(payload);
  const lyrics = primaryLyrics
    ? {
        ...primaryLyrics,
        instrumental: primaryLyrics.instrumental && !fallbackPlainLyrics ? true : false,
        plainLyrics: primaryLyrics.plainLyrics ?? fallbackPlainLyrics ?? null
      }
    : fallbackPlainLyrics
      ? { plainLyrics: fallbackPlainLyrics, instrumental: false }
      : null;
  if (!lyrics) return null;

  try {
    fs.writeFileSync(filePath, JSON.stringify(lyrics), "utf8");
  } catch {
    // Ignore cache write failures.
  }

  return lyrics;
};

const getRendererUrl = (mini = false) => {
  if (!app.isPackaged) {
    return `http://localhost:5173${mini ? "?mini=1" : ""}`;
  }
  const rendererPath = path.join(workspaceRoot, "renderer", "dist", "index.html");
  const baseUrl = pathToFileURL(rendererPath).toString();
  return `${baseUrl}${mini ? "?mini=1" : ""}`;
};

const broadcastPlaybackState = () => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send("playback-state", playbackState);
  }
};

const showMiniPlayerWindow = async () => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.show();
    miniPlayerWindow.focus();
    broadcastPlaybackState();
    return miniPlayerWindow;
  }

  miniPlayerWindow = new BrowserWindow({
    width: 300,
    height: 118,
    minWidth: 280,
    minHeight: 108,
    maxWidth: 340,
    maxHeight: 160,
    show: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: "#121212",
    title: "Resonance Mini Player",
    icon: getAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot, "dist", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: app.isPackaged
    }
  });

  miniPlayerWindow.setAlwaysOnTop(true, "screen-saver");
  miniPlayerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniPlayerWindow.once("ready-to-show", () => {
    miniPlayerWindow?.show();
    broadcastPlaybackState();
  });
  miniPlayerWindow.on("closed", () => {
    miniPlayerWindow = null;
  });

  await miniPlayerWindow.loadURL(getRendererUrl(true));
  return miniPlayerWindow;
};
const buildServices = async () => {
  logLine("Building services");
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "resonance.sqlite");
  const mediaRoot = path.join(userDataPath, "media");
  fs.mkdirSync(mediaRoot, { recursive: true });
  const toolsRoot = path.join(userDataPath, "bin");
  const db = await createDatabase(dbPath);
  const library = new LibraryService(db);
  const capsule = new CapsuleService(db);
  const settings = new SettingsService(db);
  const resolvedSettings = settings.get();

  library.upsertDevice({
    id: resolvedSettings.desktopDeviceId,
    name: "Resonance Desktop",
    platform: "desktop",
    capabilities: ["stream", "download", "library-sync", "background-playback"],
    lastSeenAt: new Date().toISOString()
  });

  const ytDlpPath = path.join(toolsRoot, process.platform, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  const downloads = new DownloadService({ library, mediaRoot, ytDlpPath, deviceId: resolvedSettings.desktopDeviceId });
  const search = new SearchService();
  const queue = new QueueService();
  const jobs = new DownloadJobService(library, downloads);
  const sync = new SyncService(library, jobs);
  const recommendations = new RecommendationService(db, library);
  const curation = new CurationService(db, library, recommendations);
  const server = await createServer({
    library,
    search,
    downloads,
    capsule,
    settings,
    jobs,
    sync,
    playback: {
      getState: () => playbackState,
      sendCommand: (command) => {
        if (command === "show-main") {
          void showMainWindow();
          return { ok: true };
        }
        if (!mainWindow || mainWindow.isDestroyed()) {
          return { ok: false, error: "Main player window is not available" };
        }
        mainWindow.webContents.send("playback-command", command);
        return { ok: true };
      },
      playTrackById: async (trackId) => {
        const track = library.getTrackById(trackId);
        if (!track) {
          return { ok: false, error: "Track not found" };
        }
        if (!mainWindow || mainWindow.isDestroyed()) {
          return { ok: false, error: "Main player window is not available" };
        }
        const payload: PlaybackOpenPayload = { trackId: track.id, queueTrackIds: [track.id] };
        mainWindow.webContents.send("playback-open-track", payload);
        return { ok: true, track };
      },
      startRadio: async (trackId, options) => {
        const seedTrack = library.getTrackById(trackId);
        if (!seedTrack) {
          return { ok: false, error: "Track not found" };
        }
        if (!mainWindow || mainWindow.isDestroyed()) {
          return { ok: false, error: "Main player window is not available" };
        }
        const limit = Math.max(1, Math.min(50, Number(options?.limit ?? 25)));
        const radioTracks = curation.getTrackRadio(trackId, options?.profile ?? "balanced", limit);
        const queueTrackIds = [seedTrack.id, ...radioTracks.filter((entry) => entry.id !== seedTrack.id).map((entry) => entry.id)];
        const payload: PlaybackOpenPayload = { trackId: seedTrack.id, queueTrackIds };
        mainWindow.webContents.send("playback-open-track", payload);
        return { ok: true, queueTrackIds };
      }
    }
  });

  await downloads.updateYtDlpIfNeeded().catch(() => undefined);
  curation.refreshDailyBundles();
  await server.start();
  logLine(`Embedded server started on port ${server.settings.serverPort}`);

  return { library, capsule, downloads, search, queue, server, sync, recommendations, curation, jobs, settings: resolvedSettings, settingsService: settings, mediaRoot };
};

let nightlyRefreshTimer: NodeJS.Timeout | null = null;

const scheduleNightlyCurationRefresh = (services: Awaited<ReturnType<typeof buildServices>>) => {
  if (nightlyRefreshTimer) {
    clearTimeout(nightlyRefreshTimer);
  }

  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(0, 10, 0, 0);
  const delay = Math.max(next.getTime() - Date.now(), 60_000);

  nightlyRefreshTimer = setTimeout(() => {
    Promise.resolve(services.curation.refreshDailyBundles(true))
      .then(() => logLine("Nightly curation refresh complete"))
      .catch((error) => logLine(`Nightly curation refresh failed: ${serializeError(error)}`))
      .finally(() => scheduleNightlyCurationRefresh(services));
  }, delay);
};
const showMainWindow = async () => {
  if (!mainWindow) {
    await createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  if (tray) return;

  tray = new Tray(getTrayIcon());
  tray.setToolTip("Resonance");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Resonance", click: () => void showMainWindow() },
      { label: "Show Mini Player", click: () => void showMiniPlayerWindow() },
      { label: "Quit", click: () => { isQuitting = true; app.quit(); } }
    ])
  );
  tray.on("double-click", () => void showMainWindow());
};

const registerWindowLifecycle = () => {
  if (!mainWindow) return;

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("minimize" as any, (event: Electron.Event) => {
    event.preventDefault();
    mainWindow?.hide();
  });
};

const registerIpcHandlers = (services: Awaited<ReturnType<typeof buildServices>>) => {
  ipcMain.removeHandler("library:all");
  ipcMain.removeHandler("capsule:history");
  ipcMain.removeHandler("download:track");
  ipcMain.removeHandler("download:album");
  ipcMain.removeHandler("playback:started");
  ipcMain.removeHandler("playback:finished");
  ipcMain.removeHandler("settings:pairing");
  ipcMain.removeHandler("library:storage-usage");
  ipcMain.removeHandler("settings:get");
  ipcMain.removeHandler("library:open-folder");
  ipcMain.removeHandler("library:folder-path");
  ipcMain.removeHandler("playlist:create");
  ipcMain.removeHandler("playlist:all");
  ipcMain.removeHandler("playlist:rename");
  ipcMain.removeHandler("playlist:delete");
  ipcMain.removeHandler("playlist:set-tracks");
  ipcMain.removeHandler("playlist:add-track");
  ipcMain.removeHandler("recommendations:get");
  ipcMain.removeHandler("recommendations:feedback");
  ipcMain.removeHandler("recommendations:auto-next");
  ipcMain.removeHandler("library:repair-metadata");
  ipcMain.removeHandler("curation:daily");
  ipcMain.removeHandler("curation:radio");
  ipcMain.removeHandler("curation:auto-queue");
  ipcMain.removeHandler("curation:refresh");
  ipcMain.removeHandler("artwork:lookup");
  ipcMain.removeHandler("lyrics:get");
  ipcMain.removeHandler("mini-player:toggle");
  ipcMain.removeHandler("playback:state:get");
  ipcMain.removeHandler("playback:state:update");
  ipcMain.removeHandler("window:toggle-fullscreen");
  ipcMain.removeAllListeners("playback:command");

  ipcMain.handle("library:all", () => ({
    tracks: services.library.getTracks(),
    playlists: services.library.getPlaylists(),
    liveSession: services.capsule.getLiveSession()
  }));

  ipcMain.handle("library:sync", () => services.library.syncFileSystem(services.mediaRoot));
  ipcMain.handle("library:folder-path", () => services.mediaRoot);
  ipcMain.handle("library:open-folder", async () => {
    fs.mkdirSync(services.mediaRoot, { recursive: true });
    const error = await shell.openPath(services.mediaRoot);
    return { ok: !error, error };
  });

  ipcMain.handle("library:storage-usage", () => services.downloads.getStorageUsage());
  ipcMain.handle("library:repair-metadata", async () => services.downloads.repairLibraryMetadata());

  ipcMain.handle("curation:daily", (_event, payload?: { profile?: "balanced" | "bollywood" | "discovery" | "comfort" }) => {
    return services.curation.getDailyBundle(payload?.profile ?? "balanced");
  });

  ipcMain.handle("curation:radio", (_event, payload: { trackId: string; profile?: "balanced" | "bollywood" | "discovery" | "comfort"; limit?: number }) => {
    if (!payload?.trackId) return [];
    const limit = Math.max(1, Math.min(50, Number(payload?.limit ?? 25)));
    return services.curation.getTrackRadio(payload.trackId, payload.profile ?? "balanced", limit);
  });

  ipcMain.handle("curation:auto-queue", (_event, payload?: { currentTrackId?: string; profile?: "balanced" | "bollywood" | "discovery" | "comfort"; limit?: number }) => {
    const limit = Math.max(1, Math.min(50, Number(payload?.limit ?? 15)));
    return services.curation.getAutoQueue(payload?.currentTrackId, payload?.profile ?? "balanced", limit);
  });

  ipcMain.handle("curation:refresh", () => {
    return services.curation.refreshDailyBundles(true);
  });

  ipcMain.handle("artwork:lookup", async (_event, payload?: { kind?: "album" | "artist"; name?: string; artist?: string | null }) => {
    const kind = payload?.kind;
    const name = payload?.name?.trim();
    if (!kind || !name) return null;
    return cacheArtwork(kind, name, payload?.artist ?? null);
  });
  ipcMain.handle("lyrics:get", (_event, payload?: LyricsPayload) => {
    if (!payload?.title || !payload?.artist) return null;
    return cacheLyrics(payload);
  });
  ipcMain.handle("mini-player:toggle", async () => {
    if (miniPlayerWindow && !miniPlayerWindow.isDestroyed() && miniPlayerWindow.isVisible()) {
      miniPlayerWindow.hide();
      return { visible: false };
    }
    await showMiniPlayerWindow();
    return { visible: true };
  });
  ipcMain.handle("playback:state:get", () => playbackState);
  ipcMain.handle("playback:state:update", (_event, payload: PlaybackState) => {
    playbackState = {
      track: payload?.track ?? null,
      isPlaying: Boolean(payload?.isPlaying),
      currentTime: Number(payload?.currentTime ?? 0),
      duration: Number(payload?.duration ?? payload?.track?.duration ?? 0),
      volume: Number(payload?.volume ?? 0.85)
    };
    broadcastPlaybackState();
    return playbackState;
  });
  ipcMain.handle("window:toggle-fullscreen", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return { fullscreen: false };
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return { fullscreen: next };
  });
  ipcMain.on("playback:command", (_event, command: "toggle-play" | "next" | "previous" | "show-main") => {
    if (command === "show-main") {
      void showMainWindow();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("playback-command", command);
    }
  });
  ipcMain.handle("capsule:history", () => services.capsule.getHistory());
  ipcMain.handle("search:query", (_event, query: string) => services.search.search(query));
  ipcMain.handle("download:track", async (_event, payload) => {
    try {
      const track = await services.downloads.downloadTrack(payload);
      return { ok: true, track };
    } catch (error) {
      const message = serializeError(error);
      logLine(`Download failed: ${message}`);
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("download:album", async (_event, payload: any[]) => {
    try {
      const tracks = await services.downloads.downloadAlbum(payload);
      return { ok: true, tracks };
    } catch (error) {
      const message = serializeError(error);
      logLine(`Album download failed: ${message}`);
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("library:delete-album", (_event, albumName: string) => {
    try {
      const tracks = services.library.deleteAlbum(albumName);
      for (const track of tracks) {
        if (track.filePath && fs.existsSync(track.filePath)) {
          fs.unlinkSync(track.filePath);
        }
        if (track.coverPath && fs.existsSync(track.coverPath)) {
          fs.unlinkSync(track.coverPath);
        }
      }
      return { ok: true };
    } catch (error) {
      const message = serializeError(error);
      logLine(`Album delete failed: ${message}`);
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("playback:started", (_event, trackId: string) => {
    services.capsule.beginSession(trackId);
    return services.capsule.getLiveSession();
  });
  ipcMain.handle("playback:finished", (_event, payload: { trackId: string; durationPlayed: number }) => {
    services.capsule.recordPlay({
      trackId: payload.trackId,
      durationPlayed: payload.durationPlayed,
      playedAt: new Date().toISOString()
    });
    return services.capsule.getHistory();
  });
  ipcMain.handle("settings:pairing", async () => {
    const response = await fetch(`http://127.0.0.1:${services.server.settings.serverPort}/settings/pairing`, {
      headers: { Authorization: `Bearer ${services.server.settings.apiToken}` }
    });
    return response.json();
  });

  ipcMain.handle("settings:get", () => services.settingsService.get());

  ipcMain.handle("playlist:create", (_event, name: string) => services.library.createPlaylist(name));
  ipcMain.handle("playlist:all", () => services.library.getPlaylists());
  ipcMain.handle("playlist:rename", (_event, payload: { id: string; name: string }) => services.library.renamePlaylist(payload.id, payload.name));
  ipcMain.handle("playlist:delete", (_event, id: string) => services.library.deletePlaylist(id));
  ipcMain.handle("playlist:set-tracks", (_event, payload: { playlistId: string; trackIds: string[] }) => services.library.setPlaylistTracks(payload.playlistId, payload.trackIds));
  ipcMain.handle("playlist:get-tracks", (_event, id: string) => services.library.getPlaylistTracks(id));
  ipcMain.handle("playlist:add-track", (_event, payload: { playlistId: string; trackId: string }) => services.library.addTrackToPlaylist(payload.playlistId, payload.trackId));

  ipcMain.handle("recommendations:get", (_event, payload?: { limit?: number; seedTrackId?: string; profile?: "balanced" | "bollywood" | "discovery" | "comfort" }) => {
    const limit = Math.max(1, Math.min(50, Number(payload?.limit ?? 20)));
    return services.recommendations.getRecommendations(limit, payload?.seedTrackId, payload?.profile ?? "balanced");
  });

  ipcMain.handle("recommendations:feedback", (_event, payload: { trackId: string; feedback: "like" | "skip" | "neutral" }) => {
    if (!payload?.trackId) return { ok: false };
    services.recommendations.setFeedback(payload.trackId, payload.feedback);
    return { ok: true };
  });
  ipcMain.handle("recommendations:auto-next", async (_event, payload?: { currentTrackId?: string; profile?: "balanced" | "bollywood" | "discovery" | "comfort" }) => {
    const currentTrackId = payload?.currentTrackId;
    const autoQueue = services.curation.getAutoQueue(currentTrackId, payload?.profile ?? "balanced", 12);
    const nextFromQueue = autoQueue.find((track) => track.id !== currentTrackId);
    if (nextFromQueue) {
      return { ok: true, track: nextFromQueue, mode: "library" as const };
    }

    const local = services.recommendations.getRecommendations(30, currentTrackId, payload?.profile ?? "balanced");
    const nextLocal = local.find((entry) => entry.track.id !== currentTrackId)?.track;
    if (nextLocal) {
      return { ok: true, track: nextLocal, mode: "library" as const };
    }

    const seed = currentTrackId ? services.library.getTrackById(currentTrackId) : undefined;
    const query = seed
      ? `${seed.title} ${seed.artists[0] ?? ""}`.trim()
      : "Top Bollywood songs";

    const searchResults = await services.search.search(query);
    const candidate = searchResults.find((result) => {
      if (!result.videoId) return true;
      const existing = services.library.getTrackByVideoId(result.videoId);
      return !existing;
    }) ?? searchResults[0];

    if (!candidate) {
      return { ok: false, reason: "no_candidate" as const };
    }

    try {
      const downloaded = await services.downloads.downloadTrack(candidate);
      return { ok: true, track: downloaded, mode: "downloaded" as const };
    } catch (error) {
      const fallbackExisting = candidate.videoId ? services.library.getTrackByVideoId(candidate.videoId) : undefined;
      if (fallbackExisting) {
        return { ok: true, track: fallbackExisting, mode: "library" as const };
      }
      const message = error instanceof Error ? error.message : String(error);
      logLine("Auto-next download failed: " + message);
      return { ok: false, reason: "download_failed" as const, error: message };
    }
  });
};

const createMainWindow = async () => {
  const services = await buildServices();
  scheduleNightlyCurationRefresh(services);

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1220,
    minHeight: 760,
    show: false,
    backgroundColor: "#121212",
    title: "Resonance",
    icon: getAppIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot, "dist", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: app.isPackaged
    }
  });

  mainWindow.setIcon(getAppIcon());

  registerIpcHandlers(services);
  registerWindowLifecycle();
  mainWindow.webContents.on("did-finish-load", () => {
    logLine("Renderer finished load");
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logLine(`Renderer failed load: ${errorCode} ${errorDescription} ${validatedURL}`);
    void mainWindow?.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(`<html><body style="background:#121212;color:#f5f5f5;font-family:sans-serif;padding:32px;"><h1>Resonance could not load the UI</h1><p>${errorDescription}</p><p>See resonance.log in the app data folder for details.</p></body></html>`)
    );
  });
  mainWindow.webContents.on("console-message", (_event, level, message) => {
    logLine(`Renderer console [${level}]: ${message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logLine(`Renderer process gone: ${details.reason}`);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  await mainWindow.loadURL(getRendererUrl(false));
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    void showMainWindow();
  });
}

app.setAppUserModelId("com.resonance.desktop");

app.whenReady().then(async () => {
  if (!app.isPackaged) {
    loadLocalEnv();
  } else {
    void autoUpdater.checkForUpdatesAndNotify();
  }
  logLine("App ready");
  createTray();
  await createMainWindow();
});

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

process.stderr.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

app.on("before-quit", () => {
  isQuitting = true;
  if (nightlyRefreshTimer) {
    clearTimeout(nightlyRefreshTimer);
    nightlyRefreshTimer = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  void showMainWindow();
});












