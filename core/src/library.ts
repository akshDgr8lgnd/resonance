import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AppDatabase } from "./db.js";
import type { DeviceRecord, DownloadJob, Playlist, Track, TrackCopy } from "./types.js";

const mapTrack = (row: any): Track => {
  let artists = JSON.parse(row.artists);
  if (Array.isArray(artists)) {
    const newArtists: string[] = [];
    for (const a of artists) {
      if (typeof a === "string" && (a.includes("&") || a.includes(","))) {
        newArtists.push(...a.split(/,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+/i).map((s: string) => s.trim()).filter(Boolean));
      } else {
        newArtists.push(a);
      }
    }
    artists = newArtists;
  }

  return {
    id: row.id,
    title: row.title,
    artists,
    album: row.album,
    albumArtist: row.album_artist,
    trackNumber: row.track_number,
    discNumber: row.disc_number,
    duration: row.duration,
    filePath: row.file_path,
    coverPath: row.cover_path,
    sourceUrl: row.source_url,
    youtubeVideoId: row.youtube_video_id,
    downloadedAt: row.downloaded_at
  };
};

const mapDevice = (row: any): DeviceRecord => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  capabilities: JSON.parse(row.capabilities),
  lastSeenAt: row.last_seen_at
});

const mapTrackCopy = (row: any): TrackCopy => ({
  trackId: row.track_id,
  deviceId: row.device_id,
  availability: row.availability,
  localPath: row.local_path,
  syncedAt: row.synced_at,
  lastSeenAt: row.last_seen_at
});

