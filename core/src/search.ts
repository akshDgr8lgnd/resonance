import ytSearch from "yt-search";
import type { SearchResult } from "./types.js";

export class SearchService {
  async search(query: string): Promise<SearchResult[]> {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    try {
      // Perform parallel searches
      const [itunesResults, ytResults] = await Promise.all([
        this.fetchItunesResults(normalized).catch(() => []),
        this.fetchYoutubeScraperResults(normalized).catch(() => [])
      ]);

      const combined: SearchResult[] = [...itunesResults];
      
      // Add scraper results if they aren't already represented by iTunes results
      // We'll use a simple title-based heuristic for deduplication if needed, 
      // but it's often better to show both if IDs differ.
      combined.push(...ytResults);

      return combined;
    } catch (error) {
      console.error("Search failed:", error);
      return this.buildStaticFallbackResults(normalized);
    }
  }

  private async fetchYoutubeScraperResults(query: string): Promise<SearchResult[]> {
    const r = await ytSearch(query);
    const videos = r.videos ?? [];
    return videos.slice(0, 30).map((v) => ({
      id: v.videoId,
      title: v.title,
      artists: [v.author.name],
      album: null,
      albumArtist: v.author.name,
      duration: v.seconds,
      thumbnail: v.thumbnail || null,
      sourceUrl: v.url,
      videoId: v.videoId,
      kind: "track" as const
    }));
  }

  private async fetchItunesResults(query: string): Promise<SearchResult[]> {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", query);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "25");
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
        artists: ["Search results unavailable"],
        album: "Resonance",
        albumArtist: "Resonance",
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
