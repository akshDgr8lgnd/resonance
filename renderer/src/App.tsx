import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import resonanceMark from "./assets/logo.png";
import { usePlayerStore } from "./store";
import "./styles.css";

// ─── SVG Icons ───────────────────────────────────────────────────────────────
type IconProps = { size?: number; className?: string };
const Icon = {
  Home: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6h7V20H20V7.577l-7.5-4.33zm-2-1.732a3 3 0 0 1 3 0l7.5 4.33A2 2 0 0 1 22 7.576V21a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-6h-3v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.577a2 2 0 0 1 1-1.732l7.5-4.33z"/>
    </svg>
  ),
  HomeFill: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845A2 2 0 0 0 2 7.577V21a1 1 0 0 0 1 1h6v-6h6v6h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732l-7.5-4.33z"/>
    </svg>
  ),
  Search: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.533 1.279c-5.18 0-9.542 4.261-9.542 9.522 0 5.26 4.363 9.522 9.542 9.522 1.847 0 3.571-.5 5.043-1.371l3.943 3.944a1 1 0 1 0 1.414-1.414l-3.942-3.944a9.454 9.454 0 0 0 1.544-5.237c0-5.261-4.363-9.522-9.542-9.522zm-7.542 9.522c0-4.178 3.344-7.522 7.542-7.522s7.542 3.344 7.542 7.522-3.344 7.522-7.542 7.522S2.991 15 2.991 10.801z"/>
    </svg>
  ),
  Library: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zM15.5 2.134A1 1 0 0 0 14 3v18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6.464a1 1 0 0 0-.5-.866l-6-3.464zM9 2a1 1 0 0 0-1 1v18a1 1 0 0 0 2 0V3a1 1 0 0 0-1-1z"/>
    </svg>
  ),
  Capsule: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-9V7h2v4h4v2h-6V11z"/>
    </svg>
  ),
  Settings: ({ size = 24 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.743 2.748a9.87 9.87 0 0 1 4.514 0l.42 1.735a1.93 1.93 0 0 0 2.644 1.342l1.658-.726a9.97 9.97 0 0 1 3.193 3.193l-.726 1.658a1.93 1.93 0 0 0 1.342 2.644l1.735.42a9.87 9.87 0 0 1 0 4.514l-1.735.42a1.93 1.93 0 0 0-1.342 2.644l.726 1.658a9.97 9.97 0 0 1-3.193 3.193l-1.658-.726a1.93 1.93 0 0 0-2.644 1.342l-.42 1.735a9.87 9.87 0 0 1-4.514 0l-.42-1.735a1.93 1.93 0 0 0-2.644-1.342l-1.658.726A9.97 9.97 0 0 1 1.83 17.93l.726-1.658a1.93 1.93 0 0 0-1.342-2.644L.48 13.21a9.87 9.87 0 0 1 0-4.514l1.735-.42A1.93 1.93 0 0 0 3.556 5.63L2.83 3.972A9.97 9.97 0 0 1 6.023.779l1.658.726a1.93 1.93 0 0 0 2.644-1.342l.42-1.735zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
    </svg>
  ),
  Plus: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/>
    </svg>
  ),
  ArrowRight: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 8a.75.75 0 0 1 .75-.75h10.69L9.22 4.03a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H1.75A.75.75 0 0 1 1 8z"/>
    </svg>
  ),
  ChevronLeft: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0z"/>
    </svg>
  ),
  ChevronRight: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.44 8 4.97 14.53a.75.75 0 1 0 1.06 1.06L13.56 8 6.03.47a.75.75 0 0 0-1.06 0z"/>
    </svg>
  ),
  Play: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/>
    </svg>
  ),
  Pause: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/>
    </svg>
  ),
  SkipBack: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-1.4 0V1.7a.7.7 0 0 1 .7-.7z"/>
    </svg>
  ),
  SkipForward: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 1.4 0V1.7a.7.7 0 0 0-.7-.7z"/>
    </svg>
  ),
  Shuffle: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356A2.25 2.25 0 0 1 11.16 4.5h1.949l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5zm7.765 7.364l1.016 1.211A3.75 3.75 0 0 0 12.045 13.5h1.86l-1.017 1.018a.75.75 0 1 0 1.06 1.06l2.829-2.828-2.829-2.828a.75.75 0 1 0-1.06 1.06l1.017 1.018h-1.86a2.25 2.25 0 0 1-1.724-.803l-1.07-1.275-.983 1.171z"/>
    </svg>
  ),
  Repeat: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12.5h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/>
    </svg>
  ),
  Heart: ({ size = 16, filled = false }: IconProps & { filled?: boolean }) => filled ? (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-3.623-1.13A4.313 4.313 0 0 0 .277 4.22c-.162.787-.053 1.61.32 2.336l6.91 12.282a.56.56 0 0 0 .978 0l6.91-12.282a4.236 4.236 0 0 0 .329-2.336z"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65 4.574 4.574 0 0 1-.306 2.242l-.015.031-.013.023-6.966 12.667-.003.004a.998.998 0 0 1-1.724 0l-.003-.004-6.966-12.667A4.574 4.574 0 0 1 .385 4.468 4.618 4.618 0 0 1 1.69 2zm6.252 1.679A2.83 2.83 0 0 0 6.866 3a2.91 2.91 0 0 0-2.084.858L3.8 4.866a.998.998 0 0 1-1.413-1.412L3.37 2.44A4.91 4.91 0 0 1 6.866 1c.836 0 1.65.216 2.386.6A2.997 2.997 0 0 0 10.88 2.8a2.93 2.93 0 0 0 1.003-.175.998.998 0 1 1 .682 1.876 4.927 4.927 0 0 1-1.685.299 5.002 5.002 0 0 1-2.929-.96l-.001-.001.002.001z"/>
    </svg>
  ),
  Volume: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.35-4.975 3.65 3.65 0 0 1 1.35-1.35l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.143 2.143 0 1 0 0 3.8l5.675 3.277.612.424V2.25L8.49 2.672 2.817 6.15zm7.58-.425a.75.75 0 1 1 .75 1.299 2.75 2.75 0 0 1 0 4.752.75.75 0 1 1-.75-1.3 1.25 1.25 0 0 0 0-2.15.75.75 0 0 1-.375-.647V5.75a.75.75 0 0 1 .375-.65zm1.5-2.598a.75.75 0 1 1 .75 1.299A5.25 5.25 0 0 1 15 8a5.25 5.25 0 0 1-2.353 4.374.75.75 0 1 1-.75-1.299A3.75 3.75 0 0 0 13.5 8a3.75 3.75 0 0 0-1.603-3.075z"/>
    </svg>
  ),
  Queue: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 14.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75zm0-4a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 10.5zm14.785-7.658-6.488 3.503a.75.75 0 0 1-.594 0L1.215 2.842A.75.75 0 0 1 1.215 1.5l6.488 3.503a.75.75 0 0 1 .594 0l6.488-3.503a.75.75 0 0 1 0 1.342z"/>
    </svg>
  ),
  Expand: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.03 1.75a.75.75 0 0 1 0-1.5H14.5a.75.75 0 0 1 .75.75v8.47a.75.75 0 0 1-1.5 0V3.31L1.28 15.78a.75.75 0 0 1-1.06-1.06L12.69 2.25H6.03zm5.22 5.47a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 0 1.5h-.01a.75.75 0 0 1-.75-.75z"/>
    </svg>
  ),
  User: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 2.75C6 1.784 6.784 1 7.75 1h.5C9.216 1 10 1.784 10 2.75v.5C10 4.216 9.216 5 8.25 5h-.5C6.784 5 6 4.216 6 3.25v-.5zM7.75 2.5a.25.25 0 0 0-.25.25v.5c0 .138.112.25.25.25h.5a.25.25 0 0 0 .25-.25v-.5a.25.25 0 0 0-.25-.25h-.5zM3 10.25A3.25 3.25 0 0 1 6.25 7h3.5A3.25 3.25 0 0 1 13 10.25v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.966-.784-1.75-1.75-1.75h-3.5c-.966 0-1.75.784-1.75 1.75v3.5a.75.75 0 0 1-1.5 0v-3.5z"/>
    </svg>
  ),
  Download: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a.75.75 0 0 1 .75.75V7.69l1.47-1.47a.75.75 0 0 1 1.06 1.06L8 10.56l-3.28-3.28a.75.75 0 1 1 1.06-1.06L7.25 7.69V1.75A.75.75 0 0 1 8 1zM1.5 13.5A.75.75 0 0 1 2.25 13h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75z"/>
    </svg>
  ),
  Trash: ({ size = 16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 1.5A1.5 1.5 0 0 1 7 0h2a1.5 1.5 0 0 1 1.5 1.5h4a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1 0-1.5h4zM4.75 4h6.5v9.5c0 .828-.672 1.5-1.5 1.5h-3.5c-.828 0-1.5-.672-1.5-1.5V4zm2 1v8h1V5h-1zm2 0v8h1V5h-1z"/>
    </svg>
  ),
};

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

