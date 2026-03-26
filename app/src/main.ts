import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
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
  SyncService
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
  const search = new SearchService({ youtubeApiKey: resolvedSettings.youtubeKey || process.env.YOUTUBE_API_KEY });
  const queue = new QueueService();
  const jobs = new DownloadJobService(library, downloads);
  const sync = new SyncService(library, jobs);
  const server = await createServer({ library, search, downloads, capsule, settings, jobs, sync });

  await downloads.updateYtDlpIfNeeded().catch(() => undefined);
  await server.start();
  logLine(`Embedded server started on port ${server.settings.serverPort}`);

  return { library, capsule, downloads, search, queue, server, sync, jobs, settings: resolvedSettings, settingsService: settings };
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
  ipcMain.removeHandler("search:query");
  ipcMain.removeHandler("download:track");
  ipcMain.removeHandler("download:album");
  ipcMain.removeHandler("playback:started");
  ipcMain.removeHandler("playback:finished");
  ipcMain.removeHandler("settings:pairing");
  ipcMain.removeHandler("library:storage-usage");
  ipcMain.removeHandler("settings:update-youtube-key");
  ipcMain.removeHandler("settings:get");

  ipcMain.handle("library:all", () => ({
    tracks: services.library.getTracks(),
    playlists: services.library.getPlaylists(),
    liveSession: services.capsule.getLiveSession()
  }));

  ipcMain.handle("library:storage-usage", () => services.downloads.getStorageUsage());

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

  ipcMain.handle("settings:update-youtube-key", (_event, key: string) => {
    services.settingsService.updateYoutubeKey(key);
    services.search.updateApiKey(key);
    return { ok: true };
  });

  ipcMain.handle("settings:get", () => services.settingsService.get());
};

const createMainWindow = async () => {
  const services = await buildServices();

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
  }
  logLine("App ready");
  createTray();
  await createMainWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  void showMainWindow();
});
