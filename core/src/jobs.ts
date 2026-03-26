import crypto from "node:crypto";
import type { DownloadService } from "./download.js";
import type { LibraryService } from "./library.js";
import type { DownloadJob, SearchResult } from "./types.js";

export class DownloadJobService {
  constructor(
    private readonly library: LibraryService,
    private readonly downloads: DownloadService
  ) {}

  createAndRun(result: SearchResult, requestedByDeviceId: string | null, sourceQuery: string | null) {
    const jobId = crypto.randomUUID();
    this.library.createDownloadJob({
      id: jobId,
      status: "queued",
      requestedByDeviceId,
      sourceQuery,
      videoId: result.videoId,
      title: result.title,
      artists: result.artists,
      trackId: null,
      errorMessage: null
    });

    void this.process(jobId, result);
    return this.get(jobId)!;
  }

  get(id: string): DownloadJob | undefined {
    return this.library.getDownloadJob(id);
  }

  private async process(jobId: string, result: SearchResult) {
    this.library.updateDownloadJob(jobId, { status: "running", errorMessage: null });
    try {
      const track = await this.downloads.downloadTrack(result);
      this.library.updateDownloadJob(jobId, { status: "completed", trackId: track.id });
    } catch (error) {
      this.library.updateDownloadJob(jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown download failure"
      });
    }
  }
}
