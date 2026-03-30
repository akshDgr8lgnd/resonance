import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } from "electron";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
let tray: Tray | null = null;
let isQuitting = false;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(moduleDir, "..");
const workspaceRoot = path.resolve(appRoot, "..");
const iconPath = path.join(appRoot, "assets", "icon.png");
const trayPath = path.join(appRoot, "assets", "tray.png");
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

const getAppIcon = () => {
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? createFallbackIcon() : image;
};

const getTrayIcon = () => {
  const image = nativeImage.createFromPath(trayPath);
  return image.isEmpty() ? createFallbackIcon().resize({ width: 20, height: 20 }) : image;
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
  const server = await createServer({ library, search, downloads, capsule, settings, jobs, sync });

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

  if (!app.isPackaged) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(workspaceRoot, "renderer", "dist", "index.html"));
  }
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







