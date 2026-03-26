import cors from "cors";
import express from "express";
import path from "node:path";
import QRCode from "qrcode";
import type { CapsuleService, DeviceRecord, DownloadJobService, DownloadService, LibraryService, SearchService, SettingsService, SyncService } from "@resonance/core";
import { z } from "zod";

type ServerDeps = {
  library: LibraryService;
  search: SearchService;
  downloads: DownloadService;
  capsule: CapsuleService;
  settings: SettingsService;
  jobs: DownloadJobService;
  sync: SyncService;
};

const authMiddleware = (token: string) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === "/health") {
    return next();
  }

  const provided = req.header("authorization")?.replace("Bearer ", "");
  if (provided !== token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
};

export const createServer = async (deps: ServerDeps) => {
  const app = express();
  const settings = deps.settings.get();
  const searchSchema = z.object({ query: z.string().min(1) });
  const deviceSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    platform: z.enum(["desktop", "android", "ios", "web", "unknown"]),
    capabilities: z.array(z.string()).default([])
  });
  const syncCopiesSchema = z.object({
    deviceId: z.string().min(1),
    tracks: z.array(z.object({
      trackId: z.string().min(1),
      availability: z.enum(["available", "cached", "missing"]),
      localPath: z.string().nullable().optional()
    }))
  });
  const resolvePlaybackSchema = z.object({
    requestingDeviceId: z.string().min(1),
    query: z.string().min(1),
    trackId: z.string().optional(),
    videoId: z.string().optional(),
    title: z.string().optional(),
    artists: z.array(z.string()).optional(),
    duration: z.number().optional(),
    thumbnail: z.string().nullable().optional(),
    desktopCanDownload: z.boolean().default(true),
    allowAndroidFallback: z.boolean().default(true)
  });
  const downloadSchema = z.union([
    z.object({
      trackId: z.string().min(1)
    }),
    z.object({
      videoId: z.string().min(1),
      title: z.string(),
      artists: z.array(z.string()).default([]),
      duration: z.number().default(0),
      thumbnail: z.string().nullable().optional()
    })
  ]);

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(authMiddleware(settings.apiToken));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/library", (_req, res) => {
    const tracks = deps.library.getTracks().map((track) => ({
      ...track,
      availability: deps.library.getTrackCopies(track.id)
    }));
    res.json({ tracks, playlists: deps.library.getPlaylists(), devices: deps.library.getDevices() });
  });

  app.get("/stream/:id", (req, res) => {
    const track = deps.library.getTrackById(req.params.id);
    if (!track) {
      res.status(404).json({ error: "Track not found" });
      return;
    }
    res.sendFile(track.filePath);
  });

  app.post("/search", async (req, res) => {
    const parsed = searchSchema.parse(req.body);
    const results = await deps.search.search(parsed.query);
    res.json({ results });
  });

  app.post("/download", async (req, res) => {
    const parsed = downloadSchema.parse(req.body);

    if ("trackId" in parsed) {
      const track = deps.library.getTrackById(parsed.trackId);
      if (!track) {
        res.status(404).json({ error: "Track not found" });
        return;
      }

      res.download(track.filePath, path.basename(track.filePath));
      return;
    }

    const track = await deps.downloads.downloadTrack({
      id: parsed.videoId,
      title: parsed.title,
      artists: parsed.artists,
      duration: parsed.duration,
      thumbnail: parsed.thumbnail ?? null,
      sourceUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
      videoId: parsed.videoId,
      kind: "track"
    });

    res.json({ track });
  });

  app.get("/download-jobs/:id", (req, res) => {
    const job = deps.jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ job });
  });

  app.post("/devices/register", (req, res) => {
    const parsed = deviceSchema.parse(req.body);
    const device: DeviceRecord = {
      ...parsed,
      lastSeenAt: new Date().toISOString()
    };
    deps.library.upsertDevice(device);
    res.json({ device });
  });

  app.post("/devices/sync", (req, res) => {
    const parsed = syncCopiesSchema.parse(req.body);
    const syncedAt = new Date().toISOString();
    parsed.tracks.forEach((track) => {
      deps.library.touchTrackCopy({
        trackId: track.trackId,
        deviceId: parsed.deviceId,
        availability: track.availability,
        localPath: track.localPath ?? null,
        syncedAt,
        lastSeenAt: syncedAt
      });
    });
    res.json({ ok: true, syncedAt });
  });

  app.post("/playback/resolve", async (req, res) => {
    const parsed = resolvePlaybackSchema.parse(req.body);
    const searchResult = parsed.videoId
      ? {
          id: parsed.videoId,
          title: parsed.title ?? parsed.query,
          artists: parsed.artists ?? [],
          duration: parsed.duration ?? 0,
          thumbnail: parsed.thumbnail ?? null,
          sourceUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
          videoId: parsed.videoId,
          kind: "track" as const
        }
      : (await deps.search.search(parsed.query))[0];
    const resolution = deps.sync.resolvePlayback(
      {
        desktopDeviceId: settings.desktopDeviceId,
        requestingDeviceId: parsed.requestingDeviceId,
        query: parsed.query,
        trackId: parsed.trackId,
        videoId: parsed.videoId,
        desktopCanDownload: parsed.desktopCanDownload,
        allowAndroidFallback: parsed.allowAndroidFallback
      },
      searchResult
    );
    res.json({ resolution });
  });

  app.get("/capsule/history", (_req, res) => {
    res.json(deps.capsule.getHistory());
  });

  app.get("/settings/pairing", async (_req, res) => {
    const payload = JSON.stringify({ token: settings.apiToken, port: settings.serverPort, deviceId: settings.desktopDeviceId });
    const qrCode = await QRCode.toDataURL(payload);
    res.json({ token: settings.apiToken, port: settings.serverPort, deviceId: settings.desktopDeviceId, qrCode });
  });

  return {
    app,
    settings,
    start: () => new Promise<void>((resolve) => {
      app.listen(settings.serverPort, () => resolve());
    })
  };
};