const Artwork = ({ src, alt, size = "md", round = false }: { src: string | null | undefined; alt: string; size?: "xs" | "sm" | "md" | "lg"; round?: boolean }) => {
  const resolved = toAssetSrc(src);
  const className = `${resolved ? "cover-thumb" : "cover-orb"} cover-${size}${round ? " round" : ""}`;
  return resolved ? <img className={className} src={resolved} alt={alt} /> : <div className={className} />;
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
  roundArtists = false
}: {
  title: string;
  items: Array<{ id: string; name: string; subtitle: string; coverPath: string | null; tracks: Track[] }>;
  onPlay: (track: Track, sourceTracks: Track[]) => void;
  roundArtists?: boolean;
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
            <Artwork src={item.coverPath} alt={item.name} size="lg" round={roundArtists} />
            <strong>{item.name}</strong>
            <span>{item.subtitle}</span>
            <div className="play-fab"><Icon.Play size={20} /></div>
          </button>
        ))}
      </div>
    </section>
  );
};

const Sidebar = ({ collections, currentTrackId, onPlay }: { collections: CollectionSummary[]; currentTrackId: string | null; onPlay: (track: Track, tracks: Track[]) => void }) => {
  const navigate = useNavigate();
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
                {isActive ? <Icon.HomeFill size={24} /> : <Icon.Home size={24} />}
                <span>Home</span>
              </>
            )}
          </NavLink>
          <NavLink to="/search" className="nav-link">
            {({ isActive }) => (
              <>
                <Icon.Search size={24} />
                <span>Search</span>
              </>
            )}
          </NavLink>
          <NavLink to="/library" className="nav-link">
            {({ isActive }) => (
              <>
                <Icon.Library size={24} />
                <span>Your Library</span>
              </>
            )}
          </NavLink>
          <NavLink to="/capsule" className="nav-link">
            {({ isActive }) => (
              <>
                <Icon.Capsule size={24} />
                <span>Sound Capsule</span>
              </>
            )}
          </NavLink>
          <NavLink to="/settings" className="nav-link">
            {({ isActive }) => (
              <>
                <Icon.Settings size={24} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </nav>
      </section>
      <section className="library-panel">
        <div className="library-head">
          <div className="library-head-left">
            <Icon.Library size={24} />
            <span>Your Library</span>
          </div>
          <div className="library-head-right">
            <button className="circle-button small" title="Create playlist"><Icon.Plus size={16} /></button>
            <button className="circle-button small" title="Expand"><Icon.ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="library-filter-row">
          <button className="filter-pill active">Playlists</button>
          <button className="filter-pill">Albums</button>
          <button className="filter-pill">Artists</button>
        </div>
        <div className="collection-list">
          {collections.length ? collections.map((collection) => {
            const isActive = currentTrackId ? collection.tracks.some((track) => track.id === currentTrackId) : false;
            return (
              <button 
                key={collection.id} 
                className={isActive ? "collection-row active" : "collection-row"} 
                onClick={() => navigate(`/library?tab=albums&album=${encodeURIComponent(collection.id)}`)}
                title="Click to open album"
              >
                <Artwork src={collection.coverPath} alt={collection.name} size="sm" />
                <div>
                  <strong>{collection.name}</strong>
                  <span>{collection.subtitle}</span>
                </div>
              </button>
            );
          }) : <div className="empty-card slim">Your albums and artists will appear here after you download tracks.</div>}
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
        <button className="circle-button" onClick={() => navigate(-1)} title="Back"><Icon.ChevronLeft size={16} /></button>
        <button className="circle-button" onClick={() => navigate(1)} title="Forward"><Icon.ChevronRight size={16} /></button>
      </div>
      <div className="header-actions">
        <button className="profile-chip" title="Profile"><Icon.User size={14} /></button>
      </div>
    </header>
  );
};

