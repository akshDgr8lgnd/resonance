import type { AppDatabase } from "./db.js";
import type { CapsuleOverview, PlayRecord, SessionState, Track } from "./types.js";

export class CapsuleService {
  private session: SessionState = {
    currentTrackId: null,
    sessionStartedAt: null,
    tracksPlayed: []
  };

  constructor(private readonly db: AppDatabase) {}

  beginSession(trackId: string) {
    if (!this.session.sessionStartedAt) {
      this.session.sessionStartedAt = new Date().toISOString();
    }

    this.session.currentTrackId = trackId;
    if (!this.session.tracksPlayed.includes(trackId)) {
      this.session.tracksPlayed.push(trackId);
    }
  }

  recordPlay(play: PlayRecord) {
    this.db.run("INSERT INTO plays (track_id, played_at, duration_played) VALUES (?, ?, ?)", [play.trackId, play.playedAt, play.durationPlayed]);
  }

  getLiveSession() {
    return this.session;
  }

  getHistory(): CapsuleOverview {
    const totalListeningTime = this.db.queryOne<{ total: number }>("SELECT COALESCE(SUM(duration_played), 0) AS total FROM plays") ?? { total: 0 };
    const weeklyListeningTime =
      this.db.queryOne<{ total: number }>("SELECT COALESCE(SUM(duration_played), 0) AS total FROM plays WHERE played_at >= datetime('now', '-7 day')") ??
      { total: 0 };

    const topTracks = this.db.queryAll<CapsuleOverview["topTracks"][number]>(
      `SELECT plays.track_id AS trackId, tracks.title, COUNT(*) AS playCount, SUM(duration_played) AS totalTime
       FROM plays JOIN tracks ON tracks.id = plays.track_id
       GROUP BY plays.track_id
       ORDER BY totalTime DESC
       LIMIT 5`
    );

    const topArtistRows = this.db.queryAll<{ artists: string; playCount: number; totalTime: number }>(
      `SELECT tracks.artists AS artists, COUNT(*) AS playCount, SUM(duration_played) AS totalTime
       FROM plays JOIN tracks ON tracks.id = plays.track_id
       GROUP BY plays.track_id`
    );

    const artistMap = new Map<string, { playCount: number; totalTime: number }>();
    topArtistRows.forEach((row) => {
      JSON.parse(row.artists).forEach((artist: string) => {
        const current = artistMap.get(artist) ?? { playCount: 0, totalTime: 0 };
        current.playCount += row.playCount;
        current.totalTime += row.totalTime;
        artistMap.set(artist, current);
      });
    });

    const topArtists = [...artistMap.entries()]
      .map(([artist, values]) => ({ artist, ...values }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5);

    const heatmap = this.db.queryAll<CapsuleOverview["heatmap"][number]>(
      `SELECT CAST(strftime('%w', played_at) AS INTEGER) AS day,
              CAST(strftime('%H', played_at) AS INTEGER) AS hour,
              COUNT(*) AS count
       FROM plays
       GROUP BY day, hour`
    );

    const listeningDays = this.db.queryAll<{ day: string }>("SELECT DISTINCT date(played_at) AS day FROM plays ORDER BY day ASC");
    let longestStreakDays = 0;
    let currentStreak = 0;
    let previousDay: number | null = null;

    listeningDays.forEach(({ day }) => {
      const currentDay = Date.parse(`${day}T00:00:00Z`);
      if (previousDay === null) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((currentDay - previousDay) / (1000 * 60 * 60 * 24));
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      }
      previousDay = currentDay;
      longestStreakDays = Math.max(longestStreakDays, currentStreak);
    });

    return {
      totalListeningTime: totalListeningTime.total,
      weeklyListeningTime: weeklyListeningTime.total,
      topTracks,
      topArtists,
      heatmap,
      longestStreakDays
    };
  }

  buildLiveChip(track: Track | undefined) {
    if (!track || !this.session.sessionStartedAt) {
      return null;
    }

    return {
      label: "Now in session",
      trackTitle: track.title,
      artists: track.artists.join(", "),
      startedAt: this.session.sessionStartedAt,
      tracksPlayed: this.session.tracksPlayed.length
    };
  }
}
