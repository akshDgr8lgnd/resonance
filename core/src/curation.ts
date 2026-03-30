import type { AppDatabase } from "./db.js";
import type { LibraryService } from "./library.js";
import { RecommendationService } from "./recommendations.js";
import type { CuratedShelf, DailyCurationBundle, RecommenderProfile, Track, TrackFeedback } from "./types.js";

type PlayAggregate = {
  trackId: string;
  playCount: number;
  totalPlayed: number;
  lastPlayedAt: string | null;
};

type FeedbackRow = {
  trackId: string;
  feedback: TrackFeedback;
  updatedAt: string;
};

type DayCountRow = {
  trackId: string;
  playCount: number;
};

type HourCountRow = {
  trackId: string;
  playCount: number;
};

const PROFILES: RecommenderProfile[] = ["balanced", "bollywood", "discovery", "comfort"];
const STORAGE_PREFIX = "curation.bundle.";

const toLocalDateKey = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dedupeTracks = (tracks: Array<Track | undefined | null>, limit: number, exclude = new Set<string>()) => {
  const seen = new Set<string>(exclude);
  const unique: Track[] = [];

  for (const track of tracks) {
    if (!track?.filePath || seen.has(track.id)) continue;
    seen.add(track.id);
    unique.push(track);
    if (unique.length >= limit) break;
  }

  return unique;
};

const buildShelf = (
  id: string,
  title: string,
  subtitle: string,
  type: CuratedShelf["type"],
  tracks: Array<Track | undefined | null>,
  limit = 24
): CuratedShelf => ({
  id,
  title,
  subtitle,
  type,
  tracks: dedupeTracks(tracks, limit)
});

const readCachedBundle = (db: AppDatabase, profile: RecommenderProfile) => {
  const row = db.queryOne<{ value: string }>("SELECT value FROM settings WHERE key = ?", [`${STORAGE_PREFIX}${profile}`]);
  if (!row?.value) return undefined;

  try {
    return JSON.parse(row.value) as DailyCurationBundle;
  } catch {
    return undefined;
  }
};

const writeCachedBundle = (db: AppDatabase, profile: RecommenderProfile, bundle: DailyCurationBundle) => {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [`${STORAGE_PREFIX}${profile}`, JSON.stringify(bundle)]);
};

export class CurationService {
  constructor(
    private readonly db: AppDatabase,
    private readonly library: LibraryService,
    private readonly recommendations: RecommendationService
  ) {}

  getDailyBundle(profile: RecommenderProfile = "balanced") {
    return this.ensureDailyBundle(profile);
  }

  refreshDailyBundles(force = false) {
    const bundles: DailyCurationBundle[] = [];
    for (const profile of PROFILES) {
      bundles.push(this.ensureDailyBundle(profile, force));
    }
    return bundles;
  }

  getTrackRadio(trackId: string, profile: RecommenderProfile = "balanced", limit = 25) {
    const seed = this.library.getTrackById(trackId);
    if (!seed) return [] as Track[];

    const sameAlbum = this.library
      .getTracks()
      .filter((track) => track.id !== trackId && seed.album && track.album === seed.album);
    const sameArtist = this.library
      .getTracks()
      .filter((track) => track.id !== trackId && track.artists.some((artist) => seed.artists.includes(artist)));
    const recommended = this.recommendations
      .getRecommendations(limit * 3, trackId, profile)
      .map((entry) => entry.track)
      .filter((track) => track.id !== trackId);

    return dedupeTracks([...sameAlbum, ...sameArtist, ...recommended], limit, new Set([trackId]));
  }

  getAutoQueue(currentTrackId?: string, profile: RecommenderProfile = "balanced", limit = 15) {
    if (currentTrackId) {
      const radio = this.getTrackRadio(currentTrackId, profile, limit);
      if (radio.length) return radio;
    }

    const bundle = this.ensureDailyBundle(profile);
    return dedupeTracks(
      [
        ...bundle.mixes.flatMap((shelf) => shelf.tracks),
        ...bundle.autoPlaylists.flatMap((shelf) => shelf.tracks),
        ...bundle.timeShelves.flatMap((shelf) => shelf.tracks)
      ],
      limit,
      currentTrackId ? new Set([currentTrackId]) : undefined
    );
  }

  private ensureDailyBundle(profile: RecommenderProfile, force = false) {
    const today = toLocalDateKey();
    const cached = readCachedBundle(this.db, profile);
    if (!force && cached?.dayKey === today) {
      return cached;
    }

    const bundle = this.generateBundle(profile, today);
    writeCachedBundle(this.db, profile, bundle);
    return bundle;
  }