const TrackTable = ({
  tracks,
  currentTrackId,
  onPlay
}: {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (track: Track, sourceTracks: Track[]) => void;
}) => (
  <div className="track-table">
    <div className="track-table-head">
      <span>#</span>
      <span>Title</span>
      <span>Album</span>
      <span style={{ textAlign: 'right' }}>Duration</span>
    </div>
    {tracks.map((track, index) => (
      <button key={track.id} className={currentTrackId === track.id ? "track-table-row active" : "track-table-row"} onClick={() => onPlay(track, tracks)}>
        <div className="track-index-cell">
          <span className="track-index-num">{index + 1}</span>
          <span className="track-index-icon">
            {currentTrackId === track.id ? <Icon.Pause size={14} /> : <Icon.Play size={14} />}
          </span>
        </div>
        <div className="track-main">
          <Artwork src={track.coverPath} alt={track.title} size="sm" />
          <div>
            <strong>{track.title}</strong>
            <span>{track.artists.join(", ")}</span>
          </div>
        </div>
        <span className="track-album-name">{track.album ?? "Single"}</span>
        <span className="track-duration">{formatDuration(track.duration)}</span>
      </button>
    ))}
  </div>
);

const HomePage = ({
  library,
  albums,
  artists,
  collections,
  currentTrackId,
  onPlay
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  collections: CollectionSummary[];
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
}) => {
  const navigate = useNavigate();

  return (
  <div className="page-stack">
    <section className="hero-banner">
      <div className="hero-banner-copy">
        <span className="eyebrow">Resonance mix</span>
        <h1>Bring your library to life.</h1>
        <p>Play albums, jump between artists, and keep your desktop library feeling like a premium streaming app.</p>
        <div className="hero-actions">
          <button className="primary-hero-button" onClick={() => collections[0]?.tracks[0] && onPlay(collections[0].tracks[0], collections[0].tracks)}>Play</button>
          <button className="secondary-hero-button">Follow library</button>
        </div>
      </div>
      <div className="hero-banner-stats">
        <div><strong>{library?.tracks.length ?? 0}</strong><span>songs</span></div>
        <div><strong>{albums.length}</strong><span>albums</span></div>
        <div><strong>{artists.length}</strong><span>artists</span></div>
      </div>
    </section>

    <section className="quick-grid">
      {collections.slice(0, 6).map((collection) => (
        <button key={collection.id} className="quick-card" onClick={() => collection.tracks[0] && onPlay(collection.tracks[0], collection.tracks)}>
          <Artwork src={collection.coverPath} alt={collection.name} size="sm" />
          <strong>{collection.name}</strong>
        </button>
      ))}
    </section>

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
        <h2>Recently downloaded</h2>
        <button className="link-button">See all</button>
      </div>
      {library?.tracks.length ? <TrackTable tracks={library.tracks.slice(0, 8)} currentTrackId={currentTrackId} onPlay={onPlay} /> : <div className="empty-card">Search and download a song to start your collection.</div>}
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

      {!settingsQuery.data?.youtubeKey && !deferredQuery && (
        <section className="spotify-section">
          <div className="setup-prompt">
            <Icon.Settings size={48} />
            <h3>Search setup required</h3>
            <p>To search and download music from YouTube, you need to add an API Key in Settings.</p>
            <button className="primary-hero-button" onClick={() => navigate("/settings")}>Configure API Key</button>
          </div>
        </section>
      )}

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
              <Artwork src={selectedAlbum.coverPath} alt={selectedAlbum.name} size="lg" />
              <div>
                <span className="eyebrow">Album View</span>
                <h2>{selectedAlbum.name}</h2>
                <p>{selectedAlbum.artist} - {selectedAlbum.tracks.length} songs - {formatRuntime(selectedAlbum.totalDuration)}</p>
                <div className="hero-actions">
                  <button className="secondary-hero-button">Album tracks below</button>
                  <button
                    className="accent-button"
                    disabled={downloadingAlbums.has(selectedAlbum.id)}
                    onClick={() => handleDownload(selectedAlbum)}
                  >
                    {downloadingAlbums.has(selectedAlbum.id) ? "Downloading..." : "Download Album"}
                  </button>
                </div>
              </div>
            </div>
            <div className="search-album-tracks">
              {selectedAlbum.tracks
                .slice()
                .sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999) || a.title.localeCompare(b.title))
                .map((item: any, index) => (
                  <div key={`${item.videoId}-${item.id}-album`} className="search-result-row album-track-row">
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
                        className="accent-button"
                        disabled={downloadMutation.isPending}
                        onClick={() => {
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
                        Song
                      </button>
                    </div>
                  </div>
                ))}
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
                  const exactMatch = libraryTracks.find(t => t.youtubeVideoId === item.videoId && t.album === item.album);
                  const anyMatch = libraryTracks.find(t => t.youtubeVideoId === item.videoId);
                  
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
  currentTrackId,
  onPlay
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
}) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<"songs" | "albums" | "artists">(
    requestedTab === "albums" || requestedTab === "artists" ? requestedTab : "songs"
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(searchParams.get("album"));
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(searchParams.get("artist"));
  const [storageBytes, setStorageBytes] = useState<number>(0);

  useEffect(() => {
    window.resonance.fetchStorageUsage().then(setStorageBytes);
  }, [library]);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab === "albums" || nextTab === "artists" || nextTab === "songs") {
      setTab(nextTab);
    }
    setSelectedAlbumId(searchParams.get("album"));
    setSelectedArtistId(searchParams.get("artist"));
  }, [searchParams]);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? albums[0] ?? null;
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) ?? artists[0] ?? null;

  const updateLibraryRoute = (next: { tab: "songs" | "albums" | "artists"; album?: string | null; artist?: string | null }) => {
    const params = new URLSearchParams();
    params.set("tab", next.tab);
    if (next.album) params.set("album", next.album);
    if (next.artist) params.set("artist", next.artist);
    setSearchParams(params);
  };

  const deleteAlbumMutation = useMutation<any, Error, string>({
    mutationFn: (albumName: string) => window.resonance.deleteAlbum(albumName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library"] });
      updateLibraryRoute({ tab: "albums" });
    }
  });

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
        </div>

        {tab === "songs" && (
          library?.tracks.length ? <TrackTable tracks={library.tracks} currentTrackId={currentTrackId} onPlay={onPlay} /> : <div className="empty-card">Your library is empty right now.</div>
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
                  <Artwork src={selectedAlbum.coverPath} alt={selectedAlbum.name} size="lg" />
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
                        <Icon.Trash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <TrackTable tracks={selectedAlbum.tracks} currentTrackId={currentTrackId} onPlay={onPlay} />
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
                  <Artwork src={selectedArtist.coverPath} alt={selectedArtist.name} size="lg" round />
                  <div>
                    <span className="eyebrow">Artist</span>
                    <h2>{selectedArtist.name}</h2>
                    <p>{selectedArtist.trackCount} songs - {formatRuntime(selectedArtist.totalDuration)}</p>
                    <div className="hero-actions">
                      <button className="primary-hero-button" onClick={() => onPlay(selectedArtist.tracks[0]!, selectedArtist.tracks)}>Play</button>
                    </div>
                  </div>
                </div>
                <TrackTable tracks={selectedArtist.tracks} currentTrackId={currentTrackId} onPlay={onPlay} />
              </div>
            ) : null}
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

