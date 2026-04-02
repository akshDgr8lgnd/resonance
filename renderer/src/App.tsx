import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import resonanceMark from "./assets/logo.svg";
import { usePlayerStore } from "./store";
import "./styles.css";
import {
  Home,
  Search,
  Library,
  History,
  Settings,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  Volume2,
  ListMusic,
  Maximize,
  Minimize2,
  Download,
  Trash2,
  MoreVertical,
  Disc,
  Mic2
} from "lucide-react";

// Lucide icons are used instead of manual SVG objects.

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};


type Track = {
  id: string;
  title: string;
  artists: string[];
  album: string | null;
  albumArtist?: string | null;
  duration: number;
  coverPath: string | null;
  filePath: string;
  youtubeVideoId?: string;
};

type AlbumSummary = {
  id: string;
  name: string;
  artist: string;
  coverPath: string | null;
  trackCount: number;
  totalDuration: number;
  tracks: Track[];
};

type ArtistSummary = {
  id: string;
  name: string;
  coverPath: string | null;
  trackCount: number;
  totalDuration: number;
  tracks: Track[];
};

type CollectionSummary = {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
  tracks: Track[];
};

type LibraryPayload = {
  tracks: Track[];
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  liveSession: { currentTrackId: string | null; sessionStartedAt: string | null; tracksPlayed: string[] };
};

type SearchResult = {
  id: string;
  title: string;
  artists: string[];
  album?: string | null;
  albumArtist?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  duration: number;
  thumbnail: string | null;
  videoId: string;
};

type DownloadResponse = {
  ok: boolean;
  error?: string;
};

type RecommendationProfile = "balanced" | "bollywood" | "discovery" | "comfort";

type RecommendationEntry = {
  track: Track;
  score: number;
  reasons: string[];
};

type CuratedShelf = {
  id: string;
  title: string;
  subtitle: string;
  type: "mix" | "playlist" | "time";
  tracks: Track[];
};

type DailyCurationBundle = {
  profile: RecommendationProfile;
  dayKey: string;
  generatedAt: string;
  mixes: CuratedShelf[];
  autoPlaylists: CuratedShelf[];
  timeShelves: CuratedShelf[];
};

type LyricsResponse = {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
};

type LyricLine = {
  time: number;
  text: string;
};

type PlaybackSnapshot = {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
};

type PlaybackCommand = "toggle-play" | "next" | "previous" | "show-main";

type ShelfCardItem = {
  id: string;
  name: string;
  subtitle: string;
  coverPath: string | null;
  tracks: Track[];
  badge?: string;
};

type SearchAlbumSummary = {
  id: string;
  name: string;
  artist: string;
  coverPath: string | null;
  tracks: SearchResult[];
  totalDuration: number;
};

const formatDuration = (seconds: number) => {
  if (!seconds) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatRuntime = (seconds: number) => {
  if (!seconds) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
};

const isMiniMode = new URLSearchParams(window.location.search).get("mini") === "1";

const parseSyncedLyrics = (value: string | null | undefined): LyricLine[] => {
  if (!value) return [];

  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const matches = [...line.matchAll(/\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g)];
      const text = line.replace(/\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g, "").trim();
      if (!matches.length || !text) return [];
      return matches.map((match) => {
        const minutes = Number(match[1] ?? 0);
        const seconds = Number(match[2] ?? 0);
        const fractionRaw = match[3] ?? "0";
        const fraction = fractionRaw.length === 3 ? Number(fractionRaw) / 1000 : Number(fractionRaw) / 100;
        return { time: minutes * 60 + seconds + fraction, text };
      });
    })
    .sort((a, b) => a.time - b.time);
};

const toAssetSrc = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("file://")) {
    return value;
  }
  const normalizedPath = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const encoded = normalizedPath.split("/").map((seg, i) => {
    if (i === 0 && seg.endsWith(":")) return seg; // avoid encoding Windows drive letter C:
    return encodeURIComponent(seg);
  });
  return `file:///${encoded.join("/")}`;
};

const normalizeText = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const matchesLibraryTrack = (track: Track, candidate: { title: string; artists: string[]; album?: string | null; videoId?: string | null }) => {
  if (candidate.videoId && track.youtubeVideoId && track.youtubeVideoId === candidate.videoId) return true;

  const titleA = normalizeText(track.title);
  const titleB = normalizeText(candidate.title);
  const albumA = normalizeText(track.album);
  const albumB = normalizeText(candidate.album);
  const artistSet = new Set(track.artists.map(normalizeText));
  const artistOverlap = candidate.artists.map(normalizeText).filter((artist) => artistSet.has(artist)).length;

  if (titleA && titleA === titleB && artistOverlap > 0) {
    if (!albumB || !albumA || albumA === albumB) return true;
  }

  return false;
};

const Artwork = ({
  src,
  alt,
  size = "md",
  round = false,
  className = ""
}: {
  src: string | null | undefined;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg";
  round?: boolean;
  className?: string;
}) => {
  const resolved = toAssetSrc(src);
  const classes = `${resolved ? "cover-thumb" : "cover-orb"} cover-${size}${round ? " round" : ""}${className ? ` ${className}` : ""}`;
  return resolved ? <img className={classes} src={resolved} alt={alt} /> : <div className={classes} />;
};

const normalizeAlbumGroup = (name: string) => {
  return name.replace(/\s*[\[\(].*?(Edition|Soundtrack|Version|Remaster).*?[\]\)]/gi, "").trim();
};

const buildAlbums = (tracks: Track[]): AlbumSummary[] => {
  const map = new Map<string, AlbumSummary>();
  tracks.forEach((track) => {
    const rawAlbumName = track.album || "Singles";
    const albumName = normalizeAlbumGroup(rawAlbumName);
    const albumArtist = track.albumArtist || track.artists[0] || "Unknown Artist";
    const key = albumName;
    const existing = map.get(key);
    if (existing) {
      existing.trackCount += 1;
      existing.totalDuration += track.duration;
      existing.tracks.push(track);
      if (!existing.coverPath && track.coverPath) existing.coverPath = track.coverPath;
      if (existing.artist === "Unknown Artist" && albumArtist !== "Unknown Artist") {
        existing.artist = albumArtist;
      }
      return;
    }
    map.set(key, { id: key, name: albumName, artist: albumArtist, coverPath: track.coverPath, trackCount: 1, totalDuration: track.duration, tracks: [track] });
  });
  return [...map.values()].sort((a, b) => b.tracks[0]!.id.localeCompare(a.tracks[0]!.id));
};