const mapDownloadJob = (row: any): DownloadJob => ({
  id: row.id,
  status: row.status,
  requestedByDeviceId: row.requested_by_device_id,
  sourceQuery: row.source_query,
  videoId: row.video_id,
  title: row.title,
  artists: JSON.parse(row.artists),
  trackId: row.track_id,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class LibraryService {
  constructor(private readonly db: AppDatabase) {}

  getTracks(): Track[] {
    return this.db.queryAll("SELECT * FROM tracks ORDER BY downloaded_at DESC").map(mapTrack);
  }

  getTrackById(id: string): Track | undefined {
    const row = this.db.queryOne("SELECT * FROM tracks WHERE id = ?", [id]);
    return row ? mapTrack(row) : undefined;
  }

  getTrackByVideoId(videoId: string): Track | undefined {
    const row = this.db.queryOne("SELECT * FROM tracks WHERE youtube_video_id = ?", [videoId]);
    return row ? mapTrack(row) : undefined;
  }

  getTrackByVideoIdAndAlbum(videoId: string, album: string | null): Track | undefined {
    if (album) {
      const row = this.db.queryOne("SELECT * FROM tracks WHERE youtube_video_id = ? AND album = ?", [videoId, album]);
      return row ? mapTrack(row) : undefined;
    }
    const row = this.db.queryOne("SELECT * FROM tracks WHERE youtube_video_id = ? AND album IS NULL", [videoId]);
    return row ? mapTrack(row) : undefined;
  }

  getAllTracksByVideoId(videoId: string): Track[] {
    return this.db.queryAll("SELECT * FROM tracks WHERE youtube_video_id = ?", [videoId]).map(mapTrack);
  }

  saveTrack(track: Track) {
    this.db.run(
      `INSERT OR REPLACE INTO tracks
      (id, title, artists, album, album_artist, track_number, disc_number, duration, file_path, cover_path, source_url, youtube_video_id, downloaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        track.id,
        track.title,
        JSON.stringify(track.artists),
        track.album,
        track.albumArtist,
        track.trackNumber,
        track.discNumber,
        track.duration,
        track.filePath,
        track.coverPath,
        track.sourceUrl,
        track.youtubeVideoId,
        track.downloadedAt
      ]
    );
  }

  updateTrackMetadata(trackId: string, patch: Partial<Pick<Track, "title" | "artists" | "album" | "albumArtist" | "trackNumber" | "discNumber" | "duration" | "sourceUrl" | "youtubeVideoId">>) {
    const current = this.getTrackById(trackId);
    if (!current) return undefined;

    const next: Track = {
      ...current,
      ...patch,
      artists: patch.artists ?? current.artists
    };

    this.saveTrack(next);
    return next;
  }

  upsertDevice(device: DeviceRecord) {
    this.db.run(
      `INSERT OR REPLACE INTO devices (id, name, platform, capabilities, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      [device.id, device.name, device.platform, JSON.stringify(device.capabilities), device.lastSeenAt]
    );
  }

  touchTrackCopy(copy: TrackCopy) {
    this.db.run(
      `INSERT OR REPLACE INTO track_copies (track_id, device_id, availability, local_path, synced_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [copy.trackId, copy.deviceId, copy.availability, copy.localPath, copy.syncedAt, copy.lastSeenAt]
    );
  }

  getTrackCopies(trackId: string): TrackCopy[] {
    return this.db.queryAll("SELECT * FROM track_copies WHERE track_id = ?", [trackId]).map(mapTrackCopy);
  }

  getDevices(): DeviceRecord[] {
    return this.db.queryAll("SELECT * FROM devices ORDER BY last_seen_at DESC").map(mapDevice);
  }

  createDownloadJob(job: Omit<DownloadJob, "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO download_jobs
       (id, status, requested_by_device_id, source_query, video_id, title, artists, track_id, error_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job.id, job.status, job.requestedByDeviceId, job.sourceQuery, job.videoId, job.title, JSON.stringify(job.artists), job.trackId, job.errorMessage, now, now]
    );
  }

  updateDownloadJob(id: string, patch: Partial<Omit<DownloadJob, "id" | "createdAt">>) {
    const current = this.getDownloadJob(id);
    if (!current) return;

    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.db.run(
      `UPDATE download_jobs
       SET status = ?, requested_by_device_id = ?, source_query = ?, video_id = ?, title = ?, artists = ?, track_id = ?, error_message = ?, updated_at = ?
       WHERE id = ?`,
      [next.status, next.requestedByDeviceId, next.sourceQuery, next.videoId, next.title, JSON.stringify(next.artists), next.trackId, next.errorMessage, next.updatedAt, id]
    );
  }

  getDownloadJob(id: string): DownloadJob | undefined {
    const row = this.db.queryOne("SELECT * FROM download_jobs WHERE id = ?", [id]);
    return row ? mapDownloadJob(row) : undefined;
  }

  listTrackAvailability(trackId: string) {
    return {
      track: this.getTrackById(trackId) ?? null,
      copies: this.getTrackCopies(trackId)
    };
  }

  createPlaylist(name: string): Playlist {
    const id = crypto.randomUUID();
    this.db.run("INSERT INTO playlists (id, name) VALUES (?, ?)", [id, name]);
    return { id, name, trackCount: 0 };
  }

  renamePlaylist(id: string, name: string) {
    this.db.run("UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [name, id]);
  }

  deletePlaylist(id: string) {
    this.db.run("DELETE FROM playlists WHERE id = ?", [id]);
  }

  getPlaylists(): Playlist[] {
    return this.db.queryAll<Playlist>(
      `SELECT playlists.id, playlists.name, COUNT(playlist_tracks.track_id) AS trackCount
       FROM playlists
       LEFT JOIN playlist_tracks ON playlist_tracks.playlist_id = playlists.id
       GROUP BY playlists.id
       ORDER BY playlists.updated_at DESC`
    );
  }

  setPlaylistTracks(playlistId: string, trackIds: string[]) {
    this.db.transaction(() => {
      this.db.run("DELETE FROM playlist_tracks WHERE playlist_id = ?", [playlistId]);
      trackIds.forEach((trackId, index) => {
        this.db.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)", [playlistId, trackId, index]);
      });
    });
  }

  getPlaylistTracks(playlistId: string): Track[] {
    return this.db.queryAll(
      `SELECT tracks.* FROM tracks
       JOIN playlist_tracks ON playlist_tracks.track_id = tracks.id
       WHERE playlist_tracks.playlist_id = ?
       ORDER BY playlist_tracks.position ASC`,
      [playlistId]
    ).map(mapTrack);
  }

  addTrackToPlaylist(playlistId: string, trackId: string) {
    const nextPositionRow = this.db.queryOne<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?", [playlistId]);
    const nextPosition = (Number(nextPositionRow?.maxPos ?? -1)) + 1;
    this.db.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)", [playlistId, trackId, nextPosition]);
  }

  syncFileSystem(mediaRoot: string) {
    if (!fs.existsSync(mediaRoot)) return;
    const files = fs.readdirSync(mediaRoot);
    const audioFiles = files.filter((f) => f.endsWith(".mp3") || f.endsWith(".opus") || f.endsWith(".m4a") || f.endsWith(".webm"));

    for (const filename of audioFiles) {
      const id = path.parse(filename).name;
      const exists = this.db.queryOne("SELECT id FROM tracks WHERE id = ? OR file_path LIKE ?", [id, `%${filename}`]);
      if (!exists) {
        const filePath = path.join(mediaRoot, filename);
        let coverPath: string | null = null;
        try {
          const coversDir = path.join(mediaRoot, "covers");
          if (fs.existsSync(coversDir)) {
            const coverFiles = fs.readdirSync(coversDir).filter((f) => f.startsWith(id));
            coverPath = coverFiles.length > 0 ? path.join(coversDir, coverFiles[0]!) : null;
          }
        } catch (e) {}

        this.saveTrack({
          id,
          title: `Recovered: ${id}`,
          artists: ["Unknown"],
          album: "Recovered",
          albumArtist: "Unknown",
          trackNumber: null,
          discNumber: null,
          duration: 0,
          filePath,
          coverPath,
          sourceUrl: "",
          youtubeVideoId: null,
          downloadedAt: new Date().toISOString()
        });
      }
    }
  }

  deleteAlbum(albumName: string): Track[] {
    let tracksInAlbum: Track[];
    if (!albumName || albumName === "Single" || albumName === "Singles") {
      tracksInAlbum = this.db.queryAll("SELECT * FROM tracks WHERE album IS NULL").map(mapTrack);
      this.db.run("DELETE FROM tracks WHERE album IS NULL");
    } else {
      tracksInAlbum = this.db.queryAll("SELECT * FROM tracks WHERE album = ?", [albumName]).map(mapTrack);
      this.db.run("DELETE FROM tracks WHERE album = ?", [albumName]);
    }

    for (const track of tracksInAlbum) {
      this.db.run("DELETE FROM track_copies WHERE track_id = ?", [track.id]);
      this.db.run("DELETE FROM playlist_tracks WHERE track_id = ?", [track.id]);
    }
    return tracksInAlbum;
  }
}