const SettingsPage = ({ library, albums, artists }: { library: LibraryPayload | undefined; albums: AlbumSummary[]; artists: ArtistSummary[] }) => {
  const queryClient = useQueryClient();
  const pairingQuery = useQuery({
    queryKey: ["pairing"],
    queryFn: () => window.resonance.getPairing()
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => window.resonance.fetchSettings()
  });

  const updateKeyMutation = useMutation({
    mutationFn: (key: string) => window.resonance.updateYoutubeKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });

  return (
    <div className="page-stack">
      <section className="spotify-section settings-grid">
        <div>
          <div className="section-header">
            <h2>Search Configuration</h2>
          </div>
          <p>YouTube API Key is required for searching and downloading new tracks. If you don't have one, search will fall back to offline-only metadata.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="password" 
              className="settings-input" 
              placeholder="Enter YouTube API v3 Key" 
              defaultValue={settingsQuery.data?.youtubeKey ?? ""}
              onBlur={(e) => updateKeyMutation.mutate(e.target.value)}
            />
            {updateKeyMutation.isPending && <span className="input-status">Saving...</span>}
          </div>
          <div className="token-meta">
            <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="link-text">Get a key from Google Cloud Console</a>
          </div>
        </div>
      </section>

      <section className="spotify-section settings-grid">
        <div>
          <div className="section-header">
            <h2>Android pairing</h2>
          </div>
          <p>Use the token or QR code to connect a mobile companion app to the embedded Resonance server.</p>
          <div className="token-block">{pairingQuery.data?.token ?? "Loading..."}</div>
          <div className="token-meta">Port {pairingQuery.data?.port ?? "..."} - Device {pairingQuery.data?.deviceId ?? "..."}</div>
        </div>
        {pairingQuery.data?.qrCode ? <img className="qr-code" src={pairingQuery.data.qrCode} alt="Pairing QR code" /> : <div className="qr-skeleton" />}
      </section>
      <section className="stats-strip">
        <div className="stat-tile"><span>Tracks</span><strong>{library?.tracks.length ?? 0}</strong></div>
        <div className="stat-tile"><span>Albums</span><strong>{albums.length}</strong></div>
        <div className="stat-tile"><span>Artists</span><strong>{artists.length}</strong></div>
      </section>
    </div>
  );
};

