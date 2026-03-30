import type { AppDatabase } from "./db.js";
import type { LibraryService } from "./library.js";
import type { RecommendedTrack, RecommenderProfile, Track, TrackFeedback } from "./types.js";

type PlayAggregate = {
  trackId: string;
  playCount: number;
  totalPlayed: number;
  lastPlayedAt: string | null;
};

type FeedbackRow = {
  trackId: string;
  feedback: TrackFeedback;
};

type RecommenderWeights = {
  explicitLike: number;
  explicitSkip: number;
  playCount: number;
  completion: number;
  artistAffinity: number;
  albumAffinity: number;
  seedArtist: number;
  seedAlbum: number;
  titleOverlap: number;
  recentPenaltyShort: number;
  recentPenaltyDay: number;
  recentTrackPenalty: number;
};

const PROFILE_WEIGHTS: Record<RecommenderProfile, RecommenderWeights> = {
  balanced: {
    explicitLike: 5,
    explicitSkip: 4,
    playCount: 1.25,
    completion: 2,
    artistAffinity: 0.35,
    albumAffinity: 0.25,
    seedArtist: 1.1,
    seedAlbum: 0.9,
    titleOverlap: 0.25,
    recentPenaltyShort: 1.8,
    recentPenaltyDay: 0.6,
    recentTrackPenalty: 0.45
  },
  bollywood: {
    explicitLike: 5.8,
    explicitSkip: 4,
    playCount: 1.2,
    completion: 1.9,
    artistAffinity: 0.48,
    albumAffinity: 0.32,
    seedArtist: 1.35,
    seedAlbum: 1.15,
    titleOverlap: 0.35,
    recentPenaltyShort: 1.4,
    recentPenaltyDay: 0.45,
    recentTrackPenalty: 0.25
  },
  discovery: {
    explicitLike: 4.4,
    explicitSkip: 4.6,
    playCount: 0.95,
    completion: 1.55,
    artistAffinity: 0.22,
    albumAffinity: 0.12,
    seedArtist: 0.65,
    seedAlbum: 0.45,
    titleOverlap: 0.15,
    recentPenaltyShort: 0.9,
    recentPenaltyDay: 0.25,
    recentTrackPenalty: 0.1
  },
  comfort: {
    explicitLike: 6,
    explicitSkip: 4.2,
    playCount: 1.45,
    completion: 2.35,
    artistAffinity: 0.5,
    albumAffinity: 0.38,
    seedArtist: 1.45,
    seedAlbum: 1.2,
    titleOverlap: 0.25,
    recentPenaltyShort: 2.1,
    recentPenaltyDay: 0.9,
    recentTrackPenalty: 0.55
  }
};

const tokenize = (input: string | null | undefined) => {
  if (!input) return [] as string[];
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
};

const toHoursSince = (iso: string | null) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return Number.POSITIVE_INFINITY;
  return ms / (1000 * 60 * 60);
};

export class RecommendationService {
  constructor(
    private readonly db: AppDatabase,
    private readonly library: LibraryService
  ) {}

  setFeedback(trackId: string, feedback: TrackFeedback) {
    this.db.run(
      `INSERT INTO track_feedback (track_id, feedback, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(track_id) DO UPDATE SET feedback = excluded.feedback, updated_at = excluded.updated_at`,
      [trackId, feedback, new Date().toISOString()]
    );
  }

