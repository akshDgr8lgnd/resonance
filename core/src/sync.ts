import type { DownloadJobService } from "./jobs.js";
import type { LibraryService } from "./library.js";
import type { PlaybackResolution, SearchResult, Track } from "./types.js";

type ResolvePlaybackInput = {
  desktopDeviceId: string;
  requestingDeviceId: string;
  query: string;
  trackId?: string | null;
  videoId?: string | null;
  desktopCanDownload?: boolean;
  allowAndroidFallback?: boolean;
};

export class SyncService {
  constructor(
    private readonly library: LibraryService,
    private readonly jobs: DownloadJobService
  ) {}

  resolvePlayback(input: ResolvePlaybackInput, searchResult?: SearchResult): PlaybackResolution {
    const track = this.findExistingTrack(input.trackId, input.videoId);
    if (track) {
      return {
        mode: "stream_desktop",
        track,
        desktopDeviceId: input.desktopDeviceId
      };
    }

    if (input.desktopCanDownload !== false && searchResult) {
      const job = this.jobs.createAndRun(searchResult, input.requestingDeviceId, input.query);
      return {
        mode: "wait_for_desktop_download",
        job
      };
    }

    if (input.allowAndroidFallback === false) {
      const job = this.jobs.createAndRun(
        searchResult ?? {
          id: input.videoId ?? input.query,
          title: input.query,
          artists: [],
          duration: 0,
          thumbnail: null,
          sourceUrl: input.videoId ? `https://www.youtube.com/watch?v=${input.videoId}` : "",
          videoId: input.videoId ?? "",
          kind: "track"
        },
        input.requestingDeviceId,
        input.query
      );
      return {
        mode: "wait_for_desktop_download",
        job
      };
    }

    return {
      mode: "download_on_android",
      query: input.query,
      videoId: input.videoId ?? searchResult?.videoId ?? null,
      sourceUrl: searchResult?.sourceUrl ?? null
    };
  }

  private findExistingTrack(trackId?: string | null, videoId?: string | null): Track | undefined {
    if (trackId) {
      const byId = this.library.getTrackById(trackId);
      if (byId) return byId;
    }

    if (videoId) {
      return this.library.getTrackByVideoId(videoId);
    }

    return undefined;
  }
}