  private generateBundle(profile: RecommenderProfile, dayKey: string): DailyCurationBundle {
    const tracks = this.library.getTracks();
    const plays = this.db.queryAll<PlayAggregate>(
      `SELECT track_id AS trackId,
              COUNT(*) AS playCount,
              COALESCE(SUM(duration_played), 0) AS totalPlayed,
              MAX(played_at) AS lastPlayedAt
       FROM plays
       GROUP BY track_id`
    );
    const weeklyTopRows = this.db.queryAll<DayCountRow>(
      `SELECT track_id AS trackId, COUNT(*) AS playCount
       FROM plays
       WHERE played_at >= datetime('now', '-7 days')
       GROUP BY track_id
       ORDER BY playCount DESC, MAX(played_at) DESC
       LIMIT 40`
    );
    const morningRows = this.getWindowRows(6, 11);
    const commuteRows = this.getWindowRows(17, 20);
    const lateNightRows = [...this.getWindowRows(22, 23), ...this.getWindowRows(0, 3)];
    const feedbackRows = this.db.queryAll<FeedbackRow>(
      `SELECT track_id AS trackId, feedback, updated_at AS updatedAt
       FROM track_feedback
       ORDER BY updated_at DESC`
    );

    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    const playMap = new Map(plays.map((row) => [row.trackId, row]));
    const likedTracks = feedbackRows
      .filter((row) => row.feedback === "like")
      .map((row) => trackMap.get(row.trackId))
      .filter(Boolean) as Track[];
    const skippedTracks = feedbackRows
      .filter((row) => row.feedback === "skip")
      .map((row) => trackMap.get(row.trackId))
      .filter(Boolean) as Track[];

    const comfortRecs = this.recommendations.getRecommendations(30, undefined, "comfort").map((entry) => entry.track);
    const discoveryRecs = this.recommendations.getRecommendations(30, undefined, "discovery").map((entry) => entry.track);
    const bollywoodRecs = this.recommendations.getRecommendations(30, undefined, "bollywood").map((entry) => entry.track);
    const profileRecs = this.recommendations.getRecommendations(30, undefined, profile).map((entry) => entry.track);

    const lowPlayRecommendations = discoveryRecs
      .filter((track) => (playMap.get(track.id)?.playCount ?? 0) <= 1 && !likedTracks.some((liked) => liked.id === track.id));

    const mixes: CuratedShelf[] = [
      buildShelf("mix-comfort", "Comfort Mix", "Your easy repeats and familiar artists.", "mix", [...comfortRecs, ...likedTracks]),
      buildShelf("mix-discovery", "Discovery Mix", "Less-played songs that still match your taste.", "mix", [...discoveryRecs, ...lowPlayRecommendations]),
      buildShelf("mix-bollywood", "Bollywood Mix", "Soundtrack-heavy picks tuned for your library.", "mix", [...bollywoodRecs, ...profileRecs]),
      buildShelf("mix-late-night", "Late Night Mix", "Softer late-hour picks based on your after-hours listening.", "mix", [
        ...lateNightRows.map((row) => trackMap.get(row.trackId)),
        ...comfortRecs,
        ...likedTracks
      ])
    ].filter((shelf) => shelf.tracks.length > 0);

    const autoPlaylists: CuratedShelf[] = [
      buildShelf("playlist-weekly-top", "Top Weekly", "Your heaviest rotation from the last 7 days.", "playlist", weeklyTopRows.map((row) => trackMap.get(row.trackId))),
      buildShelf("playlist-recently-loved", "Recently Loved", "Liked tracks, with the freshest ones up front.", "playlist", likedTracks),
      buildShelf("playlist-hidden-gems", "Hidden Gems", "Good fits that have barely had a chance yet.", "playlist", lowPlayRecommendations),
      buildShelf("playlist-cooling-off", "Cooling Off", "Songs you have been skipping lately, kept aside for now.", "playlist", skippedTracks)
    ].filter((shelf) => shelf.tracks.length > 0);

    const timeShelves: CuratedShelf[] = [
      buildShelf("time-morning", "Morning Run", "Built from what you play between breakfast and noon.", "time", [
        ...morningRows.map((row) => trackMap.get(row.trackId)),
        ...discoveryRecs
      ]),
      buildShelf("time-commute", "Commute Flow", "Steady momentum for your evening ride back.", "time", [
        ...commuteRows.map((row) => trackMap.get(row.trackId)),
        ...profileRecs
      ]),
      buildShelf("time-late-night", "Night Drift", "Slower repeats and night-session favorites.", "time", [
        ...lateNightRows.map((row) => trackMap.get(row.trackId)),
        ...comfortRecs
      ])
    ].filter((shelf) => shelf.tracks.length > 0);

    return {
      profile,
      dayKey,
      generatedAt: new Date().toISOString(),
      mixes,
      autoPlaylists,
      timeShelves
    };
  }

  private getWindowRows(startHour: number, endHour: number) {
    const rows = this.db.queryAll<HourCountRow>(
      `SELECT track_id AS trackId, COUNT(*) AS playCount
       FROM plays
       WHERE CAST(strftime('%H', played_at) AS INTEGER) BETWEEN ? AND ?
       GROUP BY track_id
       ORDER BY playCount DESC, MAX(played_at) DESC
       LIMIT 30`,
      [startHour, endHour]
    );
    return rows;
  }
}
