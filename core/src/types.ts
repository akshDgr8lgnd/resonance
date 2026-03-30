export type Track = {
  id: string;
  title: string;
  artists: string[];
  album: string | null;
  albumArtist: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number;
  filePath: string;
  coverPath: string | null;
  sourceUrl: string;
  youtubeVideoId: string | null;
  downloadedAt: string;
};

export type DeviceRecord = {
  id: string;
  name: string;
  platform: "desktop" | "android" | "ios" | "web" | "unknown";
  capabilities: string[];
  lastSeenAt: string;
};

export type TrackCopy = {
  trackId: string;
  deviceId: string;
  availability: "available" | "cached" | "missing";
  localPath: string | null;
  syncedAt: string;
  lastSeenAt: string;
};

export type DownloadJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  requestedByDeviceId: string | null;
  sourceQuery: string | null;
  videoId: string | null;
  title: string | null;
  artists: string[];
  trackId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  id: string;
  title: string;
  artists: string[];
  album?: string | null;
  albumArtist?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  duration: number;
  thumbnail: string | null;
  sourceUrl: string;
  videoId: string;
  kind: "track" | "album";
};

export type Playlist = {
  id: string;
  name: string;
  trackCount: number;
};

export type PlayRecord = {
  trackId: string;
  playedAt: string;
  durationPlayed: number;
};

export type CapsuleOverview = {
  totalListeningTime: number;
  weeklyListeningTime: number;
  topTracks: Array<{ trackId: string; title: string; playCount: number; totalTime: number }>;
  topArtists: Array<{ artist: string; playCount: number; totalTime: number }>;
  heatmap: Array<{ day: number; hour: number; count: number }>;
  longestStreakDays: number;
};

export type SessionState = {
  currentTrackId: string | null;
  sessionStartedAt: string | null;
  tracksPlayed: string[];
};

export type AppSettings = {
  apiToken: string;
  serverPort: number;
  desktopDeviceId: string;
};

export type PlaybackResolution =
  | {
      mode: "stream_desktop";
      track: Track;
      desktopDeviceId: string;
    }
  | {
      mode: "wait_for_desktop_download";
      job: DownloadJob;
    }
  | {
      mode: "download_on_android";
      query: string;
      videoId?: string | null;
      sourceUrl?: string | null;
    };

export type TrackFeedback = "like" | "skip" | "neutral";

export type RecommendedTrack = {
  track: Track;
  score: number;
  reasons: string[];
};

export type RecommenderProfile = "balanced" | "bollywood" | "discovery" | "comfort";

export type CuratedShelf = {
  id: string;
  title: string;
  subtitle: string;
  type: "mix" | "playlist" | "time";
  tracks: Track[];
};

export type DailyCurationBundle = {
  profile: RecommenderProfile;
  dayKey: string;
  generatedAt: string;
  mixes: CuratedShelf[];
  autoPlaylists: CuratedShelf[];
  timeShelves: CuratedShelf[];
};
