import type { SearchResult } from "./types.js";

type SearchConfig = {
  youtubeApiKey: string | undefined;
};

const parseIsoDuration = (value: string | undefined) => {
  if (!value) return 0;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};

export class SearchService {
  constructor(private readonly config: SearchConfig) {}

  updateApiKey(key: string) {
    this.config.youtubeApiKey = key;
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    if (!this.config.youtubeApiKey) {
      return this.buildFallbackResults(normalized);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", normalized);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", this.config.youtubeApiKey);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        return this.buildFallbackResults(normalized);
      }

      const data = await response.json();
      const ids = (data.items ?? []).map((item: any) => item.id.videoId).filter(Boolean);
      const durations = new Map<string, number>();
      if (ids.length) {
        const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        detailsUrl.searchParams.set("part", "contentDetails");
        detailsUrl.searchParams.set("id", ids.join(","));
        detailsUrl.searchParams.set("key", this.config.youtubeApiKey);
        const detailsResponse = await fetch(detailsUrl, { signal: controller.signal });
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          for (const item of details.items ?? []) {
            durations.set(item.id, parseIsoDuration(item.contentDetails?.duration));
          }
        }
      }

      const results = (data.items ?? []).map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artists: [item.snippet.channelTitle],
        duration: durations.get(item.id.videoId) ?? 0,
        thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
        sourceUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        videoId: item.id.videoId,
        kind: "track" as const
      }));

      return results.length ? results : this.buildFallbackResults(normalized);
    } catch {
      return this.buildFallbackResults(normalized);
    }
  }

  private async fetchItunesResults(query: string): Promise<SearchResult[]> {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", query);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "100");
    url.searchParams.set("country", "IN");

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.results ?? []).map((item: any) => {
      const artist = item.artistName
        ? item.artistName
            .split(/,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+/i)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : ["Unknown Artist"];
      const trackTitle = item.trackName ?? query;
      const searchPhrase = `${artist.join(", ")} - ${trackTitle} official audio`;
      return {
        id: `itunes-${item.trackId ?? item.collectionId ?? Math.random().toString(36).slice(2)}`,
        title: trackTitle,
        artists: artist,
        album: item.collectionName ?? null,
        albumArtist: item.artistName ?? null,
        trackNumber: typeof item.trackNumber === "number" ? item.trackNumber : null,
        discNumber: typeof item.discNumber === "number" ? item.discNumber : null,
        duration: Math.round((item.trackTimeMillis ?? 0) / 1000),
        thumbnail: item.artworkUrl100?.replace("100x100bb", "512x512bb") ?? item.artworkUrl100 ?? null,
        sourceUrl: `ytsearch1:${searchPhrase}`,
        videoId: `ytsearch:${item.trackId ?? trackTitle}`,
        kind: "track" as const
      };
    });
  }

  private async buildFallbackResults(query: string): Promise<SearchResult[]> {
    try {
      const results = await this.fetchItunesResults(query);
      if (results.length) {
        return results;
      }
    } catch {
      // Fall through to a generic resolver result.
    }

    return this.buildStaticFallbackResults(query);
  }

  private buildStaticFallbackResults(query: string): SearchResult[] {
    const normalizedTitle = query
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return [
      {
        id: `manual-${normalizedTitle.toLowerCase().replace(/\s+/g, "-")}`,
        title: normalizedTitle || "Unknown Track",
        artists: ["Search offline"],
        album: "Resonance",
        albumArtist: "Search offline",
        trackNumber: null,
        discNumber: null,
        duration: 0,
        thumbnail: null,
        sourceUrl: `ytsearch1:${normalizedTitle} audio`,
        videoId: `ytsearch:${normalizedTitle}`,
        kind: "track"
      }
    ];
  }
}
