import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { LibraryService } from "./library.js";
import { mergeMetadata } from "./metadata.js";
import type { SearchResult, Track } from "./types.js";

export type DownloadDependencies = {
  library: LibraryService;
  mediaRoot: string;
  ytDlpPath: string;
  deviceId: string;
};

export class DownloadService {
  private downloadQueue: { result: SearchResult; resolve: (t: Track) => void; reject: (e: Error) => void }[] = [];
  private activeDownloads = 0;
  private readonly MAX_CONCURRENT = 3;

  constructor(private readonly deps: DownloadDependencies) {}

  ensureMediaRoot() {
    fs.mkdirSync(this.deps.mediaRoot, { recursive: true });
  }

  private getCoverRoot() {
    return path.join(this.deps.mediaRoot, "covers");
  }

  private async runYtDlp(args: string[]) {
    await this.updateYtDlpIfNeeded();

    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(this.deps.ytDlpPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        reject(new Error(`Unable to start yt-dlp: ${error.message}`));
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        const message = stderr.trim() || stdout.trim() || `yt-dlp exited with code ${code}`;
        reject(new Error(message));
      });
    });
  }

  private async resolveSource(result: SearchResult) {
    const source = result.sourceUrl?.trim() || `ytsearch1:${result.artists.join(", ")} - ${result.title}`;
    const { stdout } = await this.runYtDlp([
      "--dump-single-json",
      "--no-playlist",
      "--no-warnings",
      "--skip-download",
      source
    ]);

    const payload = JSON.parse(stdout);
    const resolvedVideoId = typeof payload.id === "string" && !payload.id.includes(" ") ? payload.id : null;
    const resolvedTitle =
      source.startsWith("ytsearch1:") && result.title
        ? result.title
        : typeof payload.title === "string"
          ? payload.title
          : result.title;
    const resolvedArtists = result.artists?.length
      ? result.artists
      : [payload.artist, payload.uploader].filter((value, index, items) => typeof value === "string" && value.trim() && items.indexOf(value) === index);

    return {
      source,
      videoId: resolvedVideoId ?? result.videoId,
      title: resolvedTitle,
      artists: resolvedArtists.length ? resolvedArtists : result.artists,
      duration: typeof payload.duration === "number" ? payload.duration : result.duration,
      thumbnail: typeof payload.thumbnail === "string" ? payload.thumbnail : result.thumbnail,
      webpageUrl: typeof payload.webpage_url === "string" ? payload.webpage_url : result.sourceUrl
    };
  }

  private async saveCover(id: string, thumbnailUrl: string | null) {
    if (!thumbnailUrl) {
      return null;
    }

    try {
      fs.mkdirSync(this.getCoverRoot(), { recursive: true });
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        return null;
      }

      const extension = thumbnailUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase() ?? "jpg";
      const coverPath = path.join(this.getCoverRoot(), `${id}.${extension}`);
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(coverPath, Buffer.from(arrayBuffer));
      return coverPath;
    } catch {
      return null;
    }
  }

  async downloadTrack(result: SearchResult): Promise<Track> {
    return new Promise((resolve, reject) => {
      this.downloadQueue.push({ result, resolve, reject });
      void this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeDownloads >= this.MAX_CONCURRENT || this.downloadQueue.length === 0) {
      return;
    }

    const { result, resolve, reject } = this.downloadQueue.shift()!;
    this.activeDownloads++;

    try {
      const track = await this.executeDownload(result);
      resolve(track);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeDownloads--;
      void this.processQueue();
    }
  }

  private async executeDownload(result: SearchResult) {
    this.ensureMediaRoot();

    const resolved = await this.resolveSource(result);
    
    // Check if we already have this specific song+album combination
    const existingExact = this.deps.library.getTrackByVideoIdAndAlbum(resolved.videoId, result.album ?? null);
    if (existingExact) {
      return existingExact;
    }

    // Check if we have the audio for this song in ANOTHER album
    const existingAudio = this.deps.library.getAllTracksByVideoId(resolved.videoId).find(t => fs.existsSync(t.filePath));
    
    let savedFile = existingAudio?.filePath ? path.basename(existingAudio.filePath) : null;
    const id = crypto.randomUUID();

    if (!savedFile) {
      const outputTemplate = path.join(this.deps.mediaRoot, `${id}.%(ext)s`);

      await this.runYtDlp([
        "--no-playlist",
        "--no-warnings",
        "-f",
        "bestaudio[acodec*=opus]/bestaudio/best",
        "-o",
        outputTemplate,
        resolved.webpageUrl || resolved.source
      ]);

      savedFile = fs.readdirSync(this.deps.mediaRoot).find(
        (file) => file.startsWith(id) && (file.endsWith(".opus") || file.endsWith(".mp3") || file.endsWith(".webm") || file.endsWith(".m4a"))
      ) || null;
      
      if (!savedFile) {
        throw new Error("Download completed but no audio file was found.");
      }
    }

    const metadata = mergeMetadata(
      {
        ...result,
        title: resolved.title,
        artists: resolved.artists.length ? resolved.artists : result.artists,
        duration: resolved.duration || result.duration,
        thumbnail: resolved.thumbnail ?? result.thumbnail,
        sourceUrl: resolved.webpageUrl || resolved.source,
        videoId: resolved.videoId
      },
      null,
      null
    );
    const coverPath = await this.saveCover(id, metadata.coverPath ?? resolved.thumbnail ?? result.thumbnail);
    const track: Track = {
      id,
      title: metadata.title ?? result.title,
      artists: metadata.artists ?? result.artists,
      album: result.album ?? metadata.album ?? null,
      albumArtist: result.albumArtist ?? metadata.albumArtist ?? null,
      trackNumber: result.trackNumber ?? metadata.trackNumber ?? null,
      discNumber: result.discNumber ?? metadata.discNumber ?? null,
      duration: resolved.duration || result.duration,
      filePath: path.join(this.deps.mediaRoot, savedFile),
      coverPath,
      sourceUrl: resolved.webpageUrl || resolved.source,
      youtubeVideoId: resolved.videoId,
      downloadedAt: new Date().toISOString()
    };

    this.deps.library.saveTrack(track);
    this.deps.library.touchTrackCopy({
      trackId: track.id,
      deviceId: this.deps.deviceId,
      availability: "available",
      localPath: track.filePath,
      syncedAt: track.downloadedAt,
      lastSeenAt: track.downloadedAt
    });
    return track;
  }

  async downloadAlbum(results: SearchResult[]) {
    if (!results.length) {
      throw new Error("No album tracks were provided.");
    }

    const downloaded: Track[] = [];
    for (const result of results) {
      downloaded.push(await this.downloadTrack(result));
    }
    return downloaded;
  }

  async updateYtDlpIfNeeded() {
    if (!fs.existsSync(this.deps.ytDlpPath)) {
      fs.mkdirSync(path.dirname(this.deps.ytDlpPath), { recursive: true });
      const downloadUrl =
        process.platform === "win32"
          ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
          : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Unable to download yt-dlp from ${downloadUrl}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(this.deps.ytDlpPath, Buffer.from(arrayBuffer));
      if (process.platform !== "win32") {
        fs.chmodSync(this.deps.ytDlpPath, 0o755);
      }
    }

    return { checkedAt: new Date().toISOString(), path: this.deps.ytDlpPath };
  }

  async getStorageUsage(): Promise<number> {
    const getSize = (dir: string): number => {
      let total = 0;
      if (!fs.existsSync(dir)) return 0;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            total += getSize(filePath);
          } else {
            total += stats.size;
          }
        }
      } catch (e) {
        console.error("Storage usage error:", e);
      }
      return total;
    };
    return getSize(this.deps.mediaRoot);
  }
}