const RoutedContent = ({
  library,
  albums,
  artists,
  collections,
  currentTrackId,
  onPlay
}: {
  library: LibraryPayload | undefined;
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  collections: CollectionSummary[];
  currentTrackId: string | null;
  onPlay: (track: Track, tracks: Track[]) => void;
}) => {
  const location = useLocation();
  const headerMap: Record<string, { title: string; subtitle: string }> = {
    "/": { title: "Good evening", subtitle: "Jump back into your music" },
    "/search": { title: "Search", subtitle: "Find songs, albums, and artists" },
    "/library": { title: "Your Library", subtitle: "Albums, artists, and saved songs" },
    "/capsule": { title: "Sound Capsule", subtitle: "Analytics from your listening" },
    "/settings": { title: "Settings", subtitle: "Desktop node and pairing" }
  };
  const header = headerMap[location.pathname] ?? headerMap["/"];

  return (
    <div className="content-shell">
      <MainHeader title={header.title} subtitle={header.subtitle} />
      <div className="content-scroll">
        <Routes>
          <Route path="/" element={<HomePage library={library} albums={albums} artists={artists} collections={collections} currentTrackId={currentTrackId} onPlay={onPlay} />} />
          <Route path="/search" element={<SearchPage onPlay={onPlay} />} />
          <Route path="/library" element={<LibraryPage library={library} albums={albums} artists={artists} currentTrackId={currentTrackId} onPlay={onPlay} />} />
          <Route path="/capsule" element={<CapsulePage />} />
          <Route path="/settings" element={<SettingsPage library={library} albums={albums} artists={artists} />} />
        </Routes>
      </div>
    </div>
  );
};

