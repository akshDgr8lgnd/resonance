import type { SearchResult, Track } from "./types.js";

type PartialMetadata = Partial<Pick<Track, "album" | "albumArtist" | "trackNumber" | "discNumber" | "coverPath">> & {
  artists?: string[];
  title?: string;
};

const parseFallbackArtists = (title: string): string[] => {
  const featMatch = title.match(/(.+?)\s+-\s+(.+)/);
  if (!featMatch) return ["Unknown Artist"];
  return featMatch[1]!.split(/,|&|feat\./i).map((item) => item.trim()).filter(Boolean);
};

export const mergeMetadata = (
  youtube: SearchResult,
  musicBrainz: PartialMetadata | null,
  lastFm: PartialMetadata | null
): PartialMetadata => {
  const merged = {
    title: youtube.title,
    artists: youtube.artists.length ? youtube.artists : parseFallbackArtists(youtube.title),
    coverPath: null,
    ...lastFm,
    ...musicBrainz
  };

  return {
    title: merged.title,
    artists: merged.artists,
    album: musicBrainz?.album ?? lastFm?.album ?? null,
    albumArtist: musicBrainz?.albumArtist ?? lastFm?.albumArtist ?? merged.artists?.[0] ?? null,
    trackNumber: musicBrainz?.trackNumber ?? lastFm?.trackNumber ?? null,
    discNumber: musicBrainz?.discNumber ?? lastFm?.discNumber ?? null,
    coverPath: musicBrainz?.coverPath ?? lastFm?.coverPath ?? youtube.thumbnail ?? null
  };
};