  getRecommendations(limit = 20, seedTrackId?: string, profile: RecommenderProfile = "balanced"): RecommendedTrack[] {
    const tracks = this.library.getTracks();
    if (!tracks.length) return [];

    const weights = PROFILE_WEIGHTS[profile] ?? PROFILE_WEIGHTS.balanced;
    const playRows = this.db.queryAll<PlayAggregate>(
      `SELECT track_id AS trackId,
              COUNT(*) AS playCount,
              COALESCE(SUM(duration_played), 0) AS totalPlayed,
              MAX(played_at) AS lastPlayedAt
       FROM plays
       GROUP BY track_id`
    );

    const feedbackRows = this.db.queryAll<FeedbackRow>(
      "SELECT track_id AS trackId, feedback FROM track_feedback"
    );

    const playsByTrack = new Map(playRows.map((row) => [row.trackId, row]));
    const feedbackByTrack = new Map(feedbackRows.map((row) => [row.trackId, row.feedback]));
    const seedTrack = seedTrackId ? tracks.find((track) => track.id === seedTrackId) : undefined;

    const artistAffinity = new Map<string, number>();
    const albumAffinity = new Map<string, number>();

    for (const track of tracks) {
      const play = playsByTrack.get(track.id);
      const feedback = feedbackByTrack.get(track.id);

      let affinity = 0;
      if (feedback === "like") affinity += 4;
      if (feedback === "skip") affinity -= 3;
      if (play) {
        const avgDuration = track.duration > 0 ? play.totalPlayed / Math.max(play.playCount, 1) : 0;
        const completion = track.duration > 0 ? Math.min(avgDuration / track.duration, 1.25) : 0;
        affinity += Math.log1p(play.playCount) * 1.35;
        affinity += (completion - 0.35) * 2;
      }

      if (affinity <= 0) continue;

      for (const artist of track.artists) {
        artistAffinity.set(artist, (artistAffinity.get(artist) ?? 0) + affinity);
      }

      if (track.album) {
        albumAffinity.set(track.album, (albumAffinity.get(track.album) ?? 0) + affinity * 0.65);
      }
    }

    const recentTrackIds = this.db
      .queryAll<{ trackId: string }>(
        `SELECT track_id AS trackId
         FROM plays
         ORDER BY played_at DESC
         LIMIT 50`
      )
      .map((row) => row.trackId);
    const recentlyPlayed = new Set(recentTrackIds);

    const seedArtists = new Set(seedTrack?.artists ?? []);
    const seedAlbum = seedTrack?.album ?? null;
    const seedTitleTokens = new Set(tokenize(seedTrack?.title));

    const scored = tracks
      .map((track) => {
        let score = 0;
        const reasons: string[] = [];

        const explicit = feedbackByTrack.get(track.id);
        if (explicit === "skip") {
          score -= weights.explicitSkip;
          reasons.push("Previously skipped");
        }
        if (explicit === "like") {
          score += weights.explicitLike;
          reasons.push("You liked this");
        }

        const play = playsByTrack.get(track.id);
        if (play) {
          const avgDuration = track.duration > 0 ? play.totalPlayed / Math.max(play.playCount, 1) : 0;
          const completion = track.duration > 0 ? Math.min(avgDuration / track.duration, 1.25) : 0;
          score += Math.log1p(play.playCount) * weights.playCount;
          score += (completion - 0.4) * weights.completion;
          if (play.playCount >= 2) reasons.push("You replay this often");

          const hoursSince = toHoursSince(play.lastPlayedAt);
          if (hoursSince < 4) score -= weights.recentPenaltyShort;
          else if (hoursSince < 24) score -= weights.recentPenaltyDay;
        }

        for (const artist of track.artists) {
          const affinity = artistAffinity.get(artist);
          if (affinity) score += Math.min(affinity * weights.artistAffinity, 3.9);
        }

        if (track.album) {
          const affinity = albumAffinity.get(track.album);
          if (affinity) score += Math.min(affinity * weights.albumAffinity, 2.6);
        }

        if (seedTrack && track.id !== seedTrack.id) {
          if (track.artists.some((artist) => seedArtists.has(artist))) {
            score += weights.seedArtist;
            reasons.push("Similar artist");
          }
          if (seedAlbum && track.album && track.album === seedAlbum) {
            score += weights.seedAlbum;
            reasons.push("From the same album");
          }

          const overlap = tokenize(track.title).filter((token) => seedTitleTokens.has(token)).length;
          if (overlap > 0) score += Math.min(overlap * weights.titleOverlap, 0.9);
        }

        if (recentlyPlayed.has(track.id)) score -= weights.recentTrackPenalty;

        return { track, score, reasons } satisfies RecommendedTrack;
      })
      .filter((item) => item.track.filePath && item.score > -2)
      .sort((a, b) => b.score - a.score || a.track.title.localeCompare(b.track.title));

    const uniqueByTitleArtist = new Set<string>();
    const deduped: RecommendedTrack[] = [];
    for (const item of scored) {
      const signature = `${item.track.title.toLowerCase()}::${item.track.artists.join(",").toLowerCase()}`;
      if (uniqueByTitleArtist.has(signature)) continue;
      uniqueByTitleArtist.add(signature);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }

    return deduped;
  }
}