export const App = () => {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isPlaying, currentTrackId, setCurrentTrack, setPlaying } = usePlayerStore();
  const [currentTrack, setCurrentTrackMeta] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);

  const libraryQuery = useQuery<LibraryPayload>({
    queryKey: ["library"],
    queryFn: () => window.resonance.fetchLibrary()
  });

  const albums = useMemo(() => buildAlbums(libraryQuery.data?.tracks ?? []), [libraryQuery.data?.tracks]);
  const artists = useMemo(() => buildArtists(libraryQuery.data?.tracks ?? []), [libraryQuery.data?.tracks]);
  const collections = useMemo(() => buildCollections(libraryQuery.data?.tracks ?? [], albums, artists), [libraryQuery.data?.tracks, albums, artists]);
  const currentQueueIndex = queue.findIndex((track) => track.id === currentTrack?.id);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack || !currentTrack.filePath) return;
    audioRef.current.src = toAssetSrc(currentTrack.filePath) ?? currentTrack.filePath;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    if (isPlaying) {
      void audioRef.current.play();
    }
  }, [currentTrack, isPlaying]);

  const playTrack = (track: Track, sourceTracks: Track[]) => {
    if (!track.filePath) return;
    setQueue(sourceTracks.filter((item) => item.filePath));
    setCurrentTrack(track.id);
    setCurrentTrackMeta(track);
    setPlaying(true);
    void window.resonance.notifyPlaybackStarted(track.id).then(async () => {
      await libraryQuery.refetch();
    });
  };

  const playRelative = (offset: number) => {
    if (!queue.length) return;
    const nextTrack = queue[currentQueueIndex + offset];
    if (nextTrack) {
      playTrack(nextTrack, queue);
    }
  };

  return (
    <div className="spotify-shell">
      <Sidebar collections={collections} currentTrackId={currentTrackId} onPlay={playTrack} />
      <RoutedContent
        library={libraryQuery.data}
        albums={albums}
        artists={artists}
        collections={collections}
        currentTrackId={currentTrackId}
        onPlay={playTrack}
      />
      <footer className="player-bar">
        <div className="player-left">
          <Artwork src={currentTrack?.coverPath} alt={currentTrack?.title ?? "Nothing playing"} size="sm" />
          <div className="player-track-meta">
            <strong>{currentTrack?.title ?? "Nothing playing"}</strong>
            <span>{currentTrack?.artists.join(", ") ?? "Choose something from your library"}</span>
          </div>
          <button className="player-heart" title="Save to Liked Songs">
            <Icon.Heart size={16} />
          </button>
        </div>
        <div className="player-center">
          <div className="transport-row">
            <button className="transport-icon" title="Shuffle"><Icon.Shuffle size={16} /></button>
            <button className="transport-icon" onClick={() => playRelative(-1)} disabled={currentQueueIndex <= 0} title="Previous"><Icon.SkipBack size={16} /></button>
            <button className="transport-play" onClick={() => setPlaying(!isPlaying)} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
            </button>
            <button className="transport-icon" onClick={() => playRelative(1)} disabled={currentQueueIndex === -1 || currentQueueIndex >= queue.length - 1} title="Next"><Icon.SkipForward size={16} /></button>
            <button className="transport-icon" title="Repeat"><Icon.Repeat size={16} /></button>
          </div>
          <div className="progress-row">
            <span className="progress-time">{formatDuration(Math.round(currentTime))}</span>
            <input
              className="progress-slider"
              type="range"
              min={0}
              max={currentTrack?.duration ?? 0}
              value={Math.min(currentTime, currentTrack?.duration ?? 0)}
              style={{ "--progress-pcnt": `${((Math.min(currentTime, currentTrack?.duration ?? 0)) / (currentTrack?.duration || 1)) * 100}%` } as any}
              onChange={(event) => {
                const nextTime = Number(event.target.value);
                setCurrentTime(nextTime);
                if (audioRef.current) {
                  audioRef.current.currentTime = nextTime;
                }
              }}
            />
            <span className="progress-time">{formatDuration(currentTrack?.duration ?? 0)}</span>
          </div>
        </div>
        <div className="player-right">
          <button className="transport-icon" title="Queue"><Icon.Queue size={16} /></button>
          <button className="transport-icon" title="Volume"><Icon.Volume size={16} /></button>
          <div className="volume-wrap">
            <input 
              className="volume-slider" 
              type="range" 
              min={0} 
              max={1} 
              step={0.01} 
              value={volume} 
              style={{ "--progress-pcnt": `${volume * 100}%` } as any}
              onChange={(event) => setVolume(Number(event.target.value))} 
            />
          </div>
          <button className="transport-icon" title="Full screen"><Icon.Expand size={16} /></button>
        </div>
      </footer>
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (!currentTrack) return;
          void window.resonance.notifyPlaybackFinished(currentTrack.id, currentTrack.duration).then(async () => {
            await Promise.all([
              libraryQuery.refetch(),
              queryClient.invalidateQueries({ queryKey: ["capsule-history"] })
            ]);
          });
          const nextTrack = queue[currentQueueIndex + 1];
          if (nextTrack) {
            playTrack(nextTrack, queue);
          } else {
            setPlaying(false);
          }
        }}
      />
    </div>
  );
};