const buildArtists = (tracks: Track[]): ArtistSummary[] => {
  const map = new Map<string, ArtistSummary>();
  tracks.forEach((track) => {
    track.artists.forEach((artistName) => {
      const existing = map.get(artistName);
      if (existing) {
        existing.trackCount += 1;
        existing.totalDuration += track.duration;
        existing.tracks.push(track);
        if (!existing.coverPath && track.coverPath) existing.coverPath = track.coverPath;
        return;
      }
      map.set(artistName, { id: artistName, name: artistName, coverPath: track.coverPath, trackCount: 1, totalDuration: track.duration, tracks: [track] });
    });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const PlaylistTracksView = ({ 
  playlistId, 
  currentTrackId, 
  onPlay,
  onStartRadio,
  onHideFromRecommendations 
}: { 
  playlistId: string; 
  currentTrackId: string | null; 
  onPlay: (track: Track, tracks: Track[]) => void; 
  onStartRadio?: (track: Track) => void;
  onHideFromRecommendations?: (track: Track) => void;
}) => {
  const query = useQuery<Track[]>({
    queryKey: ["playlist-tracks", playlistId],
    queryFn: async () => {
      return window.resonance.getPlaylistTracks(playlistId);
    }
  });

  return <TrackTable tracks={query.data ?? []} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />;
};

const buildCollections = (tracks: Track[], albums: AlbumSummary[], artists: ArtistSummary[]): CollectionSummary[] => {
  const collections: CollectionSummary[] = [];
  const liked = tracks.slice(0, Math.min(tracks.length, 12));
  if (liked.length) {
    collections.push({ id: "liked", name: "Liked Songs", subtitle: `${liked.length} saved tracks`, coverPath: liked[0]?.coverPath ?? null, tracks: liked });
  }
  albums.slice(0, 4).forEach((album) => collections.push({ id: `album:${album.id}`, name: album.name, subtitle: album.artist, coverPath: album.coverPath, tracks: album.tracks }));
  artists.slice(0, 3).forEach((artist) => collections.push({ id: `artist:${artist.id}`, name: artist.name, subtitle: `${artist.trackCount} songs`, coverPath: artist.coverPath, tracks: artist.tracks }));
  return collections;
};

const RECOMMENDATION_PROFILE_STORAGE_KEY = "resonance.recommendation-profile";
const PINNED_SHELVES_STORAGE_KEY = "resonance.pinned-shelves";
const HIDDEN_TRACKS_STORAGE_KEY = "resonance.hidden-tracks";

const PROFILE_OPTIONS: Array<{ id: RecommendationProfile; title: string; blurb: string; accent: string }> = [
  { id: "balanced", title: "Balanced", blurb: "A mix of favorites and fresh picks.", accent: "Steady mix" },
  { id: "bollywood", title: "Bollywood Focus", blurb: "Lean harder into soundtrack artists, albums, and familiar voices.", accent: "Hindi-first" },
  { id: "discovery", title: "Discovery", blurb: "Push for newer and less repeated tracks.", accent: "Find new songs" },
  { id: "comfort", title: "Comfort Zone", blurb: "Stay close to your repeats, top artists, and albums.", accent: "Play safe" }
];

const StartingScreen = ({
  onSelect
}: {
  onSelect: (profile: RecommendationProfile) => void;
}) => {
  return (
    <div className="starting-shell">
      <div className="starting-panel">
        <div className="starting-copy">
          <span className="eyebrow">Tune Resonance</span>
          <h1>Pick how your recommendations should feel.</h1>
          <p>This only shows once. Your choice tunes the recommendation weights for autoplay, home suggestions, and what gets pulled in next.</p>
        </div>
        <div className="starting-grid">
          {PROFILE_OPTIONS.map((option) => (
            <button key={option.id} className="starting-card" onClick={() => onSelect(option.id)}>
              <span className="starting-chip">{option.accent}</span>
              <strong>{option.title}</strong>
              <p>{option.blurb}</p>
              <span className="starting-action">Use this mode</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const getShelfBadge = (shelf: CuratedShelf) => {
  if (shelf.id.includes("discovery") || shelf.id.includes("hidden-gems")) return "Fresh";
  if (shelf.id.includes("late-night") || shelf.id.includes("night")) return "Night";
  if (shelf.id.includes("bollywood")) return "Bollywood";
  if (shelf.id.includes("weekly") || shelf.id.includes("comfort")) return "Repeat";
  return shelf.type === "time" ? "Mood" : shelf.type === "playlist" ? "Auto" : "Mix";
};

const escapeSvgText = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getShelfPalette = (shelf: CuratedShelf) => {
  if (shelf.id.includes("bollywood")) {
    return { background: "#1a0f08", start: "#f18f01", end: "#c73e1d", glow: "#ffd166", accent: "#ffecd1" };
  }
  if (shelf.id.includes("late-night") || shelf.id.includes("night")) {
    return { background: "#08111f", start: "#355c7d", end: "#6c5b7b", glow: "#6be3ff", accent: "#e3f5ff" };
  }
  if (shelf.id.includes("discovery") || shelf.id.includes("hidden-gems")) {
    return { background: "#071b16", start: "#1fab89", end: "#62d2a2", glow: "#d4ffe8", accent: "#effff7" };
  }
  if (shelf.id.includes("weekly") || shelf.id.includes("comfort")) {
    return { background: "#170c22", start: "#7b2cbf", end: "#c77dff", glow: "#f1ddff", accent: "#fcf4ff" };
  }
  if (shelf.type === "time") {
    return { background: "#0d1722", start: "#118ab2", end: "#06d6a0", glow: "#d7fff6", accent: "#ecfeff" };
  }
  if (shelf.type === "playlist") {
    return { background: "#171411", start: "#ef476f", end: "#ff7b54", glow: "#ffe4d6", accent: "#fff5f0" };
  }
  return { background: "#0b111d", start: "#4f46e5", end: "#2dd4bf", glow: "#dffcff", accent: "#eff6ff" };
};

const buildShelfCover = (shelf: CuratedShelf) => {
  const palette = getShelfPalette(shelf);
  const badge = getShelfBadge(shelf).toUpperCase();
  const lines = shelf.title.split(/\s+/).reduce<string[]>((acc, word) => {
    if (!acc.length) return [word];
    const nextLine = `${acc[acc.length - 1]} ${word}`;
    if (nextLine.length <= 14 && acc.length < 3) {
      acc[acc.length - 1] = nextLine;
      return acc;
    }
    if (acc.length < 3) acc.push(word);
    return acc;
  }, []);
  const artistHints = Array.from(new Set(shelf.tracks.flatMap((track) => track.artists).filter(Boolean))).slice(0, 2).join(" / ");
  const lineMarkup = lines
    .slice(0, 3)
    .map(
      (line, index) =>
        `<text x="82" y="${432 + index * 92}" font-size="76" font-weight="800" fill="${palette.accent}" font-family="Georgia, 'Times New Roman', serif">${escapeSvgText(line)}</text>`
    )
    .join("");
  const footer = artistHints || shelf.subtitle;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${escapeSvgText(shelf.title)} cover art"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.start}"/><stop offset="100%" stop-color="${palette.end}"/></linearGradient><linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(6,10,18,0.06)"/><stop offset="100%" stop-color="rgba(6,10,18,0.52)"/></linearGradient><radialGradient id="glow" cx="80%" cy="18%" r="34%"><stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.95"/><stop offset="100%" stop-color="${palette.glow}" stop-opacity="0"/></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="22"/></filter></defs><rect width="800" height="800" rx="54" fill="${palette.background}"/><rect x="30" y="30" width="740" height="740" rx="42" fill="url(#bg)"/><rect x="30" y="30" width="740" height="740" rx="42" fill="url(#veil)"/><circle cx="614" cy="164" r="138" fill="url(#glow)" filter="url(#soft)"/><rect x="82" y="82" width="636" height="636" rx="34" fill="rgba(9,14,24,0.14)" stroke="rgba(255,255,255,0.12)"/><path d="M82 246C184 198 286 188 398 196C514 204 616 182 718 126V254C608 308 510 326 390 320C280 314 182 334 82 390V246Z" fill="rgba(8,12,20,0.18)"/><path d="M82 556C176 516 272 510 382 518C498 526 596 564 718 536V718H82V556Z" fill="rgba(8,12,20,0.24)"/><line x1="82" y1="150" x2="718" y2="150" stroke="rgba(255,255,255,0.14)"/><text x="82" y="132" font-size="22" font-weight="700" fill="${palette.accent}" opacity="0.82" letter-spacing="6" font-family="'Segoe UI', Arial, sans-serif">${escapeSvgText(badge)}</text>${lineMarkup}<text x="82" y="678" font-size="24" font-weight="600" fill="${palette.accent}" opacity="0.84" font-family="'Segoe UI', Arial, sans-serif">${escapeSvgText(footer)}</text><text x="82" y="715" font-size="18" font-weight="600" fill="${palette.accent}" opacity="0.46" letter-spacing="4" font-family="'Segoe UI', Arial, sans-serif">RESONANCE CURATED</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
const shelfToCardItems = (shelves: CuratedShelf[]): ShelfCardItem[] => shelves.map((shelf) => ({
  id: shelf.id,
  name: shelf.title,
  subtitle: shelf.subtitle,
  coverPath: buildShelfCover(shelf),
  tracks: shelf.tracks,
  badge: getShelfBadge(shelf)
}));

const buildSearchAlbums = (results: SearchResult[]): SearchAlbumSummary[] => {
  const map = new Map<string, SearchAlbumSummary>();
  results.forEach((result) => {
    if (!result.album) return;
    const key = result.album;
    const artist = result.albumArtist || result.artists[0] || "Unknown Artist";
    const existing = map.get(key);
    if (existing) {
      existing.tracks.push(result);
      existing.totalDuration += result.duration;
      if (!existing.coverPath && result.thumbnail) existing.coverPath = result.thumbnail;
      return;
    }
    map.set(key, {
      id: key,
      name: result.album,
      artist,
      coverPath: result.thumbnail,
      tracks: [result],
      totalDuration: result.duration
    });
  });
  return [...map.values()].sort((a, b) => b.tracks.length - a.tracks.length || a.name.localeCompare(b.name));
};

const SectionShelf = ({
  title,
  items,
  onPlay,
  roundArtists = false,
  pinnedIds,
  onTogglePin
}: {
  title: string;
  items: ShelfCardItem[];
  onPlay: (track: Track, sourceTracks: Track[]) => void;
  roundArtists?: boolean;
  pinnedIds?: Set<string>;
  onTogglePin?: (item: ShelfCardItem) => void;
}) => {
  const navigate = useNavigate();
  return (
    <section className="spotify-section">
      <div className="section-header">
        <h2>{title}</h2>
        <button className="link-button">Show all</button>
      </div>
      <div className="card-shelf">
        {items.map((item) => (
          <button
            key={item.id}
            className="media-card"
            onClick={() => {
              if (item.id.startsWith("album:")) {
                navigate(`/library?tab=albums&album=${item.id.replace("album:", "")}`);
              } else if (item.id.startsWith("artist:")) {
                navigate(`/library?tab=artists&artist=${item.id.replace("artist:", "")}`);
              } else {
                item.tracks[0] && onPlay(item.tracks[0], item.tracks);
              }
            }}
          >
            {(onTogglePin || item.badge) && (
              <div className="media-card-top">
                {onTogglePin ? (
                  <button
                    className={pinnedIds?.has(item.id) ? "pin-button active" : "pin-button"}
                    type="button"
                    title={pinnedIds?.has(item.id) ? "Unpin mix" : "Pin this mix"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePin(item);
                    }}
                  >
                    {pinnedIds?.has(item.id) ? "Pinned" : "Pin"}
                  </button>
                ) : (
                  <span />
                )}
                {item.badge && <span className="media-badge">{item.badge}</span>}
              </div>
            )}
            <Artwork src={item.coverPath} alt={item.name} size="lg" round={roundArtists} />
            <div className="media-card-copy">
              <strong>{item.name}</strong>
              <span>{item.subtitle}</span>
            </div>
            <div className="play-fab"><Play size={20} fill="currentColor" /></div>
          </button>
        ))}
      </div>
    </section>
  );
};
const Sidebar = ({ 
  collections, 
  albums,
  artists,
  playlists,
  pinnedShelves,
  currentTrackId, 
  onPlay,
  onCreatePlaylist
}: { 
  collections: CollectionSummary[]; 
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  pinnedShelves: ShelfCardItem[];
  currentTrackId: string | null; 
  onPlay: (track: Track, tracks: Track[]) => void; 
  onCreatePlaylist: () => void;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
}) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<"all" | "playlists" | "albums" | "artists" | "pinned">("all");

  const sidebarItems = useMemo(() => {
    const items: Array<{ id: string; name: string; subtitle: string; coverPath: string | null; tracks: Track[]; type: "album" | "artist" | "playlist" | "liked" | "pinned" }> = [];
    
    if (activeFilter === "all" || activeFilter === "playlists") {
      items.push(...playlists.map(p => ({ id: p.id, name: p.name, subtitle: `Playlist • ${p.trackCount} songs`, coverPath: null, tracks: [], type: "playlist" as const })));
    }
    
    if (activeFilter === "all" || activeFilter === "albums") {
      // In "all" view, we use the limited collections for a cleaner look, but in "albums" view we show everything.
      const source = activeFilter === "albums" ? albums : albums.slice(0, 8);
      items.push(...source.map(a => ({ id: a.id, name: a.name, subtitle: `Album • ${a.artist}`, coverPath: a.coverPath, tracks: a.tracks, type: "album" as const })));
    }

    if (activeFilter === "all" || activeFilter === "artists") {
      const source = activeFilter === "artists" ? artists : artists.slice(0, 8);
      items.push(...source.map(a => ({ id: a.id, name: a.name, subtitle: "Artist", coverPath: a.coverPath, tracks: a.tracks, type: "artist" as const })));
    }

    if (activeFilter === "all" || activeFilter === "pinned") {
      items.push(...pinnedShelves.map((item) => ({ id: item.id, name: item.name, subtitle: `Pinned mix`, coverPath: item.coverPath, tracks: item.tracks, type: "pinned" as const })));
    }

    return items;
  }, [activeFilter, playlists, albums, artists, pinnedShelves]);

  return (
    <aside className="sidebar-shell">
      <section className="nav-panel">
        <div className="brand-wrap">
          <img className="brand-mark" src={resonanceMark} alt="Resonance logo" />
          <div className="brand-text"><strong>Resonance</strong></div>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className="nav-link">
            {({ isActive }) => (
              <>
                {isActive ? <Home size={24} fill="currentColor" /> : <Home size={24} />}
                <span>Home</span>
              </>
            )}
          </NavLink>
          <NavLink to="/search" className="nav-link">
            {({ isActive }) => (
              <>
                <Search size={24} />
                <span>Search</span>
              </>
            )}
          </NavLink>
          <NavLink to="/library" className="nav-link">
            {({ isActive }) => (
              <>
                <Library size={24} />
                <span>Your Library</span>
              </>
            )}
          </NavLink>
          <NavLink to="/radio" className="nav-link">
            {({ isActive }) => (
              <>
                <ListMusic size={24} />
                <span>Radio</span>
              </>
            )}
          </NavLink>
          <NavLink to="/capsule" className="nav-link">
            {({ isActive }) => (
              <>
                <History size={24} />
                <span>Sound Capsule</span>
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className="nav-link">
            {({ isActive }) => (
              <>
                <Settings size={24} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </nav>
      </section>
      <section className="library-panel">
        <div className="library-head">
          <div className="library-head-left">
            <Library size={24} />
            <span>Your Library</span>
          </div>
          <div className="library-head-right">
            <button className="circle-button small" title="Create playlist" onClick={onCreatePlaylist}><Plus size={16} /></button>
            <button className="circle-button small" title="Expand"><ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="library-filter-row">
          <button 
            className={activeFilter === "all" ? "filter-pill active" : "filter-pill"} 
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          <button 
            className={activeFilter === "playlists" ? "filter-pill active" : "filter-pill"} 
            onClick={() => setActiveFilter("playlists")}
          >
            Playlists
          </button>
          <button 
            className={activeFilter === "albums" ? "filter-pill active" : "filter-pill"} 
            onClick={() => setActiveFilter("albums")}
          >
            Albums
          </button>
          <button 
            className={activeFilter === "artists" ? "filter-pill active" : "filter-pill"} 
            onClick={() => setActiveFilter("artists")}
          >
            Artists
          </button>
          <button 
            className={activeFilter === "pinned" ? "filter-pill active" : "filter-pill"} 
            onClick={() => setActiveFilter("pinned")}
          >
            Pinned
          </button>
        </div>
        <div className="collection-list">
          {sidebarItems.length > 0 ? (
            sidebarItems.map((item) => {
              const isActive = currentTrackId ? item.tracks.some((track) => track.id === currentTrackId) : false;
              const isPlaylist = item.type === "playlist";
              
              return (
                <button 
                  key={`${item.type}-${item.id}`} 
                  className={isActive ? "collection-row active" : "collection-row"} 
                  onClick={() => {
                    if (isPlaylist) navigate(`/library?tab=playlists&playlist=${item.id}`);
                    else if (item.type === "album") navigate(`/library?tab=albums&album=${encodeURIComponent(item.id)}`);
                    else if (item.type === "artist") navigate(`/library?tab=artists&artist=${encodeURIComponent(item.id)}`);
                    else if (item.type === "pinned") item.tracks[0] && onPlay(item.tracks[0], item.tracks);
                  }}
                  title={`Click to open ${item.type}`}
                >
                  {item.coverPath ? (
                    <Artwork src={item.coverPath} alt={item.name} size="sm" round={item.type === "artist"} />
                  ) : (
                    <div className={item.type === "artist" ? "artwork-placeholder sm round" : "artwork-placeholder sm"}><History size={20} /></div>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                </button>
              );
            })
          ) : <div className="empty-card slim">No matching items found.</div>}
        </div>
      </section>
    </aside>
  );
};

const MainHeader = ({ title, subtitle }: { title: string; subtitle: string }) => {
  const navigate = useNavigate();
  return (
    <header className="main-header">
      <div className="header-controls">
        <button className="circle-button" onClick={() => navigate(-1)} title="Back"><ChevronLeft size={16} /></button>
        <button className="circle-button" onClick={() => navigate(1)} title="Forward"><ChevronRight size={16} /></button>
      </div>
    </header>
  );
};

const TrackTable = ({
  tracks,
  currentTrackId,
  onPlay,
  onAddToPlaylist,
  onStartRadio,
  onHideFromRecommendations,
  reasonByTrackId
}: {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (track: Track, sourceTracks: Track[]) => void;
  onAddToPlaylist?: (track: Track) => void;
  onStartRadio?: (track: Track) => void;
  onHideFromRecommendations?: (track: Track) => void;
  reasonByTrackId?: Record<string, string>;
}) => {
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
  <div className="track-table">
    <div className="track-table-head">
      <span>#</span>
      <span>Title</span>
      <span>Album</span>
      <span style={{ textAlign: 'right' }}>Duration</span>
      {(onAddToPlaylist || onStartRadio || onHideFromRecommendations) && <span style={{ textAlign: 'right' }}></span>}
    </div>
    {tracks.slice(0, 500).map((track, index) => (
      <div key={track.id} className="track-row-shell">
        <button className={currentTrackId === track.id ? "track-table-row active" : "track-table-row"} onClick={() => onPlay(track, tracks)}>
          <div className="track-index-cell">
            <span className="track-index-num">{index + 1}</span>
            <span className="track-index-icon">
              {currentTrackId === track.id ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </span>
          </div>
          <div className="track-main">
            <Artwork src={track.coverPath} alt={track.title} size="sm" />
            <div>
              <strong>{track.title}</strong>
              <span>{track.artists.join(", ")}</span>
              {reasonByTrackId?.[track.id] && <em className="track-reason">{reasonByTrackId[track.id]}</em>}
            </div>
          </div>
          <span className="track-album-name">{track.album ?? "Single"}</span>
          <span className="track-duration">{formatDuration(track.duration)}</span>
          {(onAddToPlaylist || onStartRadio || onHideFromRecommendations) && (
            <div className="track-actions-cell">
              <button
                className="circle-button small tertiary"
                onClick={(e) => { e.stopPropagation(); setMenuTrackId(menuTrackId === track.id ? null : track.id); }}
                title="More actions"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          )}
        </button>
        {menuTrackId === track.id && (
          <div className="track-context-menu" onClick={(e) => e.stopPropagation()}>
            {onStartRadio && (
              <button onClick={() => { onStartRadio(track); setMenuTrackId(null); }}>
                <ListMusic size={14} /> Start Radio
              </button>
            )}
            {onAddToPlaylist && (
              <button onClick={() => { onAddToPlaylist(track); setMenuTrackId(null); }}>
                <Plus size={14} /> Add to Playlist
              </button>
            )}
            {onHideFromRecommendations && (
              <button onClick={() => { onHideFromRecommendations(track); setMenuTrackId(null); }}>
                <Trash2 size={14} /> Hide from Recommendations
              </button>
            )}
            <button onClick={() => { navigate(`/library?tab=albums&album=${encodeURIComponent(track.album || "Single")}`); setMenuTrackId(null); }}>
              <Disc size={14} /> Go to Album
            </button>
            <button onClick={() => { navigate(`/library?tab=artists&artist=${encodeURIComponent(track.artists[0]!)}`); setMenuTrackId(null); }}>
              <Mic2 size={14} /> Go to Artist
            </button>
          </div>
        )}
      </div>
    ))}
    {tracks.length > 500 && <div className="table-footer-info">Showing first 500 of {tracks.length} songs. Search or filter to find specific tracks.</div>}
  </div>
  );
};
const QueueDrawerList = ({
  queue,
  currentTrackId,
  onPlay,
  onReorder,
  onStartRadio,
  onHideFromRecommendations
}: {
  queue: Track[];
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
  onReorder: (nextQueue: Track[]) => void;
  onStartRadio: (track: Track) => void;
  onHideFromRecommendations: (track: Track) => void;
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveTrack = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    const next = [...queue];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <div className="queue-drawer-list">
      {queue.map((track, index) => (
        <div
          key={`${track.id}-${index}`}
          className={currentTrackId === track.id ? "queue-row active" : "queue-row"}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex === null) return;
            moveTrack(dragIndex, index);
            setDragIndex(null);
          }}
          onDragEnd={() => setDragIndex(null)}
        >
          <button className="queue-row-main" onClick={() => onPlay(track, queue)}>
            <span className="queue-row-index">{index + 1}</span>
            <Artwork src={track.coverPath} alt={track.title} size="sm" />
            <div className="queue-row-meta">
              <strong>{track.title}</strong>
              <span>{track.artists.join(", ")}</span>
            </div>
            <span className="queue-row-duration">{formatDuration(track.duration)}</span>
          </button>
          <div className="queue-row-actions">
            <button className="circle-button small tertiary" title="Move up" onClick={() => moveTrack(index, Math.max(0, index - 1))}><ChevronLeft size={14} /></button>
            <button className="circle-button small tertiary" title="Move down" onClick={() => moveTrack(index, Math.min(queue.length - 1, index + 1))}><ChevronRight size={14} /></button>
            <button className="circle-button small tertiary" title="Start radio" onClick={() => onStartRadio(track)}><ListMusic size={14} /></button>
            <button className="circle-button small tertiary" title="Hide from recommendations" onClick={() => onHideFromRecommendations(track)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
};
const HomePage = ({
  library,
  albums,
  artists,
  playlists,
  collections,
  recommendations,
  curation,
  pinnedShelves,
  currentTrackId,
  onPlay,
  onStartRadio,
  onHideFromRecommendations,
  onTogglePin
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  collections: CollectionSummary[];
  recommendations: RecommendationEntry[];
  curation: DailyCurationBundle | undefined;
  pinnedShelves: ShelfCardItem[];
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
  onStartRadio: (track: Track) => void;
  onHideFromRecommendations: (track: Track) => void;
  onTogglePin: (item: ShelfCardItem) => void;
}) => {
  const navigate = useNavigate();
  const recommendationReasons = Object.fromEntries(recommendations.map((entry) => [entry.track.id, entry.reasons[0] ?? "Fits your recent listening"]));
  const pinnedIds = new Set(pinnedShelves.map((item) => item.id));

  return (
  <div className="page-stack">
    <section className="hero-banner">
      <div className="hero-banner-copy">
        <span className="eyebrow">Resonance mix</span>
        <h1>Bring your library to life.</h1>
        <p>Play albums, jump between artists, and keep your desktop library feeling like a premium streaming app.</p>
        <div className="hero-actions">
          <button className="primary-hero-button" onClick={() => collections[0]?.tracks[0] && onPlay(collections[0].tracks[0], collections[0].tracks)}>Play</button>
          <button className="secondary-hero-button" onClick={() => curation?.mixes[0]?.tracks[0] && onPlay(curation.mixes[0].tracks[0], curation.mixes[0].tracks)}>Start mix</button>
        </div>
      </div>
      <div className="hero-banner-stats">
        <div><strong>{library?.tracks.length ?? 0}</strong><span>songs</span></div>
        <div><strong>{albums.length}</strong><span>albums</span></div>
        <div><strong>{artists.length}</strong><span>artists</span></div>
      </div>
    </section>

    {pinnedShelves.length > 0 && (
      <SectionShelf
        title="Pinned Mixes"
        items={pinnedShelves}
        onPlay={onPlay}
        pinnedIds={pinnedIds}
        onTogglePin={onTogglePin}
      />
    )}

    <section className="quick-grid">
      {collections.slice(0, 6).map((collection) => (
        <button key={collection.id} className="quick-card" onClick={() => collection.tracks[0] && onPlay(collection.tracks[0], collection.tracks)}>
          <Artwork src={collection.coverPath} alt={collection.name} size="sm" />
          <strong>{collection.name}</strong>
        </button>
      ))}
    </section>

    <SectionShelf
      title="Weekly Mixes"
      items={shelfToCardItems(curation?.mixes ?? [])}
      onPlay={onPlay}
      pinnedIds={pinnedIds}
      onTogglePin={onTogglePin}
    />

    <SectionShelf
      title="Auto Playlists"
      items={shelfToCardItems(curation?.autoPlaylists ?? [])}
      onPlay={onPlay}
      pinnedIds={pinnedIds}
      onTogglePin={onTogglePin}
    />

    <SectionShelf
      title="For This Time"
      items={shelfToCardItems(curation?.timeShelves ?? [])}
      onPlay={onPlay}
      pinnedIds={pinnedIds}
      onTogglePin={onTogglePin}
    />

    <SectionShelf
      title="Albums for you"
      items={albums.slice(0, 6).map((album) => ({ id: album.id, name: album.name, subtitle: `${album.artist} - ${album.trackCount} songs`, coverPath: album.coverPath, tracks: album.tracks }))}
      onPlay={(track, tracks) => {
        const album = albums.find((item) => item.tracks.some((entry) => entry.id === track.id));
        if (album) {
          navigate(`/library?tab=albums&album=${encodeURIComponent(album.id)}`);
          return;
        }
        onPlay(track, tracks);
      }}
    />

    <SectionShelf
      title="Artists in rotation"
      items={artists.slice(0, 6).map((artist) => ({ id: artist.id, name: artist.name, subtitle: `${artist.trackCount} songs in your library`, coverPath: artist.coverPath, tracks: artist.tracks }))}
      onPlay={(track, tracks) => {
        const artist = artists.find((item) => item.tracks.some((entry) => entry.id === track.id));
        if (artist) {
          navigate(`/library?tab=artists&artist=${encodeURIComponent(artist.id)}`);
          return;
        }
        onPlay(track, tracks);
      }}
      roundArtists
    />

    <section className="spotify-section">
      <div className="section-header">
        <h2>Recommended for you</h2>
        <button className="link-button">Auto refresh</button>
      </div>
      {recommendations.length ? (
        <TrackTable
          tracks={recommendations.map((entry) => entry.track)}
          currentTrackId={currentTrackId}
          onPlay={onPlay}
          onStartRadio={onStartRadio}
          onHideFromRecommendations={onHideFromRecommendations}
          reasonByTrackId={recommendationReasons}
        />
      ) : (
        <div className="empty-card">Play more songs and hit heart on favorites to improve recommendations.</div>
      )}
    </section>

    <section className="spotify-section">
      <div className="section-header">
        <h2>Recently downloaded</h2>
        <button className="link-button">See all</button>
      </div>
      {library?.tracks.length ? <TrackTable tracks={library.tracks.slice(0, 8)} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} /> : <div className="empty-card">Search and download a song to start your collection.</div>}
    </section>

    {!curation?.mixes.length && !curation?.autoPlaylists.length && !curation?.timeShelves.length && (
      <section className="spotify-section">
        <div className="empty-card">Open the app with a few songs in your library and Resonance will build mixes, radio, and time-based shelves once on launch and refresh them every night.</div>
      </section>
    )}
  </div>
  );
};
const RadioPage = ({
  queue,
  currentTrackId,
  currentTrack,
  onPlay,
  onStartRadio,
  onHideFromRecommendations
}: {
  queue: Track[];
  currentTrackId: string | null;
  currentTrack: Track | null;
  onPlay: (track: Track, tracks: Track[]) => void;
  onStartRadio: (track: Track) => void;
  onHideFromRecommendations: (track: Track) => void;
}) => {
  useEffect(() => {
    if (!queue.length && currentTrack) {
      void onStartRadio(currentTrack);
    }
  }, [queue.length, currentTrack?.id]);

  return (
    <div className="page-stack">
      <section className="spotify-section">
        <div className="detail-hero compact radio-hero">
          <div className="detail-artwork-frame detail-artwork-frame-radio">
            <Artwork src={currentTrack?.coverPath} alt={currentTrack?.title ?? "Radio"} size="lg" className="detail-artwork" />
          </div>
          <div>
            <span className="eyebrow">Radio</span>
            <h2>{currentTrack ? `${currentTrack.title} Radio` : "Auto Radio"}</h2>
            <p>{queue.length ? `${queue.length} songs are lined up from your library and recommendation engine.` : "Start a radio from any song and it will build a local queue here."}</p>
            <div className="hero-actions">
              {queue[0] && <button className="primary-hero-button" onClick={() => onPlay(queue[0], queue)}>Play Queue</button>}
              {currentTrack && <button className="secondary-hero-button" onClick={() => onStartRadio(currentTrack)}>Rebuild Radio</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="spotify-section">
        <div className="section-header">
          <h2>Up Next</h2>
          <span className="section-subtle">Freshly generated from your current taste</span>
        </div>
        {queue.length ? (
          <TrackTable tracks={queue} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />
        ) : (
          <div className="empty-card">Play a song and choose Start Radio, or let autoplay finish a queue and Resonance will build one here.</div>
        )}
      </section>
    </div>
  );
};
const SearchPage = ({ onPlay }: { onPlay: (track: Track, tracks: Track[]) => void }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [isQueuingAll, setIsQueuingAll] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => window.resonance.fetchSettings()
  });

  const libraryQuery = useQuery<LibraryPayload>({
    queryKey: ["library"],
    queryFn: () => window.resonance.fetchLibrary()
  });
  const libraryTracks = (libraryQuery.data?.tracks ?? []) as Track[];

  const searchQuery = useQuery({
    queryKey: ["search", deferredQuery],
    queryFn: () => window.resonance.search(deferredQuery),
    enabled: deferredQuery.length > 2
  });

  const [downloadingAlbums, setDownloadingAlbums] = useState<Set<string>>(new Set());
  const [downloadingSongs, setDownloadingSongs] = useState<Set<string>>(new Set());

  const downloadMutation = useMutation<DownloadResponse, Error, SearchResult>({
    mutationFn: (payload: SearchResult) => window.resonance.download(payload)
  });

  const handleDownload = (album: SearchAlbumSummary) => {
    setDownloadFeedback(null);
    setDownloadingAlbums((prev) => new Set(prev).add(album.id));

    window.resonance.downloadAlbum(album.tracks)
      .then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: ["library"] });
        setDownloadFeedback(result.ok ? `Downloaded album ${album.name}.` : result.error ?? "Album download failed.");
      })
      .catch(() => setDownloadFeedback("Album download failed. Please try again."))
      .finally(() => {
        setDownloadingAlbums((prev) => {
          const next = new Set(prev);
          next.delete(album.id);
          return next;
        });
      });
  };

  const suggestions = ["Mast Magan", "Arijit Singh", "Weekend vibe", "Lo-fi focus", "Road trip"];
  const searchAlbums = useMemo(() => buildSearchAlbums(searchQuery.data ?? []), [searchQuery.data]);
  const selectedAlbum = searchAlbums.find((album) => album.id === selectedAlbumId) ?? searchAlbums[0] ?? null;

  return (
    <div className="page-stack">
      <section className="search-banner">
        <div className="search-input-shell">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What do you want to play?" />
        </div>
        <div className="search-chip-row">
          {suggestions.map((item: string) => (
            <button key={item} className="filter-pill active" onClick={() => setQuery(item)}>{item}</button>
          ))}
        </div>
      </section>

      <section className="spotify-section">
        <div className="section-header">
          <h2>Search results</h2>
          <div className="section-header-actions">
            <span className="section-subtle">{deferredQuery ? `Results for "${deferredQuery}"` : "Start typing to explore songs"}</span>
            {searchQuery.data?.length ? (
              <button 
                className="link-button" 
                disabled={isQueuingAll}
                onClick={() => {
                  const data = searchQuery.data ?? [];
                  const toDownload = data.filter((item: any) => !downloadingSongs.has(item.id));
                  if (!toDownload.length) return;

                  setIsQueuingAll(true);
                  setDownloadFeedback(`Queuing ${toDownload.length} results...`);
                  
                  // Update UI status for all at once
                  setDownloadingSongs(prev => {
                    const next = new Set(prev);
                    toDownload.forEach((item: any) => next.add(item.id));
                    return next;
                  });

                  // Trigger downloads
                  toDownload.forEach((item: any) => {
                    downloadMutation.mutate(item, {
                      onSettled: () => {
                        setDownloadingSongs(prev => {
                          const next = new Set(prev);
                          next.delete(item.id);
                          return next;
                        });
                      }
                    });
                  });
                  
                  setTimeout(() => setIsQueuingAll(false), 2000);
                }}
              >
                {isQueuingAll ? "Queuing..." : "Download All"}
              </button>
            ) : null}
          </div>
        </div>
        {downloadFeedback ? <div className="notice-banner">{downloadFeedback}</div> : null}
        {!!searchAlbums.length && (
          <div className="search-album-strip">
            {searchAlbums.slice(0, 6).map((album) => (
              <button 
                key={album.id} 
                className={selectedAlbum?.id === album.id ? "search-album-card active" : "search-album-card"} 
                onClick={() => {
                  setSelectedAlbumId(album.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Artwork src={album.coverPath} alt={album.name} size="sm" />
                <div>
                  <strong>{album.name}</strong>
                  <span className="card-sub-info">{album.artist} • {album.tracks.length} songs</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {selectedAlbum ? (
          <div className="search-album-detail">
            <div className="detail-hero compact">
              <div className="detail-artwork-frame detail-artwork-frame-search">
                <Artwork src={selectedAlbum.coverPath} alt={selectedAlbum.name} size="lg" className="detail-artwork" />
              </div>
              <div>
                <span className="eyebrow">Album View</span>
                <h2>{selectedAlbum.name}</h2>
                <p>{selectedAlbum.artist} - {selectedAlbum.tracks.length} songs - {formatRuntime(selectedAlbum.totalDuration)}</p>
                <div className="hero-actions">
                  <button className="secondary-hero-button">Album tracks below</button>
                  <button
                    className="accent-button"
                    disabled={downloadingAlbums.has(selectedAlbum.id) || selectedAlbum.tracks.every((item: SearchResult) => libraryTracks.some((track) => matchesLibraryTrack(track, item)))}
                    onClick={() => handleDownload(selectedAlbum)}
                  >
                    {downloadingAlbums.has(selectedAlbum.id) ? "Downloading..." : selectedAlbum.tracks.every((item: SearchResult) => libraryTracks.some((track) => matchesLibraryTrack(track, item))) ? "Downloaded" : "Download Album"}
                  </button>
                </div>
              </div>
            </div>
            <div className="search-album-tracks">
              {selectedAlbum.tracks
                .slice()
                .sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999) || a.title.localeCompare(b.title))
                .map((item: any, index) => {
                  const localTrack = libraryTracks.find((track) => matchesLibraryTrack(track, item));
                  const alreadyDownloaded = !!localTrack;
                  return (
                    <div
                      key={`${item.videoId}-${item.id}-album`}
                      className="search-result-row album-track-row"
                      style={{ cursor: alreadyDownloaded ? "pointer" : "default" }}
                      onClick={() => {
                        if (localTrack) {
                          onPlay(localTrack, libraryTracks);
                        }
                      }}
                    >
                      <div className="search-result-main">
                        <div className="track-index-cell" style={{ flex: '0 0 24px' }}>
                          <span className="track-index-num">{item.trackNumber ?? index + 1}</span>
                        </div>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.artists.join(", ")}</span>
                        </div>
                      </div>
                      <div className="search-result-actions">
                        <span>{formatDuration(item.duration)}</span>
                        <button
                          className={alreadyDownloaded ? "accent-button outline" : "accent-button"}
                          disabled={downloadMutation.isPending || alreadyDownloaded}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDownloadFeedback(null);
                            downloadMutation.mutate(item, {
                              onSuccess: async (result) => {
                                await queryClient.invalidateQueries({ queryKey: ["library"] });
                                setDownloadFeedback(result.ok ? `Downloaded ${item.title}.` : result.error ?? "Download failed.");
                              },
                              onError: () => setDownloadFeedback("Download failed. Please try again.")
                            });
                          }}
                        >
                          {alreadyDownloaded ? "Downloaded" : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}
        <div className="search-results-list">
          {searchQuery.isFetching && (
            <>
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </>
          )}
          {!searchQuery.isFetching && !searchQuery.isError && (searchQuery.data ?? []).map((item: any) => (
            <div
              key={`${item.videoId}-${item.id}`}
              className="search-result-row"
              style={{ cursor: libraryTracks.some(t => t.youtubeVideoId === item.videoId) ? 'pointer' : 'default' }}
              onClick={() => {
                const localTrack = libraryTracks.find(t => t.youtubeVideoId === item.videoId);
                if (localTrack) {
                  onPlay(localTrack, libraryTracks);
                }
              }}
            >
              <div className="search-result-main">
                <Artwork src={item.thumbnail} alt={item.title} size="md" />
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.artists.join(", ")}
                    {item.album ? (
                      <>
                        {" - "}
                        <button
                          className="link-button-inline"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent the row's onClick from firing
                            const matchingAlbum = searchAlbums.find(a => a.name === item.album);
                            if (matchingAlbum) {
                              setSelectedAlbumId(matchingAlbum.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                        >
                          {item.album}
                          {(() => {
                            const matchingAlbum = searchAlbums.find(a => a.name === item.album);
                            return matchingAlbum ? ` (${matchingAlbum.tracks.length})` : "";
                          })()}
                        </button>
                      </>
                    ) : ""}
                  </span>
                </div>
              </div>
              <div className="search-result-actions">
                <span>{formatDuration(item.duration)}</span>
                {(() => {
                  const exactMatch = libraryTracks.find(t => matchesLibraryTrack(t, item));
                  const anyMatch = libraryTracks.find(t => t.youtubeVideoId === item.videoId || matchesLibraryTrack(t, item));
                  
                  let btnText = "Download";
                  let btnClass = "accent-button";
                  
                  if (downloadingSongs.has(item.id)) {
                    btnText = "Working...";
                  } else if (exactMatch) {
                    btnText = "Downloaded";
                    btnClass = "accent-button outline";
                  } else if (anyMatch) {
                    btnText = "In Library";
                    btnClass = "accent-button outline";
                  }

                  return (
                    <button
                      className={btnClass}
                      disabled={downloadingSongs.has(item.id) || !!exactMatch}
                      onClick={() => {
                        setDownloadFeedback(null);
                        setDownloadingSongs(prev => new Set(prev).add(item.id));
                        downloadMutation.mutate(item, {
                          onSuccess: async (result) => {
                            await queryClient.invalidateQueries({ queryKey: ["library"] });
                            setDownloadFeedback(result.ok ? `Downloaded ${item.title} to your library.` : result.error ?? "Download failed.");
                          },
                          onError: () => setDownloadFeedback("Download failed. Please try again."),
                          onSettled: () => setDownloadingSongs(prev => {
                            const next = new Set(prev);
                            next.delete(item.id);
                            return next;
                          })
                        });
                      }}
                    >
                      {btnText}
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
          {!searchQuery.isFetching && searchQuery.isError && <div className="empty-card">Search is temporarily unavailable.</div>}
          {!deferredQuery && <div className="empty-card">Search songs, artists, or albums. Resonance now brings back covers, artist names, and album names.</div>}
        </div>
      </section>
    </div>
  );
};

const LibraryPage = ({
  library,
  albums,
  artists,
  playlists,
  currentTrackId,
  onPlay,
  onStartRadio,
  onHideFromRecommendations
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
  onStartRadio: (track: Track) => void;
  onHideFromRecommendations: (track: Track) => void;
}) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<"songs" | "albums" | "artists" | "playlists">(
    requestedTab === "albums" || requestedTab === "artists" || requestedTab === "playlists" ? requestedTab as any : "songs"
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(searchParams.get("album"));
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(searchParams.get("artist"));
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(searchParams.get("playlist"));
  const [storageBytes, setStorageBytes] = useState<number>(0);

  useEffect(() => {
    window.resonance.fetchStorageUsage().then(setStorageBytes);
  }, [library]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "albums" || nextTab === "artists" || nextTab === "songs" || nextTab === "playlists") {
      setTab(nextTab);
    }
    setSelectedAlbumId(searchParams.get("album"));
    setSelectedArtistId(searchParams.get("artist"));
    setSelectedPlaylistId(searchParams.get("playlist"));
  }, [searchParams]);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? albums[0] ?? null;
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) ?? artists[0] ?? null;
  const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0] ?? null;

  const selectedAlbumArtworkQuery = useQuery<string | null>({
    queryKey: ["library-artwork", "album", selectedAlbum?.name, selectedAlbum?.artist],
    queryFn: () => window.resonance.lookupArtwork({ kind: "album", name: selectedAlbum!.name, artist: selectedAlbum!.artist }),
    enabled: !!selectedAlbum,
    staleTime: 1000 * 60 * 60 * 24
  });

  const selectedArtistArtworkQuery = useQuery<string | null>({
    queryKey: ["library-artwork", "artist", selectedArtist?.name],
    queryFn: () => window.resonance.lookupArtwork({ kind: "artist", name: selectedArtist!.name }),
    enabled: !!selectedArtist,
    staleTime: 1000 * 60 * 60 * 24
  });

  const selectedAlbumArtwork = selectedAlbumArtworkQuery.data ?? selectedAlbum?.coverPath ?? null;
  const selectedArtistArtwork = selectedArtistArtworkQuery.data ?? selectedArtist?.coverPath ?? null;

  const updateLibraryRoute = (next: { tab: "songs" | "albums" | "artists" | "playlists"; album?: string | null; artist?: string | null; playlist?: string | null }) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab);
    if (next.album) params.set("album", next.album);
    if (next.artist) params.set("artist", next.artist);
    if (next.playlist) params.set("playlist", next.playlist);
    setSearchParams(params);
  };

  const deleteAlbumMutation = useMutation<any, Error, string>({
    mutationFn: (albumName: string) => window.resonance.deleteAlbum(albumName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
      updateLibraryRoute({ tab: "albums" });
    }
  });

  const addTrackToPlaylistMutation = useMutation<void, Error, { playlistId: string; trackId: string }>({
    mutationFn: ({ playlistId, trackId }) => window.resonance.addTrackToPlaylist(playlistId, trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-tracks", selectedPlaylistId] });
    }
  });

  const handleAddToPlaylist = (track: Track) => {
    if (selectedPlaylistId) {
      addTrackToPlaylistMutation.mutate({ playlistId: selectedPlaylistId, trackId: track.id });
    } else {
      // Handle case where no playlist is selected, e.g., show a modal to choose/create one
      alert("Please select a playlist first.");
    }
  };

  return (
    <div className="page-stack">
      <section className="library-hero">
        <div>
          <span className="eyebrow">Collection</span>
          <h1>Your Library</h1>
          <p>{library?.tracks.length ?? 0} songs, {albums.length} albums, {artists.length} artists • {formatSize(storageBytes)} used</p>
        </div>
      </section>

      <section className="spotify-section">
        <div className="tab-row">
          <button className={tab === "songs" ? "filter-pill active" : "filter-pill"} onClick={() => updateLibraryRoute({ tab: "songs" })}>Songs</button>
          <button className={tab === "albums" ? "filter-pill active" : "filter-pill"} onClick={() => updateLibraryRoute({ tab: "albums", album: selectedAlbum?.id ?? albums[0]?.id ?? null })}>Albums</button>
          <button className={tab === "artists" ? "filter-pill active" : "filter-pill"} onClick={() => updateLibraryRoute({ tab: "artists", artist: selectedArtist?.id ?? artists[0]?.id ?? null })}>Artists</button>
          <button className={tab === "playlists" ? "filter-pill active" : "filter-pill"} onClick={() => updateLibraryRoute({ tab: "playlists", playlist: selectedPlaylistId ?? playlists[0]?.id ?? null })}>Playlists</button>
        </div>

        {tab === "songs" && (
          library?.tracks.length ? <TrackTable tracks={library.tracks} currentTrackId={currentTrackId} onPlay={onPlay} onAddToPlaylist={handleAddToPlaylist} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} /> : <div className="empty-card">Your library is empty right now.</div>
        )}

        {tab === "albums" && (
          <div className="detail-layout">
            <div className="detail-sidebar">
              {albums.map((album) => (
                <button key={album.id} className={selectedAlbum?.id === album.id ? "detail-item active" : "detail-item"} onClick={() => updateLibraryRoute({ tab: "albums", album: album.id })}>
                  <Artwork src={album.coverPath} alt={album.name} size="sm" />
                  <div>
                    <strong>{album.name}</strong>
                    <span>{album.artist}</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedAlbum ? (
              <div className="detail-main">
                <div className="detail-hero">
                  <div className="detail-artwork-frame">
                    <Artwork src={selectedAlbumArtwork} alt={selectedAlbum.name} size="lg" className="detail-artwork" />
                  </div>
                  <div>
                    <span className="eyebrow">Album</span>
                    <h2>{selectedAlbum.name}</h2>
                    <p>{selectedAlbum.artist} - {selectedAlbum.trackCount} songs - {formatRuntime(selectedAlbum.totalDuration)}</p>
                    <div className="hero-actions">
                      <button className="primary-hero-button" onClick={() => onPlay(selectedAlbum.tracks[0]!, selectedAlbum.tracks)}>Play</button>
                      <button className="secondary-hero-button" onClick={() => onPlay(selectedAlbum.tracks[Math.floor(Math.random() * selectedAlbum.tracks.length)]!, selectedAlbum.tracks)}>Shuffle</button>
                      <button 
                        className="secondary-hero-button" 
                        title="Delete Album" 
                        disabled={deleteAlbumMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete the album "${selectedAlbum.name}" and all its tracks from your library?`)) {
                            deleteAlbumMutation.mutate(selectedAlbum.name === "Single" ? "" : selectedAlbum.name);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <TrackTable tracks={selectedAlbum.tracks} currentTrackId={currentTrackId} onPlay={onPlay} onAddToPlaylist={handleAddToPlaylist} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />
              </div>
            ) : null}
          </div>
        )}

        {tab === "artists" && (
          <div className="detail-layout">
            <div className="detail-sidebar">
              {artists.map((artist) => (
                <button key={artist.id} className={selectedArtist?.id === artist.id ? "detail-item active" : "detail-item"} onClick={() => updateLibraryRoute({ tab: "artists", artist: artist.id })}>
                  <Artwork src={artist.coverPath} alt={artist.name} size="sm" round />
                  <div>
                    <strong>{artist.name}</strong>
                    <span>{artist.trackCount} songs</span>
                  </div>
                </button>
              ))}
            </div>
            {selectedArtist ? (
              <div className="detail-main">
                <div className="detail-hero">
                  <div className="detail-artwork-frame detail-artwork-frame-round">
                    <Artwork src={selectedArtistArtwork} alt={selectedArtist.name} size="lg" round className="detail-artwork" />
                  </div>
                  <div>
                    <span className="eyebrow">Artist</span>
                    <h2>{selectedArtist.name}</h2>
                    <p>{selectedArtist.trackCount} songs - {formatRuntime(selectedArtist.totalDuration)}</p>
                    <div className="hero-actions">
                      <button className="primary-hero-button" onClick={() => onPlay(selectedArtist.tracks[0]!, selectedArtist.tracks)}>Play</button>
                    </div>
                  </div>
                </div>
                <TrackTable tracks={selectedArtist.tracks} currentTrackId={currentTrackId} onPlay={onPlay} onAddToPlaylist={handleAddToPlaylist} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />
              </div>
            ) : null}
          </div>
        )}

        {tab === "playlists" && (
          <div className="detail-layout">
            <div className="detail-sidebar">
              {playlists.map((playlist) => (
                <button key={playlist.id} className={selectedPlaylist?.id === playlist.id ? "detail-item active" : "detail-item"} onClick={() => updateLibraryRoute({ tab: "playlists", playlist: playlist.id })}>
                  <div className="artwork-placeholder sm"><History size={24} /></div>
                  <div>
                    <strong>{playlist.name}</strong>
                    <span>Playlist • {playlist.trackCount} songs</span>
                  </div>
                </button>
              ))}
              {playlists.length === 0 && <div className="empty-card slim">No playlists found.</div>}
            </div>
            {selectedPlaylist ? (
              <div className="detail-main">
                <div className="detail-hero">
                  <div className="detail-artwork-frame detail-artwork-frame-placeholder">
                    <div className="artwork-placeholder lg"><History size={64} /></div>
                  </div>
                  <div>
                    <span className="eyebrow">Playlist</span>
                    <h2>{selectedPlaylist.name}</h2>
                    <p>{selectedPlaylist.trackCount} songs</p>
                    <div className="hero-actions">
                      <button className="secondary-hero-button" title="Delete Playlist" onClick={() => {
                        if (window.confirm(`Delete the playlist "${selectedPlaylist.name}"?`)) {
                          window.resonance.deletePlaylist(selectedPlaylist.id).then(() => queryClient.invalidateQueries({ queryKey: ["library"] }));
                        }
                      }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <PlaylistTracksView playlistId={selectedPlaylist.id} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />
              </div>
            ) : <div className="detail-main empty">Select a playlist to view its tracks.</div>}
          </div>
        )}
      </section>
    </div>
  );
};

const CapsulePage = () => {
  const capsuleQuery = useQuery({
    queryKey: ["capsule-history"],
    queryFn: () => window.resonance.fetchCapsuleHistory()
  });
  const data = capsuleQuery.data;

  return (
    <div className="page-stack">
      <section className="library-hero capsule-tone">
        <div>
          <span className="eyebrow">Sound Capsule</span>
          <h1>Your listening history</h1>
          <p>Total time, weekly time, top artists, and listening streaks.</p>
        </div>
      </section>
      <section className="stats-strip">
        <div className="stat-tile"><span>All time</span><strong>{Math.round((data?.totalListeningTime ?? 0) / 60)} min</strong></div>
        <div className="stat-tile"><span>This week</span><strong>{Math.round((data?.weeklyListeningTime ?? 0) / 60)} min</strong></div>
        <div className="stat-tile"><span>Longest streak</span><strong>{data?.longestStreakDays ?? 0} days</strong></div>
      </section>
      <section className="spotify-section">
        <div className="section-header">
          <h2>Listening heatmap</h2>
        </div>
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.heatmap ?? []}>
              <CartesianGrid stroke="#2a2a2a" />
              <XAxis dataKey="hour" stroke="#b3b3b3" />
              <YAxis dataKey="count" stroke="#b3b3b3" />
              <Tooltip />
              <Bar dataKey="count" fill="#1DB954" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

const SettingsPage = ({
  hiddenTracks,
  onUnhideTrack,
  onUnhideAll
}: {
  hiddenTracks: Track[];
  onUnhideTrack: (track: Track) => Promise<void>;
  onUnhideAll: () => Promise<void>;
}) => {
  const queryClient = useQueryClient();
  const folderPathQuery = useQuery({
    queryKey: ["library-folder-path"],
    queryFn: async () => {
      if (typeof window.resonance.getLibraryFolderPath !== "function") {
        throw new Error("Desktop bridge is outdated. Please restart the app.");
      }
      return window.resonance.getLibraryFolderPath();
    }
  });
  const openFolderMutation = useMutation({
    mutationFn: async () => {
      if (typeof window.resonance.openLibraryFolder !== "function") {
        return { ok: false, error: "Desktop bridge is outdated. Please restart the app." };
      }
      return window.resonance.openLibraryFolder();
    }
  });
  const repairMetadataMutation = useMutation({
    mutationFn: () => window.resonance.repairLibraryMetadata(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
    }
  });
  const refreshCurationsMutation = useMutation({
    mutationFn: () => window.resonance.refreshCurations(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-curation"] });
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    }
  });
  const unhideAllMutation = useMutation({
    mutationFn: () => onUnhideAll(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      await queryClient.invalidateQueries({ queryKey: ["daily-curation"] });
    }
  });

  return (
    <div className="page-stack">
      <section className="spotify-section">
        <div className="section-header">
          <h2>Library Folder</h2>
        </div>
        <p>Open the folder where all downloaded songs are stored.</p>
        <div className="token-block" style={{ marginBottom: 16 }}>
          {folderPathQuery.isPending && "Loading folder path..."}
          {folderPathQuery.isError && "Could not load folder path. Please restart the app."}
          {!folderPathQuery.isPending && !folderPathQuery.isError && folderPathQuery.data}
        </div>
        <button
          className="secondary-hero-button"
          type="button"
          onClick={() => openFolderMutation.mutate()}
          disabled={openFolderMutation.isPending || folderPathQuery.isPending}
        >
          {openFolderMutation.isPending ? "Opening..." : "Show Folder"}
        </button>
        {openFolderMutation.isSuccess && !openFolderMutation.data.ok && (
          <p className="section-subtle" style={{ color: "#ff7676", marginTop: 8 }}>
            Could not open folder: {openFolderMutation.data.error || "Unknown error"}
          </p>
        )}
        {openFolderMutation.isError && (
          <p className="section-subtle" style={{ color: "#ff7676", marginTop: 8 }}>
            Could not open folder. Please try again.
          </p>
        )}
      </section>

      <section className="spotify-section">
        <div className="section-header">
          <h2>Mix Refresh</h2>
        </div>
        <p>Regenerate weekly mixes, auto playlists, and time-based shelves right now instead of waiting for the nightly refresh.</p>
        <button
          className="secondary-hero-button"
          type="button"
          onClick={() => refreshCurationsMutation.mutate()}
          disabled={refreshCurationsMutation.isPending}
        >
          {refreshCurationsMutation.isPending ? "Refreshing..." : "Refresh Curated Shelves"}
        </button>
        {refreshCurationsMutation.isSuccess && (
          <p className="section-subtle" style={{ marginTop: 10 }}>
            Curated shelves were rebuilt from your local history and library.
          </p>
        )}
      </section>


      <section className="spotify-section">
        <div className="section-header">
          <h2>Hidden From Recommendations</h2>
        </div>
        <p>Tracks hidden from recommendations appear here. Unhide any track to let it return to mixes and suggestions.</p>
        {hiddenTracks.length ? (
          <>
            <button
              className="secondary-hero-button"
              type="button"
              onClick={() => unhideAllMutation.mutate()}
              disabled={unhideAllMutation.isPending}
              style={{ marginBottom: 12 }}
            >
              {unhideAllMutation.isPending ? "Unhiding..." : `Unhide All (${hiddenTracks.length})`}
            </button>
            <div className="hidden-track-list">
              {hiddenTracks.map((track) => (
                <div key={track.id} className="hidden-track-row">
                  <div className="hidden-track-meta">
                    <strong>{track.title}</strong>
                    <span>{track.artists.join(", ")}</span>
                  </div>
                  <button className="link-button" type="button" onClick={() => { void onUnhideTrack(track); }}>
                    Unhide
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-card slim">No hidden tracks right now.</div>
        )}
      </section>
      <section className="spotify-section">
        <div className="section-header">
          <h2>Metadata Repair</h2>
        </div>
        <p>Refresh saved song titles and artists from the original source. This is the safest way to correct swapped entries like the Raabta variants without redownloading audio.</p>
        <button
          className="secondary-hero-button"
          type="button"
          onClick={() => repairMetadataMutation.mutate()}
          disabled={repairMetadataMutation.isPending}
        >
          {repairMetadataMutation.isPending ? "Repairing..." : "Repair Library Metadata"}
        </button>
        {repairMetadataMutation.isSuccess && (
          <p className="section-subtle" style={{ marginTop: 10 }}>
            Scanned {repairMetadataMutation.data.scanned} tracks, updated {repairMetadataMutation.data.updated}, failed {repairMetadataMutation.data.failed}.
          </p>
        )}
        {repairMetadataMutation.isError && (
          <p className="section-subtle" style={{ color: "#ff7676", marginTop: 10 }}>
            Could not repair metadata right now. Please try again.
          </p>
        )}
      </section>
    </div>
  );
};
const LyricsPage = ({
  currentTrack,
  currentTime,
  isPlaying,
  onSeek
}: {
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}) => {
  const lyricsQuery = useQuery<LyricsResponse | null>({
    queryKey: ["lyrics", currentTrack?.title, currentTrack?.artists[0], currentTrack?.album],
    queryFn: () => window.resonance.fetchLyrics({
      title: currentTrack!.title,
      artist: currentTrack!.artists[0] ?? "",
      album: currentTrack!.album,
      duration: currentTrack!.duration
    }),
    enabled: !!currentTrack
  });
  const lyricLines = useMemo(() => parseSyncedLyrics(lyricsQuery.data?.syncedLyrics), [lyricsQuery.data?.syncedLyrics]);
  const activeIndex = lyricLines.findIndex((line, index) => currentTime >= line.time && currentTime < (lyricLines[index + 1]?.time ?? Number.POSITIVE_INFINITY));
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lyricsContainerRef.current || activeIndex < 0) return;
    const target = lyricsContainerRef.current.querySelector<HTMLElement>(`[data-line-index="${activeIndex}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  if (!currentTrack) {
    return <section className="spotify-section"><div className="empty-card">Play something first and the karaoke view will light up here.</div></section>;
  }

  return (
    <div className="page-stack lyrics-page">
      <section className="spotify-section lyrics-shell">
        <div className="lyrics-stage">
          <div className="detail-artwork-frame detail-artwork-frame-search lyrics-artwork">
            <Artwork src={currentTrack.coverPath} alt={currentTrack.title} size="lg" className="detail-artwork" />
          </div>
          <div className="lyrics-intro">
            <span className="eyebrow">Lyrics</span>
            <h2>{currentTrack.title}</h2>
            <p>{currentTrack.artists.join(", ")} {isPlaying ? "is playing now." : "is paused."}</p>
          </div>
        </div>
        {lyricsQuery.isLoading ? (
          <div className="empty-card">Fetching synced lyrics...</div>
        ) : lyricsQuery.data?.instrumental ? (
          <div className="empty-card">This track looks instrumental, so there are no vocals to sync here.</div>
        ) : lyricLines.length ? (
          <div className="lyrics-lines" ref={lyricsContainerRef}>
            {lyricLines.map((line, index) => (
              <button
                key={`${line.time}-${index}`}
                type="button"
                data-line-index={index}
                className={index == activeIndex ? "lyric-line active" : "lyric-line"}
                onClick={() => onSeek(line.time)}
              >
                <span>{line.text}</span>
              </button>
            ))}
          </div>
        ) : lyricsQuery.data?.plainLyrics ? (
          <pre className="plain-lyrics-block">{lyricsQuery.data.plainLyrics}</pre>
        ) : (
          <div className="empty-card">No synced lyrics found for this track yet.</div>
        )}
      </section>
    </div>
  );
};

const MiniPlayerView = ({ state }: { state: PlaybackSnapshot }) => {
  const track = state.track;

  return (
    <div className="mini-player-shell">
      <div className="mini-player-card">
        <div className="mini-player-main">
          <Artwork src={track?.coverPath} alt={track?.title ?? "Mini player"} size="sm" />
          <div className="mini-player-copy">
            <strong>{track?.title ?? "Nothing playing"}</strong>
            <span>{track?.artists.join(", ") ?? "Open the main window and start a song."}</span>
          </div>
          <button className="transport-icon mini-no-drag" type="button" title="Open main window" onClick={() => window.resonance.sendPlaybackCommand("show-main")}>
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="mini-player-controls">
          <button className="transport-icon mini-no-drag" type="button" title="Previous" onClick={() => window.resonance.sendPlaybackCommand("previous")} disabled={!track}>
            <SkipBack size={14} fill="currentColor" />
          </button>
          <button className="transport-play mini-no-drag" type="button" title={state.isPlaying ? "Pause" : "Play"} onClick={() => window.resonance.sendPlaybackCommand("toggle-play")} disabled={!track}>
            {state.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <button className="transport-icon mini-no-drag" type="button" title="Next" onClick={() => window.resonance.sendPlaybackCommand("next")} disabled={!track}>
            <SkipForward size={14} fill="currentColor" />
          </button>
        </div>
        <div className="mini-player-progress">
          <span>{formatDuration(Math.floor(state.currentTime))}</span>
          <div className="mini-player-progress-bar"><span style={{ width: `${((state.currentTime / (state.duration || 1)) * 100).toFixed(2)}%` }} /></div>
          <span>{formatDuration(Math.floor(state.duration))}</span>
        </div>
      </div>
    </div>
  );
};
const RoutedContent = ({
  library,
  albums,
  artists,
  playlists,
  collections,
  recommendations,
  curation,
  pinnedShelves,
  queue,
  currentTrack,
  currentTrackId,
  currentTime,
  isPlaying,
  onSeek,
  onPlay,
  onStartRadio,
  onHideFromRecommendations,
  hiddenTracks,
  onUnhideTrack,
  onUnhideAll,
  onTogglePin
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  collections: CollectionSummary[];
  recommendations: RecommendationEntry[];
  curation: DailyCurationBundle | undefined;
  pinnedShelves: ShelfCardItem[];
  queue: Track[];
  currentTrack: Track | null;
  currentTrackId: string | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onPlay: (track: Track, tracks: Track[]) => void;
  onStartRadio: (track: Track) => void;
  onHideFromRecommendations: (track: Track) => void;
  hiddenTracks: Track[];
  onUnhideTrack: (track: Track) => Promise<void>;
  onUnhideAll: () => Promise<void>;
  onTogglePin: (item: ShelfCardItem) => void;
}) => {
  const location = useLocation();
  const headerMap: Record<string, { title: string; subtitle: string }> = {
    "/": { title: "Good evening", subtitle: "Jump back into your music" },
    "/search": { title: "Search", subtitle: "Find songs, albums, and artists" },
    "/library": { title: "Your Library", subtitle: "Albums, artists, and saved songs" },
    "/radio": { title: "Radio", subtitle: "Continuous queues built from your songs" },
    "/lyrics": { title: "Lyrics", subtitle: "Real-time synced karaoke view" },
    "/capsule": { title: "Sound Capsule", subtitle: "Analytics from your listening" },
    "/settings": { title: "Settings", subtitle: "Desktop node and pairing" }
  };
  const header = headerMap[location.pathname] ?? headerMap["/"];

  return (
    <div className="content-shell">
      <MainHeader title={header.title} subtitle={header.subtitle} />
      <div className="content-scroll">
        <Routes>
          <Route path="/" element={<HomePage library={library} albums={albums} artists={artists} playlists={playlists} collections={collections} recommendations={recommendations} curation={curation} pinnedShelves={pinnedShelves} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} onTogglePin={onTogglePin} />} />
          <Route path="/search" element={<SearchPage onPlay={onPlay} />} />
          <Route path="/library" element={<LibraryPage library={library} albums={albums} artists={artists} playlists={playlists} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />} />
          <Route path="/radio" element={<RadioPage queue={queue} currentTrack={currentTrack} currentTrackId={currentTrackId} onPlay={onPlay} onStartRadio={onStartRadio} onHideFromRecommendations={onHideFromRecommendations} />} />
          <Route path="/lyrics" element={<LyricsPage currentTrack={currentTrack} currentTime={currentTime} isPlaying={isPlaying} onSeek={onSeek} />} />
          <Route path="/capsule" element={<CapsulePage />} />
          <Route path="/settings" element={<SettingsPage hiddenTracks={hiddenTracks} onUnhideTrack={onUnhideTrack} onUnhideAll={onUnhideAll} />} />
        </Routes>
      </div>
    </div>
  );
};
export const App = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlaybackSyncRef = useRef("");
  const { isPlaying, currentTrackId, setCurrentTrack, setPlaying } = usePlayerStore();
  const [currentTrack, setCurrentTrackMeta] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isQueueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [miniPlaybackState, setMiniPlaybackState] = useState<PlaybackSnapshot>({
    track: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85
  });
  const [pinnedShelfIds, setPinnedShelfIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(PINNED_SHELVES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [hiddenTrackIds, setHiddenTrackIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_TRACKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recommendationProfile, setRecommendationProfile] = useState<RecommendationProfile | null>(() => {
    const stored = window.localStorage.getItem(RECOMMENDATION_PROFILE_STORAGE_KEY);
    return stored === "balanced" || stored === "bollywood" || stored === "discovery" || stored === "comfort" ? stored : null;
  });

  const libraryQuery = useQuery<LibraryPayload>({
    queryKey: ["library"],
    queryFn: () => window.resonance.fetchLibrary()
  });

  const recommendationsQuery = useQuery<RecommendationEntry[]>({
    queryKey: ["recommendations", currentTrackId, recommendationProfile],
    queryFn: () => window.resonance.getRecommendations(20, currentTrackId ?? undefined, recommendationProfile ?? "balanced"),
    enabled: (libraryQuery.data?.tracks.length ?? 0) > 0 && recommendationProfile !== null
  });

  const curationQuery = useQuery<DailyCurationBundle>({
    queryKey: ["daily-curation", recommendationProfile],
    queryFn: () => window.resonance.getDailyCuration(recommendationProfile ?? "balanced"),
    enabled: (libraryQuery.data?.tracks.length ?? 0) > 0 && recommendationProfile !== null,
    staleTime: 1000 * 60 * 30
  });

  const albums = useMemo(() => buildAlbums(libraryQuery.data?.tracks ?? []), [libraryQuery.data?.tracks]);
  const artists = useMemo(() => buildArtists(libraryQuery.data?.tracks ?? []), [libraryQuery.data?.tracks]);
  const collections = useMemo(() => buildCollections(libraryQuery.data?.tracks ?? [], albums, artists), [libraryQuery.data?.tracks, albums, artists]);
  const recommendations = useMemo(() => recommendationsQuery.data ?? [], [recommendationsQuery.data]);
  const curation = useMemo(() => curationQuery.data, [curationQuery.data]);
  const pinnedShelves = useMemo(() => {
    const allShelves = [...(curation?.mixes ?? []), ...(curation?.autoPlaylists ?? []), ...(curation?.timeShelves ?? [])];
    const byId = new Map(allShelves.map((shelf) => [shelf.id, shelfToCardItems([shelf])[0]]));
    return pinnedShelfIds.map((id) => byId.get(id)).filter(Boolean) as ShelfCardItem[];
  }, [curation, pinnedShelfIds]);
  const hiddenTracks = useMemo(() => {
    const byId = new Map((libraryQuery.data?.tracks ?? []).map((track) => [track.id, track]));
    return hiddenTrackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
  }, [libraryQuery.data?.tracks, hiddenTrackIds]);
  const currentQueueIndex = queue.findIndex((track) => track.id === currentTrack?.id);

  useEffect(() => {
    if (!recommendationProfile) return;
    window.localStorage.setItem(RECOMMENDATION_PROFILE_STORAGE_KEY, recommendationProfile);
  }, [recommendationProfile]);

  useEffect(() => {
    window.localStorage.setItem(PINNED_SHELVES_STORAGE_KEY, JSON.stringify(pinnedShelfIds));
  }, [pinnedShelfIds]);

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_TRACKS_STORAGE_KEY, JSON.stringify(hiddenTrackIds));
  }, [hiddenTrackIds]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.filePath) return;
    const nextSrc = toAssetSrc(currentTrack.filePath) ?? currentTrack.filePath;
    if (audioRef.current.src === nextSrc) return;
    audioRef.current.src = nextSrc;
    audioRef.current.currentTime = 0;
    audioRef.current.playbackRate = 1;
    audioRef.current.defaultPlaybackRate = 1;
    setCurrentTime(0);
    setPlaybackDuration(currentTrack.duration || 0);
    if (isPlaying) {
      void audioRef.current.play();
    }
  }, [currentTrack?.id, currentTrack?.filePath]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.playbackRate = 1;
    audioRef.current.defaultPlaybackRate = 1;
    if (isPlaying) {
      void audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack?.id]);

  useEffect(() => {
    if (!isMiniMode) return;
    void window.resonance.getPlaybackState().then(setMiniPlaybackState);
    return window.resonance.onPlaybackState((state) => setMiniPlaybackState(state));
  }, []);

  useEffect(() => {
    if (isMiniMode) return;
    const trackPayload = currentTrack ? {
      id: currentTrack.id,
      title: currentTrack.title,
      artists: currentTrack.artists,
      album: currentTrack.album,
      coverPath: currentTrack.coverPath,
      duration: currentTrack.duration,
      filePath: currentTrack.filePath
    } : null;
    const signature = JSON.stringify({
      trackId: trackPayload?.id ?? null,
      isPlaying,
      currentSecond: Math.floor(currentTime),
      duration: playbackDuration || currentTrack?.duration || 0,
      volume: Number(volume.toFixed(2))
    });
    if (signature === lastPlaybackSyncRef.current) return;
    lastPlaybackSyncRef.current = signature;
    void window.resonance.updatePlaybackState({
      track: trackPayload,
      isPlaying,
      currentTime,
      duration: playbackDuration || currentTrack?.duration || 0,
      volume
    });
  }, [currentTrack, currentTime, isPlaying, volume, playbackDuration]);

  const refreshAfterPlaybackEvent = async () => {
    await Promise.all([
      libraryQuery.refetch(),
      recommendationsQuery.refetch(),
      curationQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["capsule-history"] })
    ]);
  };

  const playTrack = (track: Track, sourceTracks: Track[]) => {
    if (!track.filePath) return;

    if (currentTrack && currentTrack.id !== track.id) {
      const listenedSeconds = Math.max(0, Math.floor(currentTime));
      const nearEndThreshold = currentTrack.duration > 0
        ? Math.max(currentTrack.duration - 2, Math.floor(currentTrack.duration * 0.9))
        : Number.POSITIVE_INFINITY;

      if (listenedSeconds > 3 && listenedSeconds < nearEndThreshold) {
        void window.resonance.notifyPlaybackFinished(currentTrack.id, listenedSeconds);
      }

      const skipThreshold = Math.min(30, Math.max(8, Math.floor((currentTrack.duration || 0) * 0.25)));
      if (listenedSeconds > 0 && listenedSeconds < skipThreshold) {
        void window.resonance.setRecommendationFeedback(currentTrack.id, "skip");
      }
    }

    setQueue(sourceTracks.filter((item) => item.filePath));
    setCurrentTrack(track.id);
    setCurrentTrackMeta(track);
    setPlaybackDuration(track.duration || 0);
    setPlaying(true);
    void window.resonance.notifyPlaybackStarted(track.id).then(refreshAfterPlaybackEvent);
  };

  const advanceToTrack = (track: Track, sourceTracks: Track[]) => {
    playTrack(track, sourceTracks);
  };

  const playRelative = (offset: number) => {
    if (!queue.length) return;
    const nextTrack = queue[currentQueueIndex + offset];
    if (nextTrack) {
      playTrack(nextTrack, queue);
    }
  };

  const advanceQueueOrRecommendations = async () => {
    if (!currentTrack) return false;
    const nextTrack = queue[currentQueueIndex + 1];
    if (nextTrack) {
      advanceToTrack(nextTrack, queue);
      return true;
    }

    if (repeatMode === "all" && queue.length) {
      advanceToTrack(queue[0], queue);
      return true;
    }

    const autoQueue = await window.resonance.getAutoQueue(currentTrack.id, recommendationProfile ?? "balanced", 15);
    if (autoQueue.length) {
      advanceToTrack(autoQueue[0], autoQueue);
      return true;
    }

    const autoNext = await window.resonance.getAutoNextTrack(currentTrack.id, recommendationProfile ?? "balanced");
    if (autoNext?.ok && autoNext.track) {
      advanceToTrack(autoNext.track, [autoNext.track]);
      return true;
    }

    return false;
  };

  const createPlaylistMutation = useMutation<any, Error, string>({
    mutationFn: (name: string) => window.resonance.createPlaylist(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
    }
  });

  const handleCreatePlaylist = () => {
    const name = window.prompt("Playlist Name:", "New Playlist");
    if (name) {
      createPlaylistMutation.mutate(name);
    }
  };

  const handleProfileSelect = (profile: RecommendationProfile) => {
    setRecommendationProfile(profile);
  };

  const handleStartRadio = async (track: Track) => {
    const radioTracks = await window.resonance.getTrackRadio(track.id, recommendationProfile ?? "balanced", 25);
    setQueueDrawerOpen(true);
    navigate("/radio");
    playTrack(track, [track, ...radioTracks.filter((entry) => entry.id !== track.id)]);
  };

  const togglePlayback = () => {
    setPlaying(!usePlayerStore.getState().isPlaying);
  };

  const cycleRepeatMode = () => {
    setRepeatMode((current) => current === "off" ? "all" : current === "all" ? "one" : "off");
  };

  const handleTogglePin = (item: ShelfCardItem) => {
    setPinnedShelfIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [item.id, ...current].slice(0, 12));
  };

  const handleHideFromRecommendations = async (track: Track) => {
    await window.resonance.setRecommendationFeedback(track.id, "skip");
    setHiddenTrackIds((current) => current.includes(track.id) ? current : [track.id, ...current]);
    setQueue((current) => current.filter((item) => item.id !== track.id));
    await Promise.all([recommendationsQuery.refetch(), curationQuery.refetch()]);
  };

  const handleUnhideTrack = async (track: Track) => {
    await window.resonance.setRecommendationFeedback(track.id, "neutral");
    setHiddenTrackIds((current) => current.filter((id) => id !== track.id));
    await Promise.all([recommendationsQuery.refetch(), curationQuery.refetch()]);
  };

  const handleUnhideAll = async () => {
    const targets = [...hiddenTrackIds];
    for (const id of targets) {
      await window.resonance.setRecommendationFeedback(id, "neutral");
    }
    setHiddenTrackIds([]);
    await Promise.all([recommendationsQuery.refetch(), curationQuery.refetch()]);
  };

  useEffect(() => {
    if (isMiniMode) return;
    return window.resonance.onPlaybackCommand((command: PlaybackCommand) => {
      if (command === "toggle-play") {
        togglePlayback();
        return;
      }
      if (command === "previous") {
        playRelative(-1);
        return;
      }
      if (command === "next") {
        void advanceQueueOrRecommendations();
      }
    });
  }, [currentQueueIndex, queue, currentTrack, recommendationProfile, repeatMode]);

  useEffect(() => {
    if (isMiniMode) return;
    return window.resonance.onPlaybackOpenTrack((payload) => {
      const allTracks = libraryQuery.data?.tracks ?? [];
      if (!payload?.trackId || !allTracks.length) return;
      const trackById = new Map(allTracks.map((track) => [track.id, track]));
      const seedTrack = trackById.get(payload.trackId);
      if (!seedTrack) return;
      const queueTracks = (payload.queueTrackIds ?? [payload.trackId])
        .map((trackId) => trackById.get(trackId))
        .filter((track): track is Track => Boolean(track));
      playTrack(seedTrack, queueTracks.length ? queueTracks : [seedTrack]);
    });
  }, [libraryQuery.data?.tracks, playTrack]);

  if (isMiniMode) {
    return <MiniPlayerView state={miniPlaybackState} />;
  }

  if (!recommendationProfile) {
    return <StartingScreen onSelect={handleProfileSelect} />;
  }

  return (
    <div className="spotify-shell">
      <Sidebar
        collections={collections}
        albums={albums}
        artists={artists}
        playlists={libraryQuery.data?.playlists ?? []}
        pinnedShelves={pinnedShelves}
        currentTrackId={currentTrackId}
        onPlay={playTrack}
        onCreatePlaylist={handleCreatePlaylist}
      />
      <RoutedContent
        library={libraryQuery.data}
        albums={albums}
        artists={artists}
        playlists={libraryQuery.data?.playlists ?? []}
        collections={collections}
        recommendations={recommendations}
        curation={curation}
        pinnedShelves={pinnedShelves}
        queue={queue}
        currentTrack={currentTrack}
        currentTrackId={currentTrackId}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onSeek={(time) => {
          setCurrentTime(time);
          if (audioRef.current) {
            audioRef.current.currentTime = time;
          }
        }}
        onPlay={playTrack}
        onStartRadio={handleStartRadio}
        onHideFromRecommendations={handleHideFromRecommendations}
        hiddenTracks={hiddenTracks}
        onUnhideTrack={handleUnhideTrack}
        onUnhideAll={handleUnhideAll}
        onTogglePin={handleTogglePin}
      />
      <footer className="player-bar">
        <div className="player-left">
          <Artwork src={currentTrack?.coverPath} alt={currentTrack?.title ?? "Nothing playing"} size="sm" />
          <div className="player-track-meta">
            <strong>{currentTrack?.title ?? "Nothing playing"}</strong>
            <span>{currentTrack?.artists.join(", ") ?? "Choose something from your library"}</span>
          </div>
          <button
            className="player-heart"
            title="Save to Liked Songs"
            onClick={() => {
              if (!currentTrack) return;
              void window.resonance.setRecommendationFeedback(currentTrack.id, "like").then(() => {
                void recommendationsQuery.refetch();
                void curationQuery.refetch();
              });
            }}
          >
            <Heart size={16} />
          </button>
        </div>
        <div className="player-center">
          <div className="transport-row">
            <button className="transport-icon" title="Shuffle"><Shuffle size={16} /></button>
            <button className="transport-icon" onClick={() => playRelative(-1)} disabled={currentQueueIndex <= 0} title="Previous"><SkipBack size={16} fill="currentColor" /></button>
            <button className="transport-play" onClick={togglePlayback} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button className="transport-icon" onClick={() => { void advanceQueueOrRecommendations(); }} disabled={!currentTrack} title="Next"><SkipForward size={16} fill="currentColor" /></button>
            <button className={repeatMode === "off" ? "transport-icon" : "transport-icon active"} onClick={cycleRepeatMode} title={repeatMode === "off" ? "Repeat off" : repeatMode === "all" ? "Repeat queue" : "Repeat one"}><Repeat size={16} /></button>
          </div>
          <div className="progress-row">
            <span className="progress-time">{formatDuration(Math.round(currentTime))}</span>
            <input
              className="progress-slider"
              type="range"
              min={0}
              max={playbackDuration || currentTrack?.duration || 0}
              value={Math.min(currentTime, playbackDuration || currentTrack?.duration || 0)}
              style={{ "--progress-pcnt": `${((Math.min(currentTime, playbackDuration || currentTrack?.duration || 0)) / ((playbackDuration || currentTrack?.duration || 1))) * 100}%` } as any}
              onInput={(event) => {
                const nextTime = Number(event.currentTarget.value);
                setCurrentTime(nextTime);
                if (audioRef.current) {
                  audioRef.current.currentTime = nextTime;
                }
              }}
            />
            <span className="progress-time">{formatDuration(playbackDuration || currentTrack?.duration || 0)}</span>
          </div>
        </div>
        <div className="player-right">
          <button className="transport-icon" title="Lyrics" onClick={() => navigate("/lyrics")}><Mic2 size={16} /></button>
          <button className="transport-icon" title="Mini player" onClick={() => { void window.resonance.toggleMiniPlayer(); }}><Disc size={16} /></button>
          <button className="transport-icon" title="Queue" onClick={() => setQueueDrawerOpen((value) => !value)}><ListMusic size={16} /></button>
          <button className="transport-icon" title="Volume"><Volume2 size={16} /></button>
          <div className="volume-wrap">
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              style={{ "--progress-pcnt": `${volume * 100}%` } as any}
              onInput={(event) => setVolume(Number(event.currentTarget.value))}
            />
          </div>
          <button className="transport-icon" title={isFullscreen ? "Exit full screen" : "Toggle full screen"} onClick={() => { void window.resonance.toggleFullscreen().then((result) => setIsFullscreen(result.fullscreen)); }}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize size={16} />}</button>
        </div>
      </footer>
      {isQueueDrawerOpen && (
        <aside className="queue-drawer">
          <div className="queue-drawer-header">
            <strong>Now Playing Queue</strong>
            <button className="link-button" type="button" onClick={() => setQueueDrawerOpen(false)}>Close</button>
          </div>
          {queue.length ? (
            <QueueDrawerList
              queue={queue}
              currentTrackId={currentTrackId}
              onPlay={playTrack}
              onReorder={(nextQueue) => setQueue(nextQueue)}
              onStartRadio={handleStartRadio}
              onHideFromRecommendations={handleHideFromRecommendations}
            />
          ) : (
            <div className="empty-card slim">No queue yet. Start a mix, radio, or normal playback and songs will line up here.</div>
          )}
        </aside>
      )}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        preload="metadata"
        onLoadedMetadata={() => {
          if (!audioRef.current) return;
          audioRef.current.playbackRate = 1;
          audioRef.current.defaultPlaybackRate = 1;
          const realDuration = Number.isFinite(audioRef.current.duration) ? Math.round(audioRef.current.duration) : 0;
          if (realDuration > 0) {
            setPlaybackDuration(realDuration);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (!currentTrack) return;

          void (async () => {
            if (repeatMode === "one" && audioRef.current) {
              audioRef.current.currentTime = 0;
              setCurrentTime(0);
              void audioRef.current.play();
              void window.resonance.notifyPlaybackFinished(currentTrack.id, playbackDuration || currentTrack.duration).then(refreshAfterPlaybackEvent);
              return;
            }

            const advanced = await advanceQueueOrRecommendations();
            if (advanced) {
              void window.resonance.notifyPlaybackFinished(currentTrack.id, playbackDuration || currentTrack.duration).then(refreshAfterPlaybackEvent);
              return;
            }

            await window.resonance.notifyPlaybackFinished(currentTrack.id, playbackDuration || currentTrack.duration);
            await refreshAfterPlaybackEvent();
            setPlaying(false);
          })();
        }}
      />
    </div>
  );
};